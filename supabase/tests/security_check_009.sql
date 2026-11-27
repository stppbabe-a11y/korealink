-- =====================================================================
-- security_check_009.sql | 009(지역 칸) 점검. 임시 회원을 만들었다가 자동 정리합니다. 마지막 줄 SUMMARY 가 PASS 면 정상.
-- =====================================================================
create temp table if not exists _r9 (n serial, test text, ok boolean);
truncate _r9;
grant all on _r9 to public;
grant usage, select on sequence _r9_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); p1 uuid; ok1 boolean; cnt int;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a9@test.dev', '{"username":"region_a"}'::jsonb), (b, 'b9@test.dev', '{"username":"region_b"}'::jsonb);

    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.posts (author_id, title, body, category, region) values (a, 'Seoul cafe', 'Nice cafe in Seoul city', 'food', 'seoul') returning id into p1;
    insert into _r9 values (default, '내 글에 올바른 지역(seoul)을 넣을 수 있다', exists (select 1 from public.posts where id = p1 and region = 'seoul'));
    begin insert into public.posts (author_id, title, body, category, region) values (a, 'Bad one', 'Some body text here ok', 'food', 'mars'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r9 values (default, '없는 지역 코드(mars)는 거부된다', ok1);
    begin insert into public.posts (author_id, title, body, category) values (a, 'No region', 'Some body text here ok', 'food'); ok1 := true; exception when others then ok1 := false; end;
    insert into _r9 values (default, '지역 없이도(비워두고) 글을 쓸 수 있다', ok1);
    update public.posts set region = 'jeju' where id = p1;
    insert into _r9 values (default, '내 글의 지역은 바꿀 수 있다', exists (select 1 from public.posts where id = p1 and region = 'jeju'));
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.posts set region = 'busan' where id = p1;
    get diagnostics cnt = row_count;
    reset role;
    insert into _r9 values (default, '남의 글의 지역은 바꿀 수 없다 (0건 수정)', cnt = 0 and exists (select 1 from public.posts where id = p1 and region = 'jeju'));

    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin
      insert into public.meetups (title, description, category, region, starts_at, place_name, lat, lng, capacity)
        values ('Seoul walk', 'Walk along the river together', 'sightseeing', 'seoul', now() + interval '2 days', 'Han River', 37.5, 127.0, 4); ok1 := true;
    exception when others then ok1 := false; end;
    insert into _r9 values (default, '모임에 지역(seoul)을 넣을 수 있다', ok1);
    begin
      insert into public.meetups (title, description, category, region, starts_at, place_name, lat, lng, capacity)
        values ('Bad walk', 'Walk along the river together', 'sightseeing', 'xx', now() + interval '2 days', 'Han River', 37.5, 127.0, 4); ok1 := false;
    exception when others then ok1 := true; end;
    insert into _r9 values (default, '모임의 없는 지역 코드는 거부된다', ok1);
    reset role;

    delete from auth.users where id in (a, b);
  exception when others then
    insert into _r9 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r9
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r9
order by 1;
