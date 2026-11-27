-- 015_notifications.sql | 앱 안 알림: 방장이 내 모임 참가를 "승인"하면 나에게 알림이 생깁니다.
--   * 알림은 서버 함수(meetup_decide)만 만들 수 있고, 앱(사용자)은 직접 만들 수 없습니다. (가짜 알림 방지)
--   * 내 알림만 읽기/읽음 표시/삭제 가능 (RLS). 읽음 표시(is_read) 한 칸만 수정 허용.
--   * 되돌리기: drop table public.notifications cascade;  (meetup_decide 는 007 번 파일의 원래 함수로 다시 실행)
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('meetup_approved')),
  meetup_id  uuid references public.meetups (id) on delete cascade,
  title      text not null check (char_length(title) <= 120),     -- 모임 제목 (알림을 만든 때의 복사본)
  is_read    boolean not null default false,
  created_at timestamptz not null default now(),
  constraint notifications_once unique (user_id, kind, meetup_id)  -- 같은 알림 중복 방지
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- 방장의 승인/거절 (007 의 함수에 "승인 알림 만들기"만 추가)
create or replace function public.meetup_decide(p_meetup uuid, p_user uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m record;
  n integer;
begin
  select * into m from public.meetups where id = p_meetup for update;
  if not found or m.host_id <> (select auth.uid()) then raise exception 'forbidden'; end if;
  if p_user = m.host_id then raise exception 'invalid_input'; end if;
  if p_accept then
    if m.joined_count >= m.capacity then raise exception 'meetup_full'; end if;
    update public.meetup_members set status = 'joined' where meetup_id = p_meetup and user_id = p_user and status = 'pending';
    get diagnostics n = row_count;
    if n > 0 then
      insert into public.notifications (user_id, kind, meetup_id, title)
      values (p_user, 'meetup_approved', p_meetup, left(m.title, 120))
      on conflict (user_id, kind, meetup_id) do update set is_read = false, created_at = now();
    end if;
  else
    delete from public.meetup_members where meetup_id = p_meetup and user_id = p_user;
  end if;
end;
$$;

-- 새 알림이 오면 앱이 바로 알 수 있도록 실시간 목록에 등록 (내 알림만 전달됨: RLS)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
