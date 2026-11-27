-- =====================================================================
-- security_check_005.sql | 005(지도/별점) 추가분 보안 점검. 실제 데이터는 남기지 않습니다(전부 취소됨).
-- 사용: SQL Editor 에 붙여넣고 Run -> 결과 표의 result 가 전부 PASS 이면 정상
-- =====================================================================
create temp table if not exists _r5 (n serial, test text, ok boolean);
truncate _r5;
grant all on _r5 to public;
grant usage, select on sequence _r5_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); pid uuid; got text;
begin
  begin
    insert into auth.users (id, email) values (a, 'a5@test.dev'), (b, 'b5@test.dev');
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- 정상: 별점 + 위치
    insert into public.posts (title, body, place_name, lat, lng, rating)
      values ('Haeundae sunrise', 'Beautiful sunrise spot near the beach', 'Haeundae Beach', 35.1587, 129.1604, 5)
      returning id into pid;
    insert into _r5 (test, ok) values ('정상: 위치+별점 글 작성', pid is not null);

    insert into _r5 (test, ok) values ('summary 는 글 앞부분 자동 계산',
      (select summary = left(body, 140) from public.posts where id = pid));

    -- 비정상 입력은 모두 거절돼야 함
    begin insert into public.posts (title, body, rating) values ('Bad rating', 'rating six should fail now', 6);
      insert into _r5 (test, ok) values ('별점 6 거절', false);
    exception when check_violation then insert into _r5 (test, ok) values ('별점 6 거절', true); end;
    begin insert into public.posts (title, body, rating) values ('Bad rating', 'rating zero should fail now', 0);
      insert into _r5 (test, ok) values ('별점 0 거절', false);
    exception when check_violation then insert into _r5 (test, ok) values ('별점 0 거절', true); end;
    begin insert into public.posts (title, body, lat, lng) values ('Bad geo', 'latitude out of range should fail', 95, 10);
      insert into _r5 (test, ok) values ('위도 95 거절', false);
    exception when check_violation then insert into _r5 (test, ok) values ('위도 95 거절', true); end;
    begin insert into public.posts (title, body, lat) values ('Half geo', 'longitude missing should fail now', 35);
      insert into _r5 (test, ok) values ('좌표 한쪽만 입력 거절', false);
    exception when check_violation then insert into _r5 (test, ok) values ('좌표 한쪽만 입력 거절', true); end;
    begin insert into public.posts (title, body, place_name) values ('Name only', 'place name without coordinates here', 'Nowhere');
      insert into _r5 (test, ok) values ('좌표 없는 장소 이름 거절', false);
    exception when check_violation then insert into _r5 (test, ok) values ('좌표 없는 장소 이름 거절', true); end;
    begin insert into public.posts (title, body, summary) values ('Sum', 'writing summary directly must fail', 'x');
      insert into _r5 (test, ok) values ('summary 직접 쓰기 거절', false);
    exception when insufficient_privilege or sqlstate '428C9' then insert into _r5 (test, ok) values ('summary 직접 쓰기 거절', true); end;

    -- 남의 글 별점/위치 수정 불가 (RLS: 0줄 수정)
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    update public.posts set rating = 1, lat = 0, lng = 0 where id = pid;
    get diagnostics got = row_count;
    insert into _r5 (test, ok) values ('남의 글 별점/위치 수정 불가', got = '0');

    -- 본인은 수정 가능
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    update public.posts set rating = 4 where id = pid;
    get diagnostics got = row_count;
    insert into _r5 (test, ok) values ('내 글 별점 수정 가능', got = '1');

  exception when others then
    reset role;
    insert into _r5 (test, ok) values ('예상 못한 오류: ' || sqlerrm, false);
  end;
  -- 임시 회원 정리 (이 회원의 글은 연쇄 삭제됨)
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a, b);
end $$;

select 0 as no, 'SUMMARY' as test, (count(*) filter (where ok))::text || ' / ' || count(*)::text || ' passed' as got,
       case when bool_and(ok) then 'PASS' else 'FAIL' end as result from _r5
union all select n, test, '', case when ok then 'PASS' else 'FAIL' end from _r5 order by no;
