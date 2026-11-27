-- =====================================================================
-- security_check_008.sql | 008(회원 탈퇴 보강) 점검. 임시 회원 2명을 만들었다가 자동으로 정리합니다.
-- 결과 표의 마지막 줄 SUMMARY 가 PASS 이면 정상.
-- =====================================================================
create temp table if not exists _r8 (n serial, test text, ok boolean);
truncate _r8;
grant all on _r8 to public;
grant usage, select on sequence _r8_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); m1 uuid; p1 uuid; ok1 boolean; has_ident boolean := false;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a8@test.dev', '{"username":"leaver_eight"}'::jsonb), (b, 'b8@test.dev', '{"username":"stayer_eight"}'::jsonb);
    insert into public.posts (author_id, title, body, category) values (a, 'My post', 'Some body text here', 'food') returning id into p1;
    insert into public.reports (reporter_id, target_type, target_id, target_author_id, reason, snapshot)
      values (b, 'post', p1::text, a, 'spam', 'My post: Some body text here');
    insert into public.meetups (host_id, title, description, category, starts_at, place_name, lat, lng, capacity)
      values (a, 'Walk together', 'Let us walk along the beach', 'sightseeing', now() + interval '2 days', 'Beach', 35.1, 129.1, 4) returning id into m1;

    -- 소셜 로그인 연동 기록(auth.identities) 흉내: 없는 환경이면 이 점검만 건너뜀
    begin
      insert into auth.identities (provider_id, user_id, identity_data, provider)
        values ('kakao-123', a, '{"sub":"kakao-123"}'::jsonb, 'kakao');
      has_ident := true;
    exception when others then has_ident := false; end;

    -- 로그인 없이는 탈퇴 함수 호출 불가
    set local role anon;
    begin perform public.delete_my_account(); ok1 := false; exception when others then ok1 := true; end;
    reset role;
    insert into _r8 values (default, '로그인 안 한 사람은 탈퇴 함수를 못 부른다', ok1);

    -- 다른 사람(b) 탈퇴는 a 의 데이터에 영향 없음
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.delete_my_account();
    reset role;
    insert into _r8 values (default, 'b 가 탈퇴해도 a 의 계정/글/모임은 그대로',
      exists (select 1 from auth.users where id = a) and exists (select 1 from public.posts where id = p1) and exists (select 1 from public.meetups where id = m1));
    insert into _r8 values (default, 'b 의 계정/프로필/금고는 삭제됨',
      not exists (select 1 from auth.users where id = b) and not exists (select 1 from public.profiles where id = b) and not exists (select 1 from public.profile_private where user_id = b));

    -- a 탈퇴
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.delete_my_account();
    reset role;
    insert into _r8 values (default, '탈퇴하면 계정(auth.users)이 삭제됨', not exists (select 1 from auth.users where id = a));
    insert into _r8 values (default, '프로필 + 비공개 금고가 삭제됨', not exists (select 1 from public.profiles where id = a) and not exists (select 1 from public.profile_private where user_id = a));
    insert into _r8 values (default, '내 글과 내가 연 모임(+참여 기록)이 삭제됨',
      not exists (select 1 from public.posts where id = p1) and not exists (select 1 from public.meetups where id = m1) and not exists (select 1 from public.meetup_members where meetup_id = m1));
    insert into _r8 values (default, '나에 대한 신고(글 사본 포함)도 삭제됨', not exists (select 1 from public.reports where snapshot like 'My post%'));
    if has_ident then
      insert into _r8 values (default, '소셜 연동 기록(auth.identities)이 함께 삭제됨', not exists (select 1 from auth.identities where user_id = a));
    end if;
  exception when others then
    insert into _r8 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r8
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r8
order by 1;
