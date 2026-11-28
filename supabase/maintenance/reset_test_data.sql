-- reset_test_data.sql | 테스트 데이터 전체 초기화 (관리자 계정은 남기고 나머지 회원·글·모임·채팅·알림·사진기록 삭제)
--   * 테이블/구조/RLS/함수/채팅방/지역/행사 정보(kto_events)는 그대로. DROP 없음. RLS 끄지 않음.
--   * 관리자(role='admin') 계정이 하나도 없으면 아무것도 지우지 않고 멈춥니다.
--   * 한 번에 실행되고, 중간에 오류가 나면 전부 취소됩니다 (트랜잭션).
--   * 마지막에 남은 개수를 보여줍니다. 사진 파일(Storage)은 이 SQL로 지우지 않고 대시보드에서 따로 지웁니다.
begin;
do $$
begin
  if not exists (select 1 from public.profiles where role = 'admin') then
    raise exception '관리자 계정이 없어 중단합니다 (아무것도 삭제하지 않았습니다)';
  end if;
end $$;

delete from public.notifications;
delete from public.reports;
delete from public.point_log;
delete from public.user_points;
delete from public.meetups;   -- 모임 채팅·참가 기록은 모임이 지워질 때 함께 지워짐 (방장 보호 규칙 때문에 참가 기록을 먼저 지우면 안 됨)
delete from public.comment_likes;
delete from public.post_likes;
delete from public.comments;
delete from public.posts;
delete from public.chat_messages;

-- 관리자를 뺀 모든 계정 삭제 (프로필·비공개정보·로그인 연동 기록은 연쇄 삭제)
delete from auth.users where id not in (select id from public.profiles where role = 'admin');

commit;

select 'users(관리자만 남아야 함)' as item, count(*)::text as n from auth.users
union all select 'profiles', count(*)::text from public.profiles
union all select 'posts', count(*)::text from public.posts
union all select 'meetups', count(*)::text from public.meetups
union all select 'chat_messages', count(*)::text from public.chat_messages
union all select 'chat_rooms(유지)', count(*)::text from public.chat_rooms
union all select 'kto_events(유지)', count(*)::text from public.kto_events;
