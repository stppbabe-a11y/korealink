-- 008_account_deletion.sql | 회원 탈퇴 보강 (여러 번 실행해도 안전)
--   탈퇴하면: 계정(auth.users) + 프로필 + 비공개 금고 + 내 글/댓글/좋아요/채팅/모임(방장인 모임 포함)/참여 기록이 함께 삭제됩니다.
--   (이미 모두 ON DELETE CASCADE 로 연결되어 있음)  추가로, "나에 대한 신고"에 남아 있던 글 사본(snapshot)도 지웁니다.
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
  delete from public.reports where target_author_id = v_uid;   -- 내 글 사본이 담긴 신고 기록 삭제
  delete from auth.users where id = v_uid;                      -- 나머지는 연쇄 삭제 + 소셜 연동 기록(auth.identities)도 함께 삭제
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
