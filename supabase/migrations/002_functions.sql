-- =====================================================================
-- 002_functions.sql  |  서버 안에서 자동으로 도는 규칙(트리거)과 함수
--
-- 모든 함수에는 `set search_path = ''` 를 붙였습니다.
-- (함수가 엉뚱한 곳의 같은 이름 테이블을 쓰지 못하게 하는 안전장치입니다.)
-- 누가 이 함수들을 부를 수 있는지는 003_security.sql 에서 정합니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A) 공통 도우미
-- ---------------------------------------------------------------------

-- 지금 요청한 사람이 (차단되지 않은) 관리자인가?  => 서버가 직접 판단합니다.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and not p.is_banned
  );
$$;

-- 지금 요청한 사람이 글/댓글/채팅을 쓸 수 있는 상태인가? (로그인 + 차단 아님)
create or replace function public.can_write()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and not p.is_banned
  );
$$;

-- 수정 시각 자동 기록
create or replace function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- B) 회원가입 시 프로필 자동 생성
--    가입 화면에서 보낸 값(raw_user_meta_data)은 "사용자가 마음대로 쓴 값"이라
--    전부 검사하고, 이상하면 안전한 기본값으로 바꿉니다. role 은 절대 읽지 않습니다.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text  := meta ->> 'username';
  v_display  text  := nullif(btrim(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', '')), '');
  v_country  text  := upper(nullif(meta ->> 'country', ''));
  v_lang     text  := coalesce(nullif(meta ->> 'language', ''), 'en');
  v_fallback text  := 'traveler_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if v_username is null
     or v_username !~ '^[A-Za-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_fallback;
  end if;
  if v_display is not null then v_display := left(v_display, 40); end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  if v_lang not in ('en', 'ko', 'ja', 'zh') then v_lang := 'en'; end if;

  begin
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_username, coalesce(v_display, v_username), v_country, v_lang);
  exception when unique_violation then
    -- 동시에 같은 닉네임으로 가입한 경우: 자동 닉네임으로 대신 저장 (가입이 막히지 않게)
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_fallback, coalesce(v_display, v_fallback), v_country, v_lang);
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- C) 프로필 보호: 권한(role)과 차단 상태는 일반 회원이 못 바꿈 (이중 잠금)
--    1차 잠금은 003 의 "컬럼별 권한", 이 트리거는 2차 잠금입니다.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'forbidden';
  end if;
  -- role 은 앱을 통한 요청(= auth.uid() 가 있는 요청)으로는 절대 못 바꿈.
  -- 관리자 지정은 Supabase 대시보드의 SQL Editor 에서만 가능합니다.
  if new.role is distinct from old.role and (select auth.uid()) is not null then
    raise exception 'forbidden';
  end if;
  if new.is_banned is distinct from old.is_banned
     and (select auth.uid()) is not null and not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- D) 게시글 규칙: 도배 방지(1시간 10개), 이미지 경로는 "내 폴더"만 허용
-- ---------------------------------------------------------------------
create or replace function public.enforce_post_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  img    text;
  recent integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into recent from public.posts
      where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 10 then
      raise exception 'rate_limit: too many posts';
    end if;
  end if;

  -- 다른 사람의 사진이나 외부 주소를 끼워 넣는 것을 막음
  foreach img in array new.images loop
    if img is null or img !~ ('^' || new.author_id::text || '/[A-Za-z0-9._-]{1,100}$') then
      raise exception 'invalid_image_path';
    end if;
  end loop;

  new.title := btrim(new.title);
  new.body  := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists posts_rules on public.posts;
create trigger posts_rules before insert or update of title, body, images on public.posts
  for each row execute function public.enforce_post_rules();
-- updated_at 은 "내용을 고쳤을 때"만 갱신 (좋아요 숫자 변경으로는 갱신되지 않음)
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update of title, body, category, area, images on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- E) 댓글 규칙: 도배 방지(10분 20개), 대댓글은 한 단계만, 같은 글 안에서만
-- ---------------------------------------------------------------------
create or replace function public.enforce_comment_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recent   integer;
  v_parent record;
begin
  select count(*) into recent from public.comments
    where author_id = new.author_id and created_at > now() - interval '10 minutes';
  if recent >= 20 then
    raise exception 'rate_limit: too many comments';
  end if;

  if new.parent_id is not null then
    select post_id, parent_id into v_parent from public.comments where id = new.parent_id;
    if not found or v_parent.post_id <> new.post_id or v_parent.parent_id is not null then
      raise exception 'invalid_parent';
    end if;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists comments_rules on public.comments;
create trigger comments_rules before insert on public.comments
  for each row execute function public.enforce_comment_rules();
drop trigger if exists comments_touch on public.comments;
create trigger comments_touch before update of body on public.comments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- F) 채팅 규칙: 도배 방지(30초 12개), 닫힌 방에는 쓸 수 없음, 수정 시각 기록
-- ---------------------------------------------------------------------
create or replace function public.enforce_message_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into recent from public.chat_messages
      where author_id = new.author_id and created_at > now() - interval '30 seconds';
    if recent >= 12 then
      raise exception 'rate_limit: slow down';
    end if;
    if not exists (select 1 from public.chat_rooms where id = new.room_id and is_active) then
      raise exception 'room_closed';
    end if;
  else
    new.edited_at := now();
  end if;
  new.body := btrim(new.body);
  return new;
end;
$$;

drop trigger if exists chat_messages_rules on public.chat_messages;
create trigger chat_messages_rules before insert or update of body on public.chat_messages
  for each row execute function public.enforce_message_rules();

-- ---------------------------------------------------------------------
-- G) 숫자(좋아요/댓글 수)는 서버가 "+1 / -1" 로만 바꿈
--    => 앱이 전체 데이터를 다시 저장하지 않고, 한 칸의 숫자만 원자적으로 변경됩니다.
-- ---------------------------------------------------------------------
create or replace function public.bump_post_likes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
drop trigger if exists post_likes_count on public.post_likes;
create trigger post_likes_count after insert or delete on public.post_likes
  for each row execute function public.bump_post_likes();

create or replace function public.bump_comment_likes()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.comments set like_count = like_count + 1 where id = new.comment_id;
  else
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.comment_id;
  end if;
  return null;
end;
$$;
drop trigger if exists comment_likes_count on public.comment_likes;
create trigger comment_likes_count after insert or delete on public.comment_likes
  for each row execute function public.bump_comment_likes();

create or replace function public.bump_comment_count()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_comment_count();

-- ---------------------------------------------------------------------
-- H) 앱이 호출하는 함수들 (RPC)
--    모든 입력값은 "매개변수"로만 전달되고, SQL 문장을 문자열로 이어 붙이는 코드는
--    하나도 없습니다 => SQL 인젝션이 들어갈 틈이 없습니다.
-- ---------------------------------------------------------------------

-- 내 프로필 전체 (role 처럼 공개하지 않는 칸 포함)
create or replace function public.me()
returns setof public.profiles
language sql stable security definer set search_path = ''
as $$
  select * from public.profiles where id = (select auth.uid());
$$;

-- 닉네임 사용 가능 여부 (가입 화면에서 실시간 확인용)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username));
$$;

-- 회원 탈퇴: 내 계정과, 내 글/댓글/좋아요/메시지가 함께 삭제됨
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- 신고 접수: 신고 당시의 내용을 서버가 직접 복사해 둡니다. (클라이언트가 조작 불가)
create or replace function public.report_content(
  p_type text, p_id text, p_reason text, p_note text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_author   uuid;
  v_snapshot text;
  v_recent   integer;
begin
  if v_uid is null or not public.can_write() then
    raise exception 'forbidden';
  end if;
  if p_type not in ('post', 'comment', 'message')
     or p_reason not in ('spam', 'abuse', 'inappropriate', 'other') then
    raise exception 'invalid_input';
  end if;

  select count(*) into v_recent from public.reports
    where reporter_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 10 then
    raise exception 'rate_limit: too many reports';
  end if;

  if p_type = 'post' then
    select author_id, left(title || ' - ' || body, 300) into v_author, v_snapshot
      from public.posts where id = p_id::uuid;
  elsif p_type = 'comment' then
    select author_id, left(body, 300) into v_author, v_snapshot
      from public.comments where id = p_id::uuid;
  else
    select author_id, left(body, 300) into v_author, v_snapshot
      from public.chat_messages where id = p_id::bigint;
  end if;

  if v_author is null then
    raise exception 'not_found';
  end if;
  if v_author = v_uid then
    raise exception 'invalid_input';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_author_id, reason, note, snapshot)
  values (v_uid, p_type, p_id, v_author, p_reason, nullif(left(btrim(coalesce(p_note, '')), 200), ''), v_snapshot)
  on conflict (reporter_id, target_type, target_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- I) 관리자 전용 함수: 첫 줄에서 서버가 관리자인지 확인 (화면에서 숨기는 것과 무관)
-- ---------------------------------------------------------------------
create or replace function public.admin_list_reports(p_status text default 'open')
returns table (
  id uuid, target_type text, target_id text, target_author_id uuid, target_author_username text,
  reason text, note text, snapshot text, status text, created_at timestamptz, reporter_username text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select r.id, r.target_type, r.target_id, r.target_author_id, ta.username,
           r.reason, r.note, r.snapshot, r.status, r.created_at, rp.username
    from public.reports r
    left join public.profiles ta on ta.id = r.target_author_id
    left join public.profiles rp on rp.id = r.reporter_id
    where r.status = p_status
    order by r.created_at desc
    limit 100;
end;
$$;

create or replace function public.admin_resolve_report(p_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'invalid_input';
  end if;
  update public.reports set status = p_status where id = p_id;
end;
$$;

create or replace function public.admin_set_hidden(p_type text, p_id uuid, p_hidden boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_type = 'post' then
    update public.posts set is_hidden = p_hidden where id = p_id;
  elsif p_type = 'comment' then
    update public.comments set is_hidden = p_hidden where id = p_id;
  else
    raise exception 'invalid_input';
  end if;
end;
$$;

create or replace function public.admin_set_ban(p_user uuid, p_banned boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_user = (select auth.uid())
     or exists (select 1 from public.profiles where id = p_user and role = 'admin') then
    raise exception 'invalid_input';   -- 자기 자신/다른 관리자는 차단 불가
  end if;
  update public.profiles set is_banned = p_banned where id = p_user;
end;
$$;

create or replace function public.admin_list_users(p_query text default '', p_limit integer default 50)
returns table (
  id uuid, username text, display_name text, role text, is_banned boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_like text := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select p.id, p.username, p.display_name, p.role, p.is_banned, p.created_at
    from public.profiles p
    where p.username ilike v_like or coalesce(p.display_name, '') ilike v_like
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100);
end;
$$;
