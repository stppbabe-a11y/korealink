-- security_check_012.sql | 012(출석체크 포인트 / 아바타 비용) 점검. 임시 회원을 만들었다가 자동 정리합니다. 마지막 SUMMARY 가 PASS 면 정상.
create temp table if not exists _r12 (n serial, test text, ok boolean);
truncate _r12;
grant all on _r12 to public;
grant usage, select on sequence _r12_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); g uuid := gen_random_uuid();
  ca text := json_build_object('sub', a, 'role', 'authenticated')::text;
  cb text := json_build_object('sub', b, 'role', 'authenticated')::text;
  cg text := json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text;
  j jsonb; j2 jsonb; ok1 boolean; cnt int; n10 int := 0; n30 int := 0; n100 int := 0; r int; pts int;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a12@test.dev', '{"username":"pt_a"}'::jsonb), (b, 'b12@test.dev', '{"username":"pt_b"}'::jsonb);
    insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values (g, null, '{"username":"x"}'::jsonb, true);

    -- 추첨 확률 (10만 번 모의 추첨): 10P / 30P(약 2%) / 100P(약 0.2%)
    for i in 1..100000 loop
      r := public.roll_points();
      if r = 10 then n10 := n10 + 1; elsif r = 30 then n30 := n30 + 1; elsif r = 100 then n100 := n100 + 1; end if;
    end loop;
    insert into _r12 values (default, '추첨 결과는 10 / 30 / 100 중 하나뿐이다', n10 + n30 + n100 = 100000);
    insert into _r12 values (default, '30P 는 약 2% (1/50) 로 나온다 (' || n30 || '/100000)', n30 between 1700 and 2300);
    insert into _r12 values (default, '100P 는 약 0.2% (1/500) 로 나온다 (' || n100 || '/100000)', n100 between 110 and 300);

    -- 출석체크
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    j := public.daily_checkin();
    reset role;
    insert into _r12 values (default, '출석체크 하면 10 / 30 / 100 중 하나를 받고 포인트에 반영된다', (j->>'gained')::int in (10, 30, 100) and (j->>'points')::int = (j->>'gained')::int and (j->>'already')::boolean = false);
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    j2 := public.daily_checkin();
    reset role;
    insert into _r12 values (default, '같은 날 두 번째 출석체크는 포인트가 늘지 않는다', (j2->>'already')::boolean and (j2->>'gained')::int = 0 and (j2->>'points') = (j->>'points'));
    update public.user_points set last_checkin = (now() at time zone 'Asia/Seoul')::date - 1 where user_id = a;
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    j2 := public.daily_checkin();
    reset role;
    insert into _r12 values (default, '다음 날이 되면 다시 출석체크 할 수 있고 포인트가 누적된다', (j2->>'already')::boolean = false and (j2->>'points')::int = (j->>'points')::int + (j2->>'gained')::int);

    -- 직접 조작 방지
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    begin update public.user_points set points = 999999 where user_id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '포인트를 직접 고칠 수 없다', ok1);
    begin insert into public.user_points (user_id, points) values (b, 500); ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '포인트 행을 직접 만들 수 없다', ok1);
    begin insert into public.point_log (user_id, delta, reason) values (a, 100, 'checkin'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '포인트 기록을 직접 만들 수 없다', ok1);
    begin perform public.roll_points(); ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '추첨 함수를 앱에서 직접 부를 수 없다', ok1);
    begin update public.profiles set avatar_cfg = 'f1.s1' where id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '아바타를 직접 고칠 수 없다 (함수로만)', ok1);
    reset role;

    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    select count(*) into cnt from public.user_points where user_id = a;
    reset role;
    insert into _r12 values (default, '남의 포인트는 볼 수 없다', cnt = 0);

    -- 게스트
    perform set_config('request.jwt.claims', cg, true);
    set local role authenticated;
    begin perform public.daily_checkin(); ok1 := false; exception when others then ok1 := true; end;
    insert into _r12 values (default, '게스트는 출석체크를 할 수 없다', ok1);
    reset role;

    -- 아바타: 첫 저장 무료, 이후 10P
    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    j := public.save_avatar('f1.s2.h3');
    reset role;
    insert into _r12 values (default, '첫 아바타 저장은 포인트 없이 무료', (j->>'charged')::int = 0 and exists (select 1 from public.profiles where id = b and avatar_cfg = 'f1.s2.h3'));
    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    begin perform public.save_avatar('f2.s2.h3'); ok1 := false; exception when others then ok1 := sqlerrm like '%not_enough_points%'; end;
    reset role;
    insert into _r12 values (default, '포인트가 없으면 아바타 변경이 거절되고 모양도 그대로다', ok1 and exists (select 1 from public.profiles where id = b and avatar_cfg = 'f1.s2.h3'));
    update public.user_points set points = 25 where user_id = b;
    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    j := public.save_avatar('f2.s2.h3');
    j2 := public.save_avatar('f2.s2.h3');
    reset role;
    insert into _r12 values (default, '변경하면 10P 가 차감되고 (25→15), 같은 모양을 다시 저장하면 차감되지 않는다', (j->>'charged')::int = 10 and (j->>'points')::int = 15 and (j2->>'charged')::int = 0 and (j2->>'points')::int = 15);
    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    begin perform public.save_avatar('<script>'); ok1 := false; exception when others then ok1 := true; end;
    reset role;
    insert into _r12 values (default, '이상한 아바타 값은 서버가 거절한다', ok1);
    select points into pts from public.user_points where user_id = b;
    insert into _r12 values (default, '거절된 요청으로는 포인트가 줄지 않는다', pts = 15);

    delete from auth.users where id in (a, b, g);
  exception when others then
    insert into _r12 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r12
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r12
order by 1;
