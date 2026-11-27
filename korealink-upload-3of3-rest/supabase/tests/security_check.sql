-- =====================================================================
-- security_check.sql  |  "정말 막혀 있나?" 자동 점검 (공격 시뮬레이션)
--
-- 사용법: Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run.
-- 결과 표의 맨 윗줄(SUMMARY)이 PASS 이면 모든 점검 통과입니다.
--
-- 무엇을 하나요?
--   임시 회원 3명(피해자 A, 공격자 B, 관리자 ADM)을 만들고,
--   B 가 A 의 글/댓글/채팅을 고치거나 지우려는 시도, 권한 상승 시도, 도배 등
--   "나쁜 짓"을 실제로 해 본 뒤, 전부 거절되는지 확인합니다.
--   또한 정상 사용(내 글 수정, 좋아요 등)이 막히지 않았는지도 함께 확인합니다.
--   끝나면 임시 회원과 그 데이터는 모두 자동 삭제됩니다. (기존 데이터는 건드리지 않음)
-- =====================================================================

drop table if exists pg_temp._r;
create temp table _r (n serial, test text, expected text, got text, ok boolean);

-- 결과 기록
create or replace function pg_temp.chk(p_test text, p_expected text, p_got text)
returns void language plpgsql as $$
begin
  insert into _r (test, expected, got, ok) values (p_test, p_expected, p_got, p_got like p_expected);
end $$;

-- 특정 사람(또는 로그인 안 한 방문자)인 척 SQL 한 줄을 실행해 보고, 결과를 문자열로 돌려줌
create or replace function pg_temp.attempt(p_uid uuid, p_role text, p_sql text)
returns text language plpgsql as $$
declare n bigint; out text;
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql;
    get diagnostics n = row_count;
    out := 'ROWS ' || n;
  exception when others then
    out := 'ERROR: ' || sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return out;
end $$;

do $$
declare
  a uuid := gen_random_uuid();    -- 피해자
  b uuid := gen_random_uuid();    -- 공격자
  adm uuid := gen_random_uuid();  -- 관리자
  m1 uuid := gen_random_uuid();   -- 가입 데이터 조작 테스트용
  m2 uuid := gen_random_uuid();
  room uuid; post_a uuid; post_b uuid; comment_a uuid; reply_b uuid;
  msg_a bigint; msg_a2 bigint;
  got text; i int; bad text;
  s1 text; s2 text; s3 text;   -- 사진 보관함 점검 결과를 잠시 담아 두는 칸
begin
  begin  -- 예상 밖 오류가 나면 이 블록 전체가 자동으로 되돌려집니다
    ---------------------------------------------------------------- 준비
    insert into auth.users (id, email) values
      (a, 'a@test.invalid'), (b, 'b@test.invalid'), (adm, 'adm@test.invalid');
    update public.profiles set role = 'admin' where id = adm;
    select id into room from public.chat_rooms where slug = 'general';
    if room is null then
      insert into public.chat_rooms (slug, name) values ('selftest', 'Self test') returning id into room;
    end if;
    insert into public.posts (author_id, title, body) values (a, 'A first post', 'Body text of the A post.') returning id into post_a;
    insert into public.posts (author_id, title, body) values (b, 'B first post', 'Body text of the B post.') returning id into post_b;
    insert into public.comments (post_id, author_id, body) values (post_a, a, 'A comment') returning id into comment_a;
    insert into public.chat_messages (room_id, author_id, body) values (room, a, 'hello from A') returning id into msg_a;
    insert into public.chat_messages (room_id, author_id, body) values (room, a, 'second from A') returning id into msg_a2;
    insert into public.post_likes (post_id, user_id) values (post_a, a);

    ------------------------------------------------ [공격] 남의 것 수정/삭제
    perform pg_temp.chk('B가 A의 채팅 메시지를 수정 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('update public.chat_messages set body = ''hacked'' where id = %s', msg_a)));
    perform pg_temp.chk('B가 A의 채팅 메시지를 삭제 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('delete from public.chat_messages where id = %s', msg_a)));
    perform pg_temp.chk('B가 A의 게시글을 수정 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('update public.posts set title = ''hacked!!'' where id = %L', post_a)));
    perform pg_temp.chk('B가 A의 게시글을 삭제 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('delete from public.posts where id = %L', post_a)));
    perform pg_temp.chk('B가 A의 댓글을 수정 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('update public.comments set body = ''hacked'' where id = %L', comment_a)));
    perform pg_temp.chk('B가 A의 댓글을 삭제 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('delete from public.comments where id = %L', comment_a)));
    perform pg_temp.chk('B가 A의 프로필(금고)을 수정 시도', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', format('update public.profile_private set bio = ''hacked'' where user_id = %L', a)));

    ------------------------------------------------ [공격] 남인 척 글쓰기
    perform pg_temp.chk('B가 A 이름으로 채팅 메시지 작성 시도', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.chat_messages (room_id, author_id, body) values (%L, %L, ''fake'')', room, a)));
    perform pg_temp.chk('B가 A 이름으로 게시글 작성 시도', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.posts (author_id, title, body) values (%L, ''fake title'', ''fake body text here'')', a)));
    perform pg_temp.chk('B가 내 글의 작성자를 A로 바꾸려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.posts set author_id = %L where id = %L', a, post_b)));
    perform pg_temp.chk('B가 내 메시지를 다른 방으로 옮기려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.chat_messages set room_id = %L where author_id = %L', room, b)));

    ------------------------------------------------ [공격] 권한 상승 / 조작
    perform pg_temp.chk('B가 스스로 관리자(role)로 변경 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.profiles set role = ''admin'' where id = %L', b)));
    perform pg_temp.chk('B가 차단 상태(is_banned) 직접 변경 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.profiles set is_banned = false where id = %L', b)));
    perform pg_temp.chk('B가 좋아요 숫자를 직접 조작 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.posts set like_count = 999 where id = %L', post_a)));
    perform pg_temp.chk('B가 게시글 숨김(is_hidden) 직접 변경 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('update public.posts set is_hidden = true where id = %L', post_b)));
    perform pg_temp.chk('B가 다른 회원의 role 칸을 읽으려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', 'select role from public.profiles'));
    perform pg_temp.chk('B가 신고 목록을 직접 읽으려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', 'select * from public.reports'));
    perform pg_temp.chk('B가 신고를 직접 끼워 넣으려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.reports (reporter_id, target_type, target_id, reason) values (%L, ''post'', ''x'', ''spam'')', b)));
    perform pg_temp.chk('B가 관리자 함수(회원 목록) 호출 시도', 'ERROR:%forbidden%',
      pg_temp.attempt(b, 'authenticated', 'select * from public.admin_list_users(''''::text)'));
    perform pg_temp.chk('B가 관리자 함수(회원 차단) 호출 시도', 'ERROR:%forbidden%',
      pg_temp.attempt(b, 'authenticated', format('select public.admin_set_ban(%L, true)', a)));
    perform pg_temp.chk('B가 관리자 함수(글 숨기기) 호출 시도', 'ERROR:%forbidden%',
      pg_temp.attempt(b, 'authenticated', format('select public.admin_set_hidden(''post'', %L, true)', post_a)));
    perform pg_temp.chk('B가 남의 좋아요 기록을 엿보기', 'ROWS 0',
      pg_temp.attempt(b, 'authenticated', 'select * from public.post_likes'));
    perform pg_temp.chk('B가 A 이름으로 좋아요 누르기 시도', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.post_likes (post_id, user_id) values (%L, %L)', post_a, a)));
    perform pg_temp.chk('B가 채팅방을 직접 만들려는 시도(관리자 전용)', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', 'insert into public.chat_rooms (slug, name) values (''hack-room'', ''x'')'));

    ------------------------------------------------ [공격] 로그인 안 한 방문자
    perform pg_temp.chk('방문자가 게시글 작성 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(null, 'anon', 'insert into public.posts (title, body) values (''anon post'', ''anon body text here'')'));
    perform pg_temp.chk('방문자가 채팅 내용을 읽으려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(null, 'anon', 'select * from public.chat_messages'));
    perform pg_temp.chk('방문자가 관리자 함수 호출 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(null, 'anon', 'select * from public.admin_list_users(''''::text)'));
    perform pg_temp.chk('방문자가 회원 이메일/권한 칸을 읽으려는 시도', 'ERROR:%permission denied%',
      pg_temp.attempt(null, 'anon', 'select role, is_banned from public.profiles'));

    ------------------------------------------------ [정상] 막히면 안 되는 것들
    perform pg_temp.chk('방문자가 게시글 목록 보기(공개)', 'ROWS 2',
      pg_temp.attempt(null, 'anon', 'select id, title from public.posts'));
    perform pg_temp.chk('A가 내 채팅 메시지 수정', 'ROWS 1',
      pg_temp.attempt(a, 'authenticated', format('update public.chat_messages set body = ''edited by A'' where id = %s', msg_a)));
    perform pg_temp.chk('A가 내 게시글 수정', 'ROWS 1',
      pg_temp.attempt(a, 'authenticated', format('update public.posts set title = ''A edited title'' where id = %L', post_a)));
    perform pg_temp.chk('B가 내 프로필 소개글 수정', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', format('update public.profile_private set bio = ''hi from B'' where user_id = %L', b)));
    perform pg_temp.chk('B가 내 닉네임을 이미 있는 닉네임으로 변경 시도', 'ERROR:%duplicate key%',
      pg_temp.attempt(b, 'authenticated', format('update public.profiles set username = (select username from public.profiles where id = %L) where id = %L', a, b)));
    perform pg_temp.chk('B가 채팅 메시지 작성(내 이름)', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', format('insert into public.chat_messages (room_id, body) values (%L, ''hello from B'')', room)));
    perform pg_temp.chk('B가 A의 글에 좋아요', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', format('insert into public.post_likes (post_id) values (%L)', post_a)));
    perform pg_temp.chk('B가 같은 글에 좋아요 중복 시도', 'ERROR:%duplicate key%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.post_likes (post_id) values (%L)', post_a)));
    perform pg_temp.chk('좋아요 숫자가 서버에서 자동으로 2가 됨', '2',
      (select like_count::text from public.posts where id = post_a));
    perform pg_temp.chk('B가 A의 댓글에 대댓글', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', format('insert into public.comments (post_id, parent_id, body) values (%L, %L, ''reply from B'')', post_a, comment_a)));
    select id into reply_b from public.comments where author_id = b and parent_id = comment_a;
    perform pg_temp.chk('대댓글에 또 대댓글(2단계)은 거절', 'ERROR:%invalid_parent%',
      pg_temp.attempt(a, 'authenticated', format('insert into public.comments (post_id, parent_id, body) values (%L, %L, ''too deep'')', post_a, reply_b)));
    perform pg_temp.chk('댓글 수가 서버에서 자동으로 2가 됨', '2',
      (select comment_count::text from public.posts where id = post_a));
    perform pg_temp.chk('A가 내 글 사진에 "남의 폴더" 경로를 넣으면 거절', 'ERROR:%invalid_image_path%',
      pg_temp.attempt(a, 'authenticated', format('update public.posts set images = array[%L] where id = %L', b || '/stolen.jpg', post_a)));
    perform pg_temp.chk('A가 내 글 사진에 "내 폴더" 경로는 허용', 'ROWS 1',
      pg_temp.attempt(a, 'authenticated', format('update public.posts set images = array[%L] where id = %L', a || '/mine.jpg', post_a)));
    perform pg_temp.chk('외부 주소(URL)를 사진으로 넣으면 거절', 'ERROR:%invalid_image_path%',
      pg_temp.attempt(a, 'authenticated', format('update public.posts set images = array[''https://evil.example/x.jpg''] where id = %L', post_a)));

    ------------------------------------------------ [신고 / 관리자]
    perform pg_temp.chk('B가 A의 메시지를 신고', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', format('select public.report_content(''message'', %L, ''spam'')', msg_a::text)));
    perform pg_temp.chk('내 글을 내가 신고하는 것은 거절', 'ERROR:%invalid_input%',
      pg_temp.attempt(b, 'authenticated', format('select public.report_content(''post'', %L, ''spam'')', post_b::text)));
    perform pg_temp.chk('관리자가 신고 목록 조회', 'ROWS 1',
      pg_temp.attempt(adm, 'authenticated', 'select * from public.admin_list_reports(''open''::text)'));
    perform pg_temp.chk('관리자가 다른 사람 메시지 삭제(운영)', 'ROWS 1',
      pg_temp.attempt(adm, 'authenticated', format('delete from public.chat_messages where id = %s', msg_a2)));
    perform pg_temp.chk('관리자가 글 숨기기', 'ROWS 1',
      pg_temp.attempt(adm, 'authenticated', format('select public.admin_set_hidden(''post'', %L, true)', post_a)));
    perform pg_temp.chk('숨겨진 글은 방문자에게 안 보임', 'ROWS 1',
      pg_temp.attempt(null, 'anon', 'select id from public.posts'));
    perform pg_temp.chk('숨겨진 글도 작성자 본인에게는 보임', 'ROWS 1',
      pg_temp.attempt(a, 'authenticated', format('select id from public.posts where id = %L', post_a)));
    perform pg_temp.chk('관리자가 다른 관리자/자기 자신 차단은 거절', 'ERROR:%invalid_input%',
      pg_temp.attempt(adm, 'authenticated', format('select public.admin_set_ban(%L, true)', adm)));
    perform pg_temp.chk('관리자가 B 차단', 'ROWS 1',
      pg_temp.attempt(adm, 'authenticated', format('select public.admin_set_ban(%L, true)', b)));
    perform pg_temp.chk('차단된 B는 채팅 작성 불가', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.chat_messages (room_id, body) values (%L, ''spam'')', room)));
    perform pg_temp.chk('차단된 B는 게시글 작성 불가', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', 'insert into public.posts (title, body) values (''banned post'', ''banned body text'')'));
    perform pg_temp.chk('차단된 B는 좋아요 불가', 'ERROR:%row-level security%',
      pg_temp.attempt(b, 'authenticated', format('insert into public.post_likes (post_id) values (%L)', post_b)));
    perform pg_temp.chk('차단된 B는 관리자 함수 호출 불가', 'ERROR:%forbidden%',
      pg_temp.attempt(b, 'authenticated', 'select * from public.admin_list_users(''''::text)'));
    perform pg_temp.chk('관리자가 B 차단 해제', 'ROWS 1',
      pg_temp.attempt(adm, 'authenticated', format('select public.admin_set_ban(%L, false)', b)));

    ------------------------------------------------ [도배 방지]
    for i in 1..9 loop
      got := pg_temp.attempt(a, 'authenticated',
        format('insert into public.posts (title, body) values (%L, ''spam body spam body'')', 'spam post ' || i));
      exit when got <> 'ROWS 1';
    end loop;
    perform pg_temp.chk('A가 1시간 안에 글 10개까지는 작성 가능', 'ROWS 1', got);
    perform pg_temp.chk('11번째 글은 도배 방지로 거절', 'ERROR:%rate_limit%',
      pg_temp.attempt(a, 'authenticated', 'insert into public.posts (title, body) values (''one too many'', ''spam body spam body'')'));

    ------------------------------------------------ [가입 데이터 조작 방어]
    insert into auth.users (id, email, raw_user_meta_data) values
      (m1, 'm1@test.invalid', '{"username":"x y!!<script>","role":"admin","language":"xx","country":"kr"}'::jsonb),
      (m2, 'm2@test.invalid', jsonb_build_object('username', (select upper(username) from public.profiles where id = a)));
    perform pg_temp.chk('가입 시 role=admin 을 끼워 넣어도 일반 회원', 'user',
      (select role from public.profiles where id = m1));
    perform pg_temp.chk('이상한 닉네임은 안전한 자동 닉네임으로 대체', 'traveler\_%',
      (select username from public.profiles where id = m1));
    perform pg_temp.chk('지원하지 않는 언어(xx)는 en 으로 대체', 'en',
      (select language from public.profiles where id = m1));
    perform pg_temp.chk('국가 코드는 대문자로 정리', 'KR',
      (select country from public.profiles where id = m1));
    perform pg_temp.chk('대소문자만 다른 닉네임 중복 가입은 자동 닉네임으로 대체', 'traveler\_%',
      (select username from public.profiles where id = m2));

    ------------------------------------------------ [저장소(사진) 규칙]
    -- Supabase 는 사진 보관함 테이블에서 "직접 삭제"를 막아 둡니다(안전장치).
    -- 그래서 이 점검은 시도 결과만 기록한 뒤, 이 구간 전체를 일부러 "취소(롤백)"해서 흔적이 남지 않게 합니다.
    begin
      s1 := pg_temp.attempt(b, 'authenticated', format('insert into storage.objects (bucket_id, name) values (''post-images'', %L)', a || '/evil.jpg'));
      s2 := pg_temp.attempt(b, 'authenticated', format('insert into storage.objects (bucket_id, name) values (''post-images'', %L)', b || '/ok.jpg'));
      s3 := pg_temp.attempt(null, 'anon', 'insert into storage.objects (bucket_id, name) values (''post-images'', ''x/y.jpg'')');
      raise exception 'undo_storage_test';
    exception when others then
      if sqlerrm <> 'undo_storage_test' then raise; end if;
    end;
    perform pg_temp.chk('B가 A의 폴더에 사진 업로드 시도', 'ERROR:%row-level security%', s1);
    perform pg_temp.chk('B가 내 폴더에 사진 업로드', 'ROWS 1', s2);
    perform pg_temp.chk('방문자가 사진 업로드 시도', 'ERROR:%', s3);

    ------------------------------------------------ [전체 구조 점검]
    select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
    perform pg_temp.chk('RLS 가 꺼져 있는 테이블이 하나도 없음', 'none', coalesce(bad, 'none'));

    select string_agg(c.relname, ', ') into bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
      and c.relname <> 'reports'
      and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);
    perform pg_temp.chk('정책이 하나도 없는 테이블이 없음(reports 제외)', 'none', coalesce(bad, 'none'));

    ------------------------------------------------ [회원 탈퇴]
    perform pg_temp.chk('B가 회원 탈퇴', 'ROWS 1',
      pg_temp.attempt(b, 'authenticated', 'select public.delete_my_account()'));
    perform pg_temp.chk('탈퇴하면 B의 프로필과 글도 함께 삭제', '0',
      (select (count(*))::text from public.profiles where id = b) );
    perform pg_temp.chk('탈퇴하면 B의 게시글도 함께 삭제', '0',
      (select (count(*))::text from public.posts where author_id = b));
    perform pg_temp.chk('방문자는 회원 탈퇴 함수를 호출할 수 없음', 'ERROR:%permission denied%',
      pg_temp.attempt(null, 'anon', 'select public.delete_my_account()'));
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    insert into _r (test, expected, got, ok) values ('점검 중 예상하지 못한 오류', '(없음)', sqlerrm, false);
    return;   -- 안쪽 블록의 모든 변경은 자동으로 취소됨
  end;

  -- 임시 회원 정리 (글/댓글/메시지/좋아요/신고는 연쇄 삭제)
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a, b, adm, m1, m2);
  delete from public.chat_rooms where slug = 'selftest';
end $$;

select 0 as no, 'SUMMARY' as test, 'all PASS' as expected,
       (count(*) filter (where ok))::text || ' / ' || count(*)::text || ' passed' as got,
       case when bool_and(ok) then 'PASS' else 'FAIL' end as result
from _r
union all
select n, test, expected, got, case when ok then 'PASS' else 'FAIL' end from _r
order by no;
