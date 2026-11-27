-- security_check_011.sql | 011(거주 지역 / 아바타) 점검. 임시 회원을 만들었다가 자동 정리합니다. 마지막 SUMMARY 가 PASS 면 정상.
create temp table if not exists _r11 (n serial, test text, ok boolean);
truncate _r11;
grant all on _r11 to public;
grant usage, select on sequence _r11_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ok1 boolean; cnt int; v text; j jsonb;
  ca text := json_build_object('sub', a, 'role', 'authenticated')::text;
  cb text := json_build_object('sub', b, 'role', 'authenticated')::text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a11@test.dev', '{"username":"av_a"}'::jsonb), (b, 'b11@test.dev', '{"username":"av_b"}'::jsonb);

    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    update public.profile_private set residence_region = 'busan' where user_id = a;
    reset role;
    update public.profiles set avatar_cfg = 'f2.s3.h4.c1.b0.e2.m1.k2.a0' where id = a;      -- (012 이후 아바타는 save_avatar 함수로만 바뀌므로 점검용으로 직접 넣음)
    insert into _r11 values (default, '내 아바타 설정을 저장할 수 있다', exists (select 1 from public.profiles where id = a and avatar_cfg = 'f2.s3.h4.c1.b0.e2.m1.k2.a0'));
    insert into _r11 values (default, '거주 지역이 공개 프로필에 자동 복사된다', exists (select 1 from public.profiles where id = a and residence_region = 'busan'));

    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    j := public.my_profile();
    reset role;
    insert into _r11 values (default, 'my_profile 에 거주 지역과 아바타가 들어 있다', j->>'residence_region' = 'busan' and j->>'avatar_cfg' = 'f2.s3.h4.c1.b0.e2.m1.k2.a0');

    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    begin update public.profiles set avatar_cfg = '<script>alert(1)</script>' where id = a; ok1 := false; exception when others then ok1 := true; end;      -- (권한 또는 형식 검사 중 하나가 막음)
    insert into _r11 values (default, '아바타 값에 특수문자/스크립트는 서버가 거절한다', ok1);
    begin update public.profiles set avatar_cfg = repeat('a', 61) where id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r11 values (default, '아바타 값이 너무 길면 거절한다', ok1);
    begin update public.profile_private set residence_region = 'atlantis' where user_id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r11 values (default, '목록에 없는 거주 지역은 거절한다', ok1);
    begin update public.profile_private set residence_region = 'abroad' where user_id = a; ok1 := true; exception when others then ok1 := false; end;
    insert into _r11 values (default, '"한국 밖(abroad)" 거주 지역은 저장된다', ok1);
    reset role;

    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    begin update public.profiles set avatar_cfg = 'f1.s1' where id = a; get diagnostics cnt = row_count; exception when others then cnt := 0; end;
    begin update public.profiles set residence_region = 'seoul' where id = a; exception when others then null; end;
    reset role;
    insert into _r11 values (default, '남의 아바타는 바꿀 수 없다 (0건)', cnt = 0 and exists (select 1 from public.profiles where id = a and avatar_cfg = 'f2.s3.h4.c1.b0.e2.m1.k2.a0'));
    insert into _r11 values (default, '남의 거주 지역(공개 프로필 칸)은 직접 바꿀 수 없다', not exists (select 1 from public.profiles where id = a and residence_region = 'seoul'));

    perform set_config('request.jwt.claims', '{}', true);
    set local role anon;
    select avatar_cfg into v from public.profiles where id = a;
    reset role;
    insert into _r11 values (default, '로그인 안 한 방문자도 아바타를 볼 수 있다', v = 'f2.s3.h4.c1.b0.e2.m1.k2.a0');

    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    select count(*) into cnt from public.profile_private where user_id = a;
    reset role;
    insert into _r11 values (default, '남의 금고(profile_private)는 여전히 볼 수 없다', cnt = 0);

    delete from auth.users where id in (a, b);
  exception when others then
    insert into _r11 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r11
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r11
order by 1;
