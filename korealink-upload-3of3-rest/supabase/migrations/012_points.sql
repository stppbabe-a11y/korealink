-- =====================================================================
-- 012_points.sql | 출석체크 포인트 + 아바타 변경(포인트 사용)
--   - 하루(한국시간 기준) 1회 출석체크: 기본 10P, 2%(1/50) 확률 30P, 0.2%(1/500) 확률 100P  ※ 추첨은 서버(DB)만 합니다
--   - 아바타 저장: 처음 한 번은 무료, 그다음부터 1회 저장마다 10P 차감 (비용은 아래 avatar_change_cost() 숫자만 고치면 변경)
--   - 포인트는 앱(브라우저)에서 직접 바꿀 수 없고, 아래 함수로만 늘고 줄어듭니다. 게스트는 출석체크 불가.
-- 여러 번 실행해도 안전합니다. (010, 011 을 먼저 실행한 상태여야 합니다)
-- =====================================================================

create table if not exists public.user_points (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  points       integer not null default 0,
  last_checkin date,
  updated_at   timestamptz not null default now(),
  constraint user_points_nonneg check (points >= 0)
);
create table if not exists public.point_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      integer not null,
  reason     text not null check (reason in ('checkin', 'avatar')),
  created_at timestamptz not null default now()
);
create index if not exists point_log_user_idx on public.point_log (user_id, created_at desc);

alter table public.user_points enable row level security;
alter table public.point_log   enable row level security;
revoke all on public.user_points from anon, authenticated;
revoke all on public.point_log   from anon, authenticated;
grant select on public.user_points to authenticated;
grant select on public.point_log   to authenticated;
drop policy if exists up_select_own on public.user_points;
create policy up_select_own on public.user_points for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists pl_select_own on public.point_log;
create policy pl_select_own on public.point_log for select to authenticated using (user_id = (select auth.uid()));

-- ---- 설정값 ----------------------------------------------------------
create or replace function public.avatar_change_cost() returns integer language sql immutable set search_path = '' as $$ select 10 $$;

-- ---- 추첨 (내부용: 앱에서 직접 호출 불가) ---------------------------------------
create or replace function public.roll_points() returns integer
language plpgsql volatile set search_path = ''
as $$
declare u double precision := random();
begin
  if u < 0.002 then return 100;        -- 1/500
  elsif u < 0.022 then return 30;      -- 1/50
  else return 10; end if;
end;
$$;
revoke all on function public.roll_points() from public, anon, authenticated;

-- ---- 내 포인트 ----------------------------------------------------------
create or replace function public.my_points() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'points', coalesce(up.points, 0),
    'checked_in_today', coalesce(up.last_checkin = (now() at time zone 'Asia/Seoul')::date, false),
    'avatar_cost', public.avatar_change_cost())
  from (select (select auth.uid()) as uid) me
  left join public.user_points up on up.user_id = me.uid;
$$;

-- ---- 출석체크 ------------------------------------------------------------
create or replace function public.daily_checkin() returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := (now() at time zone 'Asia/Seoul')::date;
  rec public.user_points;
  gain integer;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if public.is_guest() then raise exception 'guest_not_allowed' using errcode = '42501'; end if;
  insert into public.user_points (user_id) values (uid) on conflict (user_id) do nothing;
  select * into rec from public.user_points where user_id = uid for update;
  if rec.last_checkin = today then
    return jsonb_build_object('already', true, 'gained', 0, 'points', rec.points);
  end if;
  gain := public.roll_points();
  update public.user_points set points = points + gain, last_checkin = today, updated_at = now()
   where user_id = uid returning * into rec;
  insert into public.point_log (user_id, delta, reason) values (uid, gain, 'checkin');
  return jsonb_build_object('already', false, 'gained', gain, 'points', rec.points);
end;
$$;

-- ---- 아바타 저장 (처음 1회 무료, 이후 포인트 차감) ---------------------------------
-- 직접 profiles.avatar_cfg 를 고치는 권한은 회수합니다. 반드시 이 함수로만 바뀝니다.
create or replace function public.save_avatar(p_cfg text) returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cur text;
  cost integer;
  rec public.user_points;
begin
  if uid is null then raise exception 'login_required' using errcode = '28000'; end if;
  if p_cfg is null or p_cfg !~ '^[a-z0-9.]{1,60}$' then raise exception 'bad_avatar' using errcode = '22023'; end if;
  insert into public.user_points (user_id) values (uid) on conflict (user_id) do nothing;
  select * into rec from public.user_points where user_id = uid for update;
  select avatar_cfg into cur from public.profiles where id = uid;
  if cur is not distinct from p_cfg then
    return jsonb_build_object('points', rec.points, 'charged', 0);
  end if;
  cost := case when cur is null then 0 else public.avatar_change_cost() end;
  if rec.points < cost then raise exception 'not_enough_points' using errcode = 'P0001'; end if;
  update public.profiles set avatar_cfg = p_cfg where id = uid;
  if cost > 0 then
    update public.user_points set points = points - cost, updated_at = now() where user_id = uid returning * into rec;
    insert into public.point_log (user_id, delta, reason) values (uid, -cost, 'avatar');
  end if;
  return jsonb_build_object('points', rec.points, 'charged', cost);
end;
$$;

revoke all on function public.my_points(), public.daily_checkin(), public.save_avatar(text) from public, anon;
grant execute on function public.my_points(), public.daily_checkin(), public.save_avatar(text) to authenticated;
revoke update (avatar_cfg) on public.profiles from authenticated;
