-- =====================================================================
-- 010_guest_chat_interests.sql | 게스트 채팅 / 채팅 사진·위치 첨부 / 프로필 관심사
--   (처음부터 끝까지 한 번에 실행해도 안전합니다. 여러 번 실행해도 됩니다.)
--
--  1) 게스트(익명) 로그인: Supabase 의 "Anonymous sign-ins" 를 켜면, 로그인 없이 채팅만 가능한 임시 계정이 생깁니다.
--     게스트가 채팅 외의 것(글/댓글/좋아요/모임/사진 업로드/신고 접수 등)을 못 쓰게 서버가 막습니다.
--  2) 채팅 메시지에 사진/위치 첨부 칸 추가 (로그인한 회원만 가능, 게스트는 서버가 거절)
--  3) 프로필 관심사(공개) 칸 추가
-- =====================================================================

-- ---------- 1) 게스트 판별 + 게스트 프로필 이름 ----------
create or replace function public.is_guest()
returns boolean
language sql stable set search_path = ''
as $$ select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) $$;
grant execute on function public.is_guest() to anon, authenticated;

-- 새 계정이 만들어질 때: (006 의 함수 그대로 + 게스트면 "Guest 1A2B" 같은 임시 이름 자동 부여)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_guest    boolean := coalesce((to_jsonb(new) ->> 'is_anonymous')::boolean, false);
  v_username text  := meta ->> 'username';
  v_display  text  := nullif(btrim(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', '')), '');
  v_country  text  := upper(nullif(meta ->> 'country', ''));
  v_lang     text  := coalesce(nullif(meta ->> 'language', ''), 'en');
  v_fallback text  := case when v_guest then 'guest_' else 'traveler_' end || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if v_guest then
    v_username := null;
    v_display  := 'Guest ' || upper(substr(replace(new.id::text, '-', ''), 1, 4));
  end if;
  if v_username is null
     or v_username !~ '^[A-Za-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_fallback;
  end if;
  if v_display is not null then v_display := left(v_display, 40); end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  if v_lang not in ('en','ko','ja','zh','zh-TW','es','fr','de','ru','vi','th','id') then v_lang := 'en'; end if;

  begin
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_username, coalesce(v_display, v_username), v_country, v_lang);
  exception when unique_violation then
    v_username := v_fallback;
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_username, coalesce(v_display, v_username), v_country, v_lang);
  end;
  insert into public.profile_private (user_id, display_name, country)
  values (new.id, coalesce(v_display, v_username), v_country);
  return new;
end;
$$;

-- 게스트 금지 규칙 (RESTRICTIVE = 기존 허용 규칙에 "추가로 모두 통과해야 하는" 규칙. 기존 규칙은 건드리지 않음)
do $$
declare t text;
begin
  foreach t in array array['posts','comments','post_likes','comment_likes','meetups','meetup_members','meetup_messages'] loop
    execute format('drop policy if exists no_guest_insert on public.%I', t);
    execute format('create policy no_guest_insert on public.%I as restrictive for insert to authenticated with check (not public.is_guest())', t);
  end loop;
end $$;

drop policy if exists no_guest_upload on storage.objects;
create policy no_guest_upload on storage.objects as restrictive for insert to authenticated with check (not public.is_guest());
drop policy if exists no_guest_upload_upd on storage.objects;
create policy no_guest_upload_upd on storage.objects as restrictive for update to authenticated using (not public.is_guest());

-- 오래된 게스트 계정 정리 (대시보드 SQL Editor 에서 가끔 실행: select public.purge_old_guests(30);)
create or replace function public.purge_old_guests(p_days integer default 30)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if (select auth.uid()) is not null then raise exception 'forbidden'; end if;     -- 앱(회원) 요청으로는 실행 불가
  delete from auth.users where coalesce((to_jsonb(auth.users) ->> 'is_anonymous')::boolean, false)
    and created_at < now() - make_interval(days => greatest(p_days, 1));
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.purge_old_guests(integer) from public, anon, authenticated;

-- ---------- 2) 채팅 사진/위치 첨부 ----------
alter table public.chat_messages add column if not exists image      text;
alter table public.chat_messages add column if not exists lat        double precision;
alter table public.chat_messages add column if not exists lng        double precision;
alter table public.chat_messages add column if not exists place_name text;

alter table public.chat_messages drop constraint if exists chat_messages_body_len;
alter table public.chat_messages add constraint chat_messages_body_len check (
  char_length(btrim(body)) <= 500
  and (char_length(btrim(body)) >= 1 or image is not null or lat is not null));
alter table public.chat_messages drop constraint if exists chat_messages_attach_chk;
alter table public.chat_messages add constraint chat_messages_attach_chk check (
  (lat is null) = (lng is null)
  and (lat is null or (lat between -90 and 90 and lng between -180 and 180))
  and (place_name is null or char_length(place_name) <= 100)
  and (image is null or char_length(image) <= 200)
  and not (image is not null and lat is not null));

-- 사진 경로는 "내 폴더"만 허용 (남의 사진/외부 주소 끼워 넣기 방지)
create or replace function public.enforce_chat_attach()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.image is not null and new.image !~ ('^' || new.author_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'invalid_image_path';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_messages_attach on public.chat_messages;
create trigger chat_messages_attach before insert on public.chat_messages
  for each row execute function public.enforce_chat_attach();

grant insert (room_id, author_id, body, image, lat, lng, place_name) on public.chat_messages to authenticated;

-- 게스트는 글자 메시지만 (첨부가 있으면 서버가 거절)
drop policy if exists no_guest_attach on public.chat_messages;
create policy no_guest_attach on public.chat_messages as restrictive for insert to authenticated
  with check (not public.is_guest() or (image is null and lat is null and lng is null and place_name is null));

-- ---------- 3) 프로필 관심사 (항상 공개) ----------
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles drop constraint if exists profiles_interests_chk;
alter table public.profiles add constraint profiles_interests_chk check (
  interests <@ array['food','kculture','activity','arts','nightlife']::text[] and cardinality(interests) <= 5);
grant select (interests) on public.profiles to anon, authenticated;
grant update (interests) on public.profiles to authenticated;
