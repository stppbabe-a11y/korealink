-- =====================================================================
-- security_check_010.sql | 010(게스트 채팅 / 채팅 첨부 / 관심사) 점검. 임시 회원을 만들었다가 자동 정리합니다.
-- 마지막 줄 SUMMARY 가 PASS 면 정상.
-- =====================================================================
create temp table if not exists _r10 (n serial, test text, ok boolean);
truncate _r10;
grant all on _r10 to public;
grant usage, select on sequence _r10_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); g uuid := gen_random_uuid();
  room uuid; pid uuid; ok1 boolean; cnt int; v text[]; nm text; un text;
  ca text := json_build_object('sub', a, 'role', 'authenticated')::text;
  cb text := json_build_object('sub', b, 'role', 'authenticated')::text;
  cg text;
begin
  cg := json_build_object('sub', g, 'role', 'authenticated', 'is_anonymous', true)::text;
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a10@test.dev', '{"username":"chat_a"}'::jsonb), (b, 'b10@test.dev', '{"username":"chat_b"}'::jsonb);
    insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values (g, null, '{"username":"hacker1"}'::jsonb, true);
    select id into room from public.chat_rooms where is_active limit 1;

    select username, display_name into un, nm from public.profiles where id = g;
    insert into _r10 values (default, '게스트 계정은 guest_ 임시 닉네임 + "Guest XXXX" 표시이름이 자동으로 붙는다 (가입 때 넘긴 이름은 무시)', un like 'guest\_%' and nm like 'Guest %');

    -- 회원이 글을 하나 써 둠 (게스트 시도 대상)
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    insert into public.posts (author_id, title, body, category) values (a, 'Cafe tip', 'Nice cafe in the city center', 'food') returning id into pid;
    reset role;

    -- ===== 게스트: 채팅 글자만 가능 =====
    perform set_config('request.jwt.claims', cg, true);
    set local role authenticated;
    begin insert into public.chat_messages (room_id, author_id, body) values (room, g, 'hello from guest'); ok1 := true; exception when others then ok1 := false; end;
    insert into _r10 values (default, '게스트는 채팅 글자 메시지를 보낼 수 있다', ok1);
    insert into _r10 values (default, '게스트는 채팅 메시지를 읽을 수 있다', exists (select 1 from public.chat_messages where room_id = room));
    begin insert into public.chat_messages (room_id, author_id, body, lat, lng, place_name) values (room, g, '', 37.5, 127.0, 'x'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 위치 첨부 메시지를 보낼 수 없다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, image) values (room, g, '', g::text || '/a.webp'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 사진 첨부 메시지를 보낼 수 없다', ok1);
    begin insert into public.posts (author_id, title, body, category) values (g, 'Guest post', 'Guest writes a post here', 'food'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 글을 쓸 수 없다', ok1);
    begin insert into public.comments (post_id, author_id, body) values (pid, g, 'guest comment'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 댓글을 쓸 수 없다', ok1);
    begin insert into public.post_likes (post_id, user_id) values (pid, g); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 좋아요를 누를 수 없다', ok1);
    begin
      insert into public.meetups (title, description, category, region, starts_at, place_name, lat, lng, capacity)
        values ('Guest meetup', 'Guest tries to host a meetup', 'food', 'seoul', now() + interval '2 days', 'Somewhere', 37.5, 127.0, 4); ok1 := false;
    exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 모임을 만들 수 없다', ok1);
    begin insert into storage.objects (bucket_id, name) values ('post-images', g::text || '/n1.webp'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '게스트는 사진 파일을 올릴 수 없다', ok1);
    reset role;

    -- ===== 회원: 첨부 가능 =====
    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    begin insert into public.chat_messages (room_id, author_id, body, image) values (room, a, '', a::text || '/n1.webp'); ok1 := true; exception when others then ok1 := false; end;
    insert into _r10 values (default, '회원은 내 폴더 사진만 첨부한 메시지를 보낼 수 있다 (글 없이)', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, image) values (room, a, '', b::text || '/n1.webp'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '남의 폴더 사진 경로는 거부된다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, image) values (room, a, '', 'https://evil.example/x.png'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '외부 주소(URL)는 사진 경로로 거부된다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, lat, lng, place_name) values (room, a, '', 35.15, 129.06, 'Haeundae'); ok1 := true; exception when others then ok1 := false; end;
    insert into _r10 values (default, '회원은 위치만 담은 메시지를 보낼 수 있다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body) values (room, a, ''); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '글도 첨부도 없는 빈 메시지는 거부된다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, lat, lng) values (room, a, 'x', 95, 129); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '범위를 벗어난 위도(95)는 거부된다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, lat) values (room, a, 'x', 35.1); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '경도 없이 위도만 있는 위치는 거부된다', ok1);
    begin insert into public.chat_messages (room_id, author_id, body, image, lat, lng) values (room, a, 'x', a::text || '/n2.webp', 35.1, 129.0); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '사진과 위치를 한 메시지에 동시에 넣는 것은 거부된다', ok1);
    begin insert into storage.objects (bucket_id, name) values ('post-images', a::text || '/n1.webp'); ok1 := true; exception when others then ok1 := false; end;
    insert into _r10 values (default, '회원은 내 폴더에 사진 파일을 올릴 수 있다 (게스트 차단이 회원을 막지 않음)', ok1);
    begin insert into public.chat_messages (room_id, author_id, body) values (room, b, 'spoof'); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '다른 사람 이름으로 메시지를 보낼 수 없다', ok1);
    -- 관심사
    update public.profiles set interests = array['food','kculture'] where id = a;
    insert into _r10 values (default, '내 관심사를 저장할 수 있다', exists (select 1 from public.profiles where id = a and interests = array['food','kculture']));
    begin update public.profiles set interests = array['hacking'] where id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '목록에 없는 관심사는 거부된다', ok1);
    begin update public.profiles set interests = array['food','food','food','arts','arts','nightlife'] where id = a; ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '관심사 6개 이상은 거부된다', ok1);
    reset role;

    perform set_config('request.jwt.claims', cb, true);
    set local role authenticated;
    update public.profiles set interests = array['arts'] where id = a;
    get diagnostics cnt = row_count;
    reset role;
    insert into _r10 values (default, '남의 관심사는 바꿀 수 없다 (0건)', cnt = 0 and exists (select 1 from public.profiles where id = a and interests = array['food','kculture']));

    perform set_config('request.jwt.claims', '{}', true);
    set local role anon;
    select interests into v from public.profiles where id = a;
    reset role;
    insert into _r10 values (default, '로그인 안 한 방문자도 관심사(공개)를 볼 수 있다', v = array['food','kculture']);

    perform set_config('request.jwt.claims', ca, true);
    set local role authenticated;
    begin perform public.purge_old_guests(1); ok1 := false; exception when others then ok1 := true; end;
    insert into _r10 values (default, '회원은 게스트 정리 함수를 실행할 수 없다', ok1);
    reset role;

    delete from public.chat_messages where author_id in (a, g);
    delete from auth.users where id in (a, b, g);
  exception when others then
    insert into _r10 values (default, 'ERROR: ' || sqlerrm, false);
  end;
end $$;
select n, test, case when ok then 'PASS' else 'FAIL' end as result from _r10
union all select 999, 'SUMMARY', case when bool_and(ok) and count(*) > 0 then 'PASS (' || count(*) || '/' || count(*) || ')' else 'FAIL' end from _r10
order by 1;
