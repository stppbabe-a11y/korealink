-- =====================================================================
-- 007_meetups_eventphoto_profilepublic.sql
--   1) 이벤트 사진 칸(kto_events.image)
--   2) 프로필 공개 규칙 변경: 이름/국적/거주 국가/성별/소개는 항상 공개, 출생연도만 선택
--   3) 모임 & 동행: meetups / meetup_members / meetup_messages (+ 보안 규칙, 신고 연동)
-- 여러 번 실행해도 안전합니다. (006 을 먼저 실행한 상태여야 합니다)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) 이벤트 사진
-- ---------------------------------------------------------------------
alter table public.kto_events add column if not exists image text;
alter table public.kto_events drop constraint if exists kto_events_image_chk;
alter table public.kto_events add constraint kto_events_image_chk
  check (image is null or (char_length(image) <= 400 and image ~ '^https://'));

-- ---------------------------------------------------------------------
-- 2) 프로필: 출생연도만 선택 공개 (나머지는 항상 공개)
-- ---------------------------------------------------------------------
create or replace function public.sync_public_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles p set
    display_name      = new.display_name,
    bio               = new.bio,
    country           = new.country,
    residence_country = new.residence_country,
    gender            = new.gender,
    birth_year        = case when new.show_age then new.birth_year end
  where p.id = new.user_id;
  new.updated_at := now();
  return new;
end;
$$;

-- 이미 있는 회원: 항목별 스위치를 모두 "공개"로 맞추고(트리거가 공개 프로필에 복사), 출생연도 설정은 그대로 유지
update public.profile_private
   set show_name = true, show_bio = true, show_country = true, show_residence = true, show_gender = true;

-- ---------------------------------------------------------------------
-- 3) 모임 & 동행
-- ---------------------------------------------------------------------
create table if not exists public.meetups (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null default auth.uid(),
  title        text not null,
  description  text not null,
  category     text not null default 'food',
  starts_at    timestamptz not null,
  place_name   text not null,
  lat          double precision not null,
  lng          double precision not null,
  capacity     smallint not null default 6,
  approval     boolean not null default false,          -- true: 방장이 참여 신청을 승인해야 함
  languages    text[] not null default '{}',            -- 모임에서 쓰는 언어 (최대 4개)
  cost_note    text,                                    -- 예: "각자 계산" / "입장료 1만원"
  cover        text,                                    -- 대표 사진 (내 폴더 안 경로)
  joined_count smallint not null default 0,             -- 서버(트리거)만 바꿈
  is_cancelled boolean not null default false,
  is_hidden    boolean not null default false,          -- 관리자만 바꿈
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint meetups_host_fkey foreign key (host_id) references public.profiles (id) on delete cascade,
  constraint meetups_title_len check (char_length(btrim(title)) between 3 and 80),
  constraint meetups_desc_len check (char_length(btrim(description)) between 10 and 1500),
  constraint meetups_category_chk check (category in
    ('food', 'cafe', 'sightseeing', 'nature', 'nightlife', 'culture', 'shopping', 'sports', 'language', 'photo', 'other')),
  constraint meetups_capacity_chk check (capacity between 2 and 20),
  constraint meetups_place_len check (char_length(btrim(place_name)) between 1 and 100),
  constraint meetups_geo_chk check (lat between -90 and 90 and lng between -180 and 180),
  constraint meetups_langs_chk check (coalesce(array_length(languages, 1), 0) <= 4
    and languages <@ array['en','ko','ja','zh','zh-TW','es','fr','de','ru','vi','th','id']::text[]),
  constraint meetups_cost_len check (cost_note is null or char_length(cost_note) <= 80),
  constraint meetups_cover_len check (cover is null or char_length(cover) <= 200)
);
create index if not exists meetups_starts_idx on public.meetups (starts_at);
create index if not exists meetups_host_idx on public.meetups (host_id);

create table if not exists public.meetup_members (
  meetup_id  uuid not null,
  user_id    uuid not null default auth.uid(),
  status     text not null default 'pending',          -- pending(승인 대기) / joined(참여 확정)
  note       text,                                      -- 참여 신청 때 방장에게 남기는 한마디
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id),
  constraint mm_meetup_fkey foreign key (meetup_id) references public.meetups (id) on delete cascade,
  constraint meetup_members_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint mm_status_chk check (status in ('pending', 'joined')),
  constraint mm_note_len check (note is null or char_length(note) <= 200)
);
create index if not exists mm_user_idx on public.meetup_members (user_id);

create table if not exists public.meetup_messages (
  id         bigint generated always as identity primary key,
  meetup_id  uuid not null,
  author_id  uuid not null default auth.uid(),
  body       text not null,
  created_at timestamptz not null default now(),
  constraint mmsg_meetup_fkey foreign key (meetup_id) references public.meetups (id) on delete cascade,
  constraint meetup_messages_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade,
  constraint mmsg_body_len check (char_length(btrim(body)) between 1 and 500)
);
create index if not exists mmsg_meetup_idx on public.meetup_messages (meetup_id, id desc);

-- ---------- 도우미 함수 (RLS 안에서 "방장인가/참여자인가"를 안전하게 확인) ----------
create or replace function public.is_meetup_host(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.meetups where id = p_id and host_id = (select auth.uid())); $$;

create or replace function public.is_meetup_member(p_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.meetup_members
                      where meetup_id = p_id and user_id = (select auth.uid()) and status = 'joined'); $$;

-- ---------- 모임 규칙 ----------
create or replace function public.enforce_meetup_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_op = 'INSERT' then
    select count(*) into recent from public.meetups
      where host_id = new.host_id and created_at > now() - interval '1 hour';
    if recent >= 5 then raise exception 'rate_limit: too many meetups'; end if;
    if new.starts_at <= now() or new.starts_at > now() + interval '180 days' then
      raise exception 'invalid_start';
    end if;
  else
    if new.starts_at is distinct from old.starts_at and (new.starts_at <= now() or new.starts_at > now() + interval '180 days') then
      raise exception 'invalid_start';
    end if;
    if new.capacity < old.joined_count then raise exception 'capacity_below_members'; end if;
  end if;

  if new.cover is not null and new.cover !~ ('^' || new.host_id::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'invalid_image_path';
  end if;
  new.title       := btrim(new.title);
  new.description := btrim(new.description);
  new.place_name  := btrim(new.place_name);
  return new;
end;
$$;
drop trigger if exists meetups_rules on public.meetups;
create trigger meetups_rules before insert or update of title, description, category, starts_at, place_name, lat, lng,
    capacity, approval, languages, cost_note, cover on public.meetups
  for each row execute function public.enforce_meetup_rules();
drop trigger if exists meetups_touch on public.meetups;
create trigger meetups_touch before update of title, description, category, starts_at, place_name, lat, lng,
    capacity, approval, languages, cost_note, cover, is_cancelled on public.meetups
  for each row execute function public.touch_updated_at();

-- 방장은 만들자마자 자동으로 참여자
create or replace function public.meetup_add_host()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.meetup_members (meetup_id, user_id, status) values (new.id, new.host_id, 'joined');
  return new;
end;
$$;
drop trigger if exists meetups_host_member on public.meetups;
create trigger meetups_host_member after insert on public.meetups
  for each row execute function public.meetup_add_host();

-- ---------- 참여 규칙: 정원 / 마감 / 승인 / 도배 ----------
create or replace function public.enforce_member_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  m      record;
  recent integer;
begin
  select * into m from public.meetups where id = new.meetup_id for update;       -- 동시에 신청해도 정원이 넘지 않게 잠금
  if not found then raise exception 'not_found'; end if;

  if new.user_id = m.host_id then
    new.status := 'joined';                                                       -- 방장
    return new;
  end if;

  if m.is_cancelled or m.is_hidden or m.starts_at <= now() then raise exception 'meetup_closed'; end if;
  select count(*) into recent from public.meetup_members
    where user_id = new.user_id and created_at > now() - interval '1 hour';
  if recent >= 20 then raise exception 'rate_limit: too many joins'; end if;

  if m.approval then
    new.status := 'pending';
  else
    if m.joined_count >= m.capacity then raise exception 'meetup_full'; end if;
    new.status := 'joined';
  end if;
  new.note := nullif(btrim(coalesce(new.note, '')), '');
  return new;
end;
$$;
drop trigger if exists mm_rules on public.meetup_members;
create trigger mm_rules before insert on public.meetup_members
  for each row execute function public.enforce_member_rules();

-- 방장은 "나가기" 불가(모임 취소/삭제만 가능). 모임이 삭제되며 연쇄 삭제될 때는 허용
create or replace function public.protect_host_membership()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.meetups where id = old.meetup_id and host_id = old.user_id) then
    raise exception 'host_cannot_leave';
  end if;
  return old;
end;
$$;
drop trigger if exists mm_protect_host on public.meetup_members;
create trigger mm_protect_host before delete on public.meetup_members
  for each row execute function public.protect_host_membership();

-- 참여 확정 인원 수 자동 계산
create or replace function public.recount_meetup()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.meetup_id, old.meetup_id);
begin
  update public.meetups set joined_count = (
    select count(*) from public.meetup_members where meetup_id = v_id and status = 'joined')
  where id = v_id;
  return null;
end;
$$;
drop trigger if exists mm_recount on public.meetup_members;
create trigger mm_recount after insert or update of status or delete on public.meetup_members
  for each row execute function public.recount_meetup();

-- 방장의 승인/거절
create or replace function public.meetup_decide(p_meetup uuid, p_user uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m record;
begin
  select * into m from public.meetups where id = p_meetup for update;
  if not found or m.host_id <> (select auth.uid()) then raise exception 'forbidden'; end if;
  if p_user = m.host_id then raise exception 'invalid_input'; end if;
  if p_accept then
    if m.joined_count >= m.capacity then raise exception 'meetup_full'; end if;
    update public.meetup_members set status = 'joined' where meetup_id = p_meetup and user_id = p_user and status = 'pending';
  else
    delete from public.meetup_members where meetup_id = p_meetup and user_id = p_user;
  end if;
end;
$$;

-- ---------- 단체 채팅 규칙 ----------
create or replace function public.enforce_meetup_message_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  recent integer;
begin
  select count(*) into recent from public.meetup_messages
    where author_id = new.author_id and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'rate_limit: too many messages'; end if;
  new.body := btrim(new.body);
  return new;
end;
$$;
drop trigger if exists mmsg_rules on public.meetup_messages;
create trigger mmsg_rules before insert on public.meetup_messages
  for each row execute function public.enforce_meetup_message_rules();

-- ---------- 권한 + RLS ----------
alter table public.meetups enable row level security;
alter table public.meetup_members enable row level security;
alter table public.meetup_messages enable row level security;
revoke all on public.meetups, public.meetup_members, public.meetup_messages from anon, authenticated;

grant select on public.meetups to anon, authenticated;
grant insert (title, description, category, starts_at, place_name, lat, lng, capacity, approval, languages, cost_note, cover)
  on public.meetups to authenticated;
grant update (title, description, category, starts_at, place_name, lat, lng, capacity, approval, languages, cost_note, cover, is_cancelled)
  on public.meetups to authenticated;
grant delete on public.meetups to authenticated;

drop policy if exists meetups_select on public.meetups;
create policy meetups_select on public.meetups for select to anon, authenticated
  using (not is_hidden or host_id = (select auth.uid()) or public.is_admin());
drop policy if exists meetups_insert on public.meetups;
create policy meetups_insert on public.meetups for insert to authenticated
  with check (host_id = (select auth.uid()) and public.can_write());
drop policy if exists meetups_update on public.meetups;
create policy meetups_update on public.meetups for update to authenticated
  using (host_id = (select auth.uid()) and public.can_write())
  with check (host_id = (select auth.uid()));
drop policy if exists meetups_delete on public.meetups;
create policy meetups_delete on public.meetups for delete to authenticated
  using (host_id = (select auth.uid()) or public.is_admin());

grant select on public.meetup_members to authenticated;
grant insert (meetup_id, user_id, note) on public.meetup_members to authenticated;
grant delete on public.meetup_members to authenticated;
drop policy if exists mm_select on public.meetup_members;
create policy mm_select on public.meetup_members for select to authenticated
  using (status = 'joined' or user_id = (select auth.uid()) or public.is_meetup_host(meetup_id));
drop policy if exists mm_insert on public.meetup_members;
create policy mm_insert on public.meetup_members for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_write());
drop policy if exists mm_delete on public.meetup_members;
create policy mm_delete on public.meetup_members for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_meetup_host(meetup_id));

grant select on public.meetup_messages to authenticated;
grant insert (meetup_id, author_id, body) on public.meetup_messages to authenticated;
grant delete on public.meetup_messages to authenticated;
drop policy if exists mmsg_select on public.meetup_messages;
create policy mmsg_select on public.meetup_messages for select to authenticated
  using (public.is_meetup_member(meetup_id));
drop policy if exists mmsg_insert on public.meetup_messages;
create policy mmsg_insert on public.meetup_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_write() and public.is_meetup_member(meetup_id));
drop policy if exists mmsg_delete on public.meetup_messages;
create policy mmsg_delete on public.meetup_messages for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_meetup_host(meetup_id) or public.is_admin());

-- 함수 실행 권한: 트리거용은 닫고, 화면에서 쓰는 것만 로그인 회원에게
revoke all on function public.enforce_meetup_rules(), public.meetup_add_host(), public.enforce_member_rules(),
  public.protect_host_membership(), public.recount_meetup(), public.enforce_meetup_message_rules() from public, anon, authenticated;
revoke all on function public.is_meetup_host(uuid), public.is_meetup_member(uuid), public.meetup_decide(uuid, uuid, boolean) from public, anon;
grant execute on function public.is_meetup_host(uuid), public.is_meetup_member(uuid), public.meetup_decide(uuid, uuid, boolean) to authenticated;
grant execute on function public.is_meetup_host(uuid), public.is_meetup_member(uuid) to anon;

-- 실시간(채팅 즉시 도착)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'meetup_messages') then
    alter publication supabase_realtime add table public.meetup_messages;
  end if;
end $$;

-- ---------- 신고 / 관리자 숨김에 "모임" 추가 ----------
alter table public.reports drop constraint if exists reports_type_chk;
alter table public.reports add constraint reports_type_chk check (target_type in ('post', 'comment', 'message', 'meetup'));

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
  if p_type not in ('post', 'comment', 'message', 'meetup')
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
  elsif p_type = 'meetup' then
    select host_id, left(title || ' - ' || description, 300) into v_author, v_snapshot
      from public.meetups where id = p_id::uuid;
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
  elsif p_type = 'meetup' then
    update public.meetups set is_hidden = p_hidden where id = p_id;
  else
    raise exception 'invalid_input';
  end if;
end;
$$;
