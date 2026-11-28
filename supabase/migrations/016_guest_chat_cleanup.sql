-- 016_guest_chat_cleanup.sql | 게스트(손님) 채팅 자동 정리 — 일반 회원 채팅/글에는 영향 없음
--   * 게스트가 쓴 채팅 메시지: 작성 7일 후 삭제 (단, 아직 처리 안 된 신고가 걸린 메시지는 보존. 신고 기록에는 당시 내용 사본이 따로 남음)
--   * 게스트 계정: 만든 지 7일 지났고 마지막 접속도 7일 지났으면 삭제 (신고가 걸린 게 남아 있으면 보존)
--   * 채팅방(chat_rooms)은 관리자가 만든 고정 방이라 지우지 않습니다 (빈 방이어도 그대로 둡니다).
--   * 매일 새벽 자동 실행 설정(pg_cron)은 아래에 포함. 지원되지 않으면 SQL Editor 에서 직접:  select public.purge_guest_chat();
--   되돌리기: select cron.unschedule('purge-guest-chat');  drop function public.purge_guest_chat();
create or replace function public.purge_guest_chat(p_days integer default 7)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
  n_msg integer; n_user integer;
begin
  if (select auth.uid()) is not null then raise exception 'forbidden'; end if;     -- 앱(회원) 요청으로는 실행 불가
  with g as (select u.id from auth.users u where coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false))
  delete from public.chat_messages m
   using g
   where m.author_id = g.id and m.created_at < cutoff
     and not exists (select 1 from public.reports r
                      where r.target_type = 'message' and r.target_id = m.id::text and r.status = 'open');
  get diagnostics n_msg = row_count;

  delete from auth.users u
   where coalesce((to_jsonb(u) ->> 'is_anonymous')::boolean, false)
     and u.created_at < cutoff
     and coalesce(u.last_sign_in_at, u.created_at) < cutoff
     and not exists (select 1 from public.chat_messages m
                      join public.reports r on r.target_type = 'message' and r.target_id = m.id::text and r.status = 'open'
                     where m.author_id = u.id);
  get diagnostics n_user = row_count;
  return jsonb_build_object('messages_deleted', n_msg, 'guests_deleted', n_user);
end;
$$;
revoke all on function public.purge_guest_chat(integer) from public, anon, authenticated;

-- 매일 한 번 자동 실행 (Supabase 에서 pg_cron 이 켜져 있을 때만. 안 되면 건너뛰고 안내 메시지만 남김)
do $$
begin
  begin
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-guest-chat';
    perform cron.schedule('purge-guest-chat', '17 18 * * *', 'select public.purge_guest_chat();');   -- UTC 18:17 = 한국 새벽 03:17
  exception when others then
    raise notice 'pg_cron 자동 실행은 설정하지 못했습니다 (%). 대시보드 Database > Extensions 에서 pg_cron 을 켠 뒤 이 파일을 다시 실행하세요.', sqlerrm;
  end;
end $$;
