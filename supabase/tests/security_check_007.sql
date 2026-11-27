-- =====================================================================
-- security_check_007.sql | 007(프로필 공개 규칙 / 이벤트 사진 / 모임 & 동행) 보안 점검
-- 임시 회원 4명을 만들어 점검한 뒤 자동 삭제합니다. 결과 표의 SUMMARY 가 PASS 이면 정상.
-- ※ 006 전용 점검(security_check_006.sql)은 006 직후에만 맞습니다. 007 이후에는 이 파일을 쓰세요.
-- =====================================================================
create temp table if not exists _r7 (n serial, test text, ok boolean);
truncate _r7;
grant all on _r7 to public;
grant usage, select on sequence _r7_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  m1 uuid; m2 uuid; m3 uuid; cnt int; st text; i int;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a7@test.dev', '{"username":"host_seven","display_name":"Host Seven","country":"US"}'::jsonb),
      (b, 'b7@test.dev', '{"username":"bob_seven"}'::jsonb),
      (c, 'c7@test.dev', '{"username":"cat_seven"}'::jsonb),
      (d, 'd7@test.dev', '{"username":"dan_seven"}'::jsonb);

    -- ===== 프로필: 출생연도만 선택 공개 =====
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.profile_private set gender = 'female', residence_country = 'KR', bio = 'Hello Busan', birth_year = 1990 where user_id = a;
    reset role;
    insert into _r7 (test, ok) values ('성별/거주국/소개/이름/국적은 항상 공개로 복사됨',
      (select gender = 'female' and residence_country = 'KR' and bio = 'Hello Busan' and display_name = 'Host Seven' and country = 'US' from public.profiles where id = a));
    insert into _r7 (test, ok) values ('출생연도는 기본 비공개(비어 있음)', (select birth_year is null from public.profiles where id = a));
    set local role authenticated;
    update public.profile_private set show_age = true where user_id = a;
    reset role;
    insert into _r7 (test, ok) values ('출생연도 공개로 바꾸면 복사됨', (select birth_year = 1990 from public.profiles where id = a));
    set local role authenticated;
    update public.profile_private set show_age = false, show_gender = false, show_name = false where user_id = a;
    reset role;
    insert into _r7 (test, ok) values ('옛 스위치(show_gender/show_name)는 이제 무시, 출생연도만 다시 비공개',
      (select birth_year is null and gender = 'female' and display_name = 'Host Seven' from public.profiles where id = a));

    -- ===== 이벤트 사진 칸 =====
    begin insert into public.kto_events (id, lang, title, image) values ('en:x', 'en', 't', 'http://insecure.example/a.jpg');
      insert into _r7 (test, ok) values ('http(비보안) 사진 주소 거절', false);
    exception when check_violation then insert into _r7 (test, ok) values ('http(비보안) 사진 주소 거절', true);
      when insufficient_privilege then insert into _r7 (test, ok) values ('http(비보안) 사진 주소 거절', true); end;

    -- ===== 모임 만들기 (a = 방장) =====
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.meetups (title, description, category, starts_at, place_name, lat, lng, capacity)
      values ('Gwangalli night walk', 'Easy walk and chimaek after.', 'nightlife', now() + interval '2 days', 'Gwangalli Beach', 35.15, 129.12, 2) returning id into m1;
    insert into public.meetups (title, description, category, starts_at, place_name, lat, lng, capacity, approval)
      values ('Approval only brunch', 'Brunch in Seomyeon, request to join.', 'food', now() + interval '3 days', 'Seomyeon', 35.157, 129.059, 5, true) returning id into m2;
    reset role;
    insert into _r7 (test, ok) values ('방장은 자동으로 참여자(1명)', (select joined_count = 1 from public.meetups where id = m1)
      and (select count(*) = 1 from public.meetup_members where meetup_id = m1 and user_id = a and status = 'joined'));

    -- 잘못된 모임 거절
    set local role authenticated;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng) values ('Past meetup', 'This one is in the past.', now() - interval '1 day', 'x', 35, 129);
      insert into _r7 (test, ok) values ('과거 시간 모임 거절', false);
    exception when others then insert into _r7 (test, ok) values ('과거 시간 모임 거절', sqlerrm like '%invalid_start%'); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng, capacity) values ('Too big meetup', 'Capacity is far too large.', now() + interval '1 day', 'x', 35, 129, 99);
      insert into _r7 (test, ok) values ('정원 99명 거절', false);
    exception when check_violation then insert into _r7 (test, ok) values ('정원 99명 거절', true); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng, cover) values ('Cover hijack', 'Uses another users image path.', now() + interval '1 day', 'x', 35, 129, b::text || '/x.webp');
      insert into _r7 (test, ok) values ('남의 폴더 사진을 대표 사진으로 쓰기 거절', false);
    exception when others then insert into _r7 (test, ok) values ('남의 폴더 사진을 대표 사진으로 쓰기 거절', sqlerrm like '%invalid_image_path%'); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng, languages) values ('Bad language', 'Language list has an unknown code.', now() + interval '1 day', 'x', 35, 129, array['xx']);
      insert into _r7 (test, ok) values ('지원하지 않는 언어 코드 거절', false);
    exception when check_violation then insert into _r7 (test, ok) values ('지원하지 않는 언어 코드 거절', true); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng, joined_count) values ('Fake count', 'Trying to set the joined count.', now() + interval '1 day', 'x', 35, 129, 15);
      insert into _r7 (test, ok) values ('참여 인원 숫자 직접 지정 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('참여 인원 숫자 직접 지정 거절', true); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng, host_id) values ('Fake host', 'Trying to set another host id.', now() + interval '1 day', 'x', 35, 129, b);
      insert into _r7 (test, ok) values ('남을 방장으로 지정 거절', false);
    exception when others then insert into _r7 (test, ok) values ('남을 방장으로 지정 거절', true); end;
    reset role;

    -- ===== 참여 (정원/승인) =====
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    insert into public.meetup_members (meetup_id) values (m1);
    reset role;
    insert into _r7 (test, ok) values ('일반 모임: 신청 즉시 참여 확정, 인원 2명', (select status = 'joined' from public.meetup_members where meetup_id = m1 and user_id = b)
      and (select joined_count = 2 from public.meetups where id = m1));

    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin insert into public.meetup_members (meetup_id) values (m1); insert into _r7 (test, ok) values ('정원 초과 신청 거절', false);
    exception when others then insert into _r7 (test, ok) values ('정원 초과 신청 거절', sqlerrm like '%meetup_full%'); end;
    begin insert into public.meetup_members (meetup_id, user_id) values (m2, b); insert into _r7 (test, ok) values ('남의 이름으로 신청 거절', false);
    exception when others then insert into _r7 (test, ok) values ('남의 이름으로 신청 거절', true); end;
    begin insert into public.meetup_members (meetup_id, status) values (m2, 'joined'); insert into _r7 (test, ok) values ('상태(status)를 직접 정해 신청 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('상태(status)를 직접 정해 신청 거절', true); end;
    insert into public.meetup_members (meetup_id, note) values (m2, 'Hi, I am Cat');
    reset role;
    insert into _r7 (test, ok) values ('승인제 모임: 신청하면 대기(pending), 인원 늘지 않음', (select status = 'pending' from public.meetup_members where meetup_id = m2 and user_id = c)
      and (select joined_count = 1 from public.meetups where id = m2));

    -- 대기 중인 사람은 단체 채팅을 못 읽고 못 씀
    set local role authenticated;
    select count(*) into cnt from public.meetup_messages where meetup_id = m2;
    insert into _r7 (test, ok) values ('대기자는 단체 채팅 읽기 0줄', cnt = 0);
    begin insert into public.meetup_messages (meetup_id, body) values (m2, 'let me in'); insert into _r7 (test, ok) values ('대기자의 단체 채팅 쓰기 거절', false);
    exception when others then insert into _r7 (test, ok) values ('대기자의 단체 채팅 쓰기 거절', true); end;
    -- 본인이 승인/참여 상태를 바꿀 수 없음
    begin update public.meetup_members set status = 'joined' where meetup_id = m2 and user_id = c; insert into _r7 (test, ok) values ('신청자가 스스로 승인 불가', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('신청자가 스스로 승인 불가', true); end;
    reset role;
    -- 남(d)은 승인 못 함, 방장(a)은 가능
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin perform public.meetup_decide(m2, c, true); insert into _r7 (test, ok) values ('방장이 아닌 사람의 승인 거절', false);
    exception when others then insert into _r7 (test, ok) values ('방장이 아닌 사람의 승인 거절', sqlerrm like '%forbidden%'); end;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    perform public.meetup_decide(m2, c, true);
    reset role;
    insert into _r7 (test, ok) values ('방장 승인 -> 참여 확정, 인원 2명', (select status = 'joined' from public.meetup_members where meetup_id = m2 and user_id = c)
      and (select joined_count = 2 from public.meetups where id = m2));

    -- ===== 단체 채팅 =====
    set local role authenticated;
    insert into public.meetup_messages (meetup_id, body) values (m2, 'Welcome all');
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into cnt from public.meetup_messages where meetup_id = m2;
    insert into _r7 (test, ok) values ('참여자는 단체 채팅을 읽음', cnt = 1);
    insert into public.meetup_messages (meetup_id, body) values (m2, 'Thanks!');
    begin insert into public.meetup_messages (meetup_id, body, author_id) values (m2, 'fake', a); insert into _r7 (test, ok) values ('남의 이름으로 채팅 쓰기 거절', false);
    exception when others then insert into _r7 (test, ok) values ('남의 이름으로 채팅 쓰기 거절', true); end;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into cnt from public.meetup_messages where meetup_id = m2;
    insert into _r7 (test, ok) values ('참여하지 않은 사람은 단체 채팅 읽기 0줄', cnt = 0);
    select count(*) into cnt from public.meetup_members where meetup_id = m2;
    insert into _r7 (test, ok) values ('참여하지 않은 로그인 회원도 확정 참여자 목록은 볼 수 있음(대기자 제외)', cnt = 2);
    begin insert into public.meetup_messages (meetup_id, body) values (m2, 'spam'); insert into _r7 (test, ok) values ('비참여자 채팅 쓰기 거절', false);
    exception when others then insert into _r7 (test, ok) values ('비참여자 채팅 쓰기 거절', true); end;
    delete from public.meetup_messages where meetup_id = m2;
    get diagnostics cnt = row_count;
    insert into _r7 (test, ok) values ('남의 채팅 삭제 -> 0줄', cnt = 0);
    reset role;

    -- ===== 나가기 / 강퇴 / 수정 / 숨김 =====
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin delete from public.meetup_members where meetup_id = m1 and user_id = a; insert into _r7 (test, ok) values ('방장은 나가기 불가', false);
    exception when others then insert into _r7 (test, ok) values ('방장은 나가기 불가', sqlerrm like '%host_cannot_leave%'); end;
    begin update public.meetups set capacity = 1 where id = m2; insert into _r7 (test, ok) values ('참여 인원보다 작은 정원 거절', false);
    exception when others then insert into _r7 (test, ok) values ('참여 인원보다 작은 정원 거절', sqlerrm like '%capacity%' or sqlstate = '23514'); end;
    reset role;

    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.meetups set title = 'Hacked title!!' where id = m1;
    get diagnostics cnt = row_count;
    insert into _r7 (test, ok) values ('남의 모임 수정 -> 0줄', cnt = 0);
    delete from public.meetups where id = m1;
    get diagnostics cnt = row_count;
    insert into _r7 (test, ok) values ('남의 모임 삭제 -> 0줄', cnt = 0);
    delete from public.meetup_members where meetup_id = m2 and user_id = c;
    get diagnostics cnt = row_count;
    insert into _r7 (test, ok) values ('남의 참여 기록 삭제(강퇴 흉내) -> 0줄', cnt = 0);
    begin update public.meetups set is_hidden = true where id = m1; insert into _r7 (test, ok) values ('일반 회원의 is_hidden 직접 수정 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('일반 회원의 is_hidden 직접 수정 거절', true); end;
    begin perform public.admin_set_hidden('meetup', m1, true); insert into _r7 (test, ok) values ('일반 회원의 admin_set_hidden(meetup) 거절', false);
    exception when others then insert into _r7 (test, ok) values ('일반 회원의 admin_set_hidden(meetup) 거절', sqlerrm like '%forbidden%'); end;
    delete from public.meetup_members where meetup_id = m1 and user_id = b;       -- 본인은 나갈 수 있음
    reset role;
    insert into _r7 (test, ok) values ('참여자는 스스로 나갈 수 있고 인원이 줄어듦', (select joined_count = 1 from public.meetups where id = m1));

    -- 신고
    set local role authenticated;
    perform public.report_content('meetup', m1::text, 'spam', null);
    begin perform public.report_content('meetup', m1::text, 'bogus', null); insert into _r7 (test, ok) values ('잘못된 신고 사유 거절', false);
    exception when others then insert into _r7 (test, ok) values ('잘못된 신고 사유 거절', sqlerrm like '%invalid_input%'); end;
    reset role;
    insert into _r7 (test, ok) values ('모임 신고 접수', (select count(*) = 1 from public.reports where target_type = 'meetup' and target_id = m1::text and reporter_id = b));
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin perform public.report_content('meetup', m1::text, 'spam', null); insert into _r7 (test, ok) values ('내 모임 신고 거절', false);
    exception when others then insert into _r7 (test, ok) values ('내 모임 신고 거절', sqlerrm like '%invalid_input%'); end;
    reset role;

    -- 취소된 모임/시작된 모임에는 신청 불가
    set local role authenticated;
    update public.meetups set is_cancelled = true where id = m2;
    reset role;
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    set local role authenticated;
    begin insert into public.meetup_members (meetup_id) values (m2); insert into _r7 (test, ok) values ('취소된 모임 신청 거절', false);
    exception when others then insert into _r7 (test, ok) values ('취소된 모임 신청 거절', sqlerrm like '%meetup_closed%'); end;
    reset role;

    -- 로그아웃(anon): 모임 목록은 읽기 가능, 참여자/채팅은 불가
    set local role anon;
    select count(*) into cnt from public.meetups;
    insert into _r7 (test, ok) values ('비로그인도 모임 목록 읽기 가능', cnt >= 2);
    begin perform 1 from public.meetup_members; insert into _r7 (test, ok) values ('비로그인이 참여자 읽기 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('비로그인이 참여자 읽기 거절', true); end;
    begin perform 1 from public.meetup_messages; insert into _r7 (test, ok) values ('비로그인이 단체 채팅 읽기 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('비로그인이 단체 채팅 읽기 거절', true); end;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng) values ('Anon meetup', 'Anonymous users cannot create.', now() + interval '1 day', 'x', 35, 129);
      insert into _r7 (test, ok) values ('비로그인 모임 만들기 거절', false);
    exception when insufficient_privilege then insert into _r7 (test, ok) values ('비로그인 모임 만들기 거절', true); end;
    reset role;

    -- 숨김 모임은 남에게 안 보임
    update public.meetups set is_hidden = true where id = m1;
    perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into cnt from public.meetups where id = m1;
    insert into _r7 (test, ok) values ('관리자가 숨긴 모임은 일반 회원에게 안 보임', cnt = 0);
    reset role;
    update public.meetups set is_hidden = false where id = m1;

    -- 도배 방지: 방장 1시간 5개 (이미 2개 + 3개 더 허용, 그 다음은 거절)
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    for i in 1..3 loop
      insert into public.meetups (title, description, starts_at, place_name, lat, lng) values ('Spam meetup ' || i, 'Rate limit test meetup.', now() + interval '5 days', 'x', 35, 129);
    end loop;
    begin insert into public.meetups (title, description, starts_at, place_name, lat, lng) values ('Spam meetup 6', 'Rate limit test meetup.', now() + interval '5 days', 'x', 35, 129);
      insert into _r7 (test, ok) values ('모임 도배(1시간 5개 초과) 거절', false);
    exception when others then insert into _r7 (test, ok) values ('모임 도배(1시간 5개 초과) 거절', sqlerrm like '%rate_limit%'); end;
    reset role;
  exception when others then
    reset role;
    insert into _r7 (test, ok) values ('예상 못한 오류: ' || sqlerrm, false);
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from public.reports where target_type = 'meetup';
  delete from auth.users where id in (a, b, c, d);
  insert into _r7 (test, ok) values ('회원 삭제 시 모임/참여/채팅도 연쇄 삭제',
    (select count(*) from public.meetups where host_id in (a, b, c, d)) = 0
    and (select count(*) from public.meetup_members where user_id in (a, b, c, d)) = 0);
end $$;

select 0 as no, 'SUMMARY' as test, (count(*) filter (where ok))::text || ' / ' || count(*)::text || ' passed' as got,
       case when bool_and(ok) then 'PASS' else 'FAIL' end as result from _r7
union all select n, test, '', case when ok then 'PASS' else 'FAIL' end from _r7 order by no;
