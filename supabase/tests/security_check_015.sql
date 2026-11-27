-- security_check_015.sql | 015(모임 승인 알림) 점검. 임시 회원/모임을 만들었다가 자동 정리합니다. 마지막 SUMMARY 가 PASS 면 정상.
create temp table if not exists _r15 (n serial, test text, ok boolean);
truncate _r15;
grant all on _r15 to public;
grant usage, select on sequence _r15_n_seq to public;
do $$
declare
  h uuid := gen_random_uuid(); u uuid := gen_random_uuid(); x uuid := gen_random_uuid();
  ch text := json_build_object('sub', h, 'role', 'authenticated')::text;
  cu text := json_build_object('sub', u, 'role', 'authenticated')::text;
  cx text := json_build_object('sub', x, 'role', 'authenticated')::text;
  m uuid; cnt int; ok1 boolean; nid uuid;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (h, 'h15@test.dev', '{"username":"nh15"}'::jsonb), (u, 'u15@test.dev', '{"username":"nu15"}'::jsonb), (x, 'x15@test.dev', '{"username":"nx15"}'::jsonb);
    perform set_config('request.jwt.claims', ch, true); set local role authenticated;
    insert into public.meetups (title, description, category, starts_at, place_name, lat, lng, capacity, approval)
      values ('Approval brunch 15', 'Brunch, request to join please.', 'food', now() + interval '3 days', 'Seomyeon', 35.157, 129.059, 5, true) returning id into m;
    reset role;
    perform set_config('request.jwt.claims', cu, true); set local role authenticated;
    insert into public.meetup_members (meetup_id, note) values (m, 'hi');
    reset role;
    insert into _r15 values (default, '신청만 했을 때는 알림이 없다', not exists (select 1 from public.notifications where user_id = u));

    -- 방장이 승인 -> 신청자에게 알림
    perform set_config('request.jwt.claims', ch, true); set local role authenticated;
    perform public.meetup_decide(m, u, true);
    reset role;
    insert into _r15 values (default, '승인하면 신청자에게 알림이 1개 생긴다', (select count(*) = 1 from public.notifications where user_id = u and kind = 'meetup_approved' and meetup_id = m and not is_read));
    insert into _r15 values (default, '승인된 사람이 참여자(joined)가 된다', exists (select 1 from public.meetup_members where meetup_id = m and user_id = u and status = 'joined'));

    -- 알림은 본인만 본다
    perform set_config('request.jwt.claims', cu, true); set local role authenticated;
    select count(*) into cnt from public.notifications; select id into nid from public.notifications limit 1;
    reset role;
    insert into _r15 values (default, '신청자는 자기 알림을 본다', cnt = 1);
    perform set_config('request.jwt.claims', cx, true); set local role authenticated;
    select count(*) into cnt from public.notifications;
    reset role;
    insert into _r15 values (default, '다른 사람은 남의 알림을 못 본다', cnt = 0);
    perform set_config('request.jwt.claims', ch, true); set local role authenticated;
    select count(*) into cnt from public.notifications;
    reset role;
    insert into _r15 values (default, '방장도 승인받은 사람의 알림은 못 본다', cnt = 0);

    -- 가짜 알림 만들기 금지
    perform set_config('request.jwt.claims', cx, true); set local role authenticated;
    begin insert into public.notifications (user_id, kind, meetup_id, title) values (u, 'meetup_approved', m, 'fake'); ok1 := false;
    exception when others then ok1 := true; end;
    reset role;
    insert into _r15 values (default, '사용자가 직접 알림을 만들 수 없다', ok1);

    -- 남의 알림 수정/삭제 금지, 본인 읽음 표시는 가능, 다른 칸 수정은 금지
    perform set_config('request.jwt.claims', cx, true); set local role authenticated;
    update public.notifications set is_read = true where id = nid; get diagnostics cnt = row_count;
    delete from public.notifications where id = nid;
    reset role;
    insert into _r15 values (default, '남의 알림은 읽음 표시/삭제가 안 된다', cnt = 0 and exists (select 1 from public.notifications where id = nid and not is_read));
    perform set_config('request.jwt.claims', cu, true); set local role authenticated;
    update public.notifications set is_read = true where id = nid; get diagnostics cnt = row_count;
    begin update public.notifications set title = 'hacked' where id = nid; ok1 := false; exception when others then ok1 := true; end;
    reset role;
    insert into _r15 values (default, '본인은 읽음 표시를 할 수 있다', cnt = 1 and exists (select 1 from public.notifications where id = nid and is_read));
    insert into _r15 values (default, '읽음 표시 외의 칸(제목 등)은 바꿀 수 없다', ok1);

    -- 승인 권한: 방장이 아닌 사람이 승인 시도
    perform set_config('request.jwt.claims', cx, true); set local role authenticated;
    begin perform public.meetup_decide(m, x, true); ok1 := false; exception when others then ok1 := sqlerrm like '%forbidden%'; end;
    reset role;
    insert into _r15 values (default, '방장이 아닌 사람은 승인할 수 없다', ok1);

    -- 모임이 지워지면 알림도 같이 정리
    delete from public.meetups where id = m;
    insert into _r15 values (default, '모임을 지우면 관련 알림도 지워진다', not exists (select 1 from public.notifications where meetup_id = m));
    delete from auth.users where id in (h, u, x);
  exception when others then
    insert into _r15 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r15
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r15
order by 1;
