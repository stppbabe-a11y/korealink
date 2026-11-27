-- security_check_014.sql | 014(이메일 가입 차단) 점검. 마지막 SUMMARY 가 PASS 면 정상.
create temp table if not exists _r14 (n serial, test text, ok boolean);
truncate _r14;
grant all on _r14 to public;
grant usage, select on sequence _r14_n_seq to public;
do $$
declare ok1 boolean; a uuid := gen_random_uuid(); g uuid := gen_random_uuid(); e uuid := gen_random_uuid();
begin
  begin
    begin
      insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (e, 'new14@test.dev', '{"provider":"email"}'::jsonb, '{"username":"em14"}'::jsonb);
      ok1 := false;
    exception when others then ok1 := sqlerrm like '%email_signup_closed%'; end;
    insert into _r14 values (default, '이메일로 새로 가입하면 서버가 거절한다', ok1);
    insert into _r14 values (default, '거절된 가입은 계정/프로필이 남지 않는다', not exists (select 1 from auth.users where id = e) and not exists (select 1 from public.profiles where id = e));

    insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values (a, 'g14@test.dev', '{"provider":"google","providers":["google"]}'::jsonb, '{"username":"go14"}'::jsonb);
    insert into _r14 values (default, '구글 로그인 가입은 정상이다', exists (select 1 from public.profiles where id = a));

    insert into auth.users (id, email, is_anonymous, raw_app_meta_data, raw_user_meta_data) values (g, null, true, '{"provider":"anonymous"}'::jsonb, '{}'::jsonb);
    insert into _r14 values (default, '게스트(익명) 입장은 정상이다', exists (select 1 from public.profiles where id = g));

    delete from auth.users where id in (a, g);
  exception when others then
    insert into _r14 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r14
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r14
order by 1;
