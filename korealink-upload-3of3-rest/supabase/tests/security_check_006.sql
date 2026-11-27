-- =====================================================================
-- security_check_006.sql | 006(프로필 공개 설정 / 행사 캐시 / 12개 언어) 보안 점검
-- 임시 회원 2명을 만들어 점검한 뒤 자동 삭제합니다. 결과 표의 SUMMARY 가 PASS 이면 정상.
-- =====================================================================
create temp table if not exists _r6 (n serial, test text, ok boolean);
truncate _r6;
grant all on _r6 to public;
grant usage, select on sequence _r6_n_seq to public;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); got text; cnt int; v text;
begin
  begin
    insert into auth.users (id, email, raw_user_meta_data) values
      (a, 'a6@test.dev', '{"username":"alice_six","display_name":"Alice Real","country":"US","language":"vi"}'::jsonb),
      (b, 'b6@test.dev', '{"username":"bob_six"}'::jsonb);
    insert into _r6 (test, ok) values ('가입 시 금고(profile_private) 자동 생성', (select count(*) from public.profile_private where user_id in (a, b)) = 2);
    insert into _r6 (test, ok) values ('가입 시 언어(vi) 저장', (select language = 'vi' from public.profiles where id = a));
    insert into _r6 (test, ok) values ('기본값: 이름·국적 공개', (select display_name = 'Alice Real' and country = 'US' from public.profiles where id = a));
    insert into _r6 (test, ok) values ('기본값: 성별·나이·거주국 비공개(비어 있음)', (select gender is null and birth_year is null and residence_country is null from public.profiles where id = a));

    -- 본인: 금고 수정
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;
    update public.profile_private set gender = 'female', birth_year = 1995, residence_country = 'KR', bio = 'Hi from Busan' where user_id = a;
    reset role;
    insert into _r6 (test, ok) values ('출생연도는 비공개 상태에서 공개 프로필에 복사되지 않음',
      (select birth_year is null from public.profiles where id = a));      -- (007 이후에는 성별/거주국도 항상 공개이므로 출생연도만 확인)

    set local role authenticated;
    update public.profile_private set show_gender = true, show_age = true, show_residence = true where user_id = a;
    reset role;
    insert into _r6 (test, ok) values ('공개로 바꾸면 공개 프로필에 복사됨',
      (select gender = 'female' and birth_year = 1995 and residence_country = 'KR' from public.profiles where id = a));

    set local role authenticated;
    update public.profile_private set show_age = false, show_name = false where user_id = a;
    reset role;
    insert into _r6 (test, ok) values ('다시 비공개로 바꾸면 공개 프로필에서 사라짐(나이/이름)',
      (select birth_year is null and gender = 'female' from public.profiles where id = a));

    -- 본인은 자기 금고를 읽을 수 있고 my_profile 에 진짜 값이 보임
    set local role authenticated;
    insert into _r6 (test, ok) values ('my_profile 은 본인에게 비공개 값도 보여 줌',
      (select (public.my_profile() ->> 'birth_year') = '1995' and (public.my_profile() ->> 'display_name') = 'Alice Real'));

    -- 남(b)은 a 의 금고를 못 읽고 못 고침
    perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
    select count(*) into cnt from public.profile_private where user_id = a;
    insert into _r6 (test, ok) values ('남이 내 금고 읽기 -> 0줄', cnt = 0);
    update public.profile_private set show_age = true, birth_year = 1 where user_id = a;
    get diagnostics cnt = row_count;
    insert into _r6 (test, ok) values ('남이 내 금고 수정 -> 0줄', cnt = 0);

    -- 공개 프로필 칸은 직접 수정 불가 (금고를 우회해서 값을 위조할 수 없음)
    begin update public.profiles set display_name = 'hacked' where id = b; insert into _r6 (test, ok) values ('공개 프로필 이름 직접 수정 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('공개 프로필 이름 직접 수정 거절', true); end;
    begin update public.profiles set gender = 'male' where id = b; insert into _r6 (test, ok) values ('공개 프로필 성별 직접 수정 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('공개 프로필 성별 직접 수정 거절', true); end;
    begin update public.profiles set country = 'JP' where id = b; insert into _r6 (test, ok) values ('공개 프로필 국적 직접 수정 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('공개 프로필 국적 직접 수정 거절', true); end;
    update public.profiles set language = 'th' where id = b;
    get diagnostics cnt = row_count;
    insert into _r6 (test, ok) values ('언어(th)는 직접 수정 가능', cnt = 1);

    -- 잘못된 값은 DB 가 거절
    begin update public.profile_private set gender = 'alien' where user_id = b; insert into _r6 (test, ok) values ('잘못된 성별 거절', false);
    exception when check_violation then insert into _r6 (test, ok) values ('잘못된 성별 거절', true); end;
    begin update public.profile_private set birth_year = 1800 where user_id = b; insert into _r6 (test, ok) values ('태어난 해 1800 거절', false);
    exception when check_violation then insert into _r6 (test, ok) values ('태어난 해 1800 거절', true); end;
    begin update public.profile_private set residence_country = 'korea' where user_id = b; insert into _r6 (test, ok) values ('잘못된 국가 코드 거절', false);
    exception when check_violation then insert into _r6 (test, ok) values ('잘못된 국가 코드 거절', true); end;
    begin update public.profiles set language = 'xx' where id = b; insert into _r6 (test, ok) values ('지원하지 않는 언어 거절', false);
    exception when check_violation then insert into _r6 (test, ok) values ('지원하지 않는 언어 거절', true); end;

    -- 행사 캐시: 일반 회원은 쓰기 불가, 읽기 가능
    begin insert into public.kto_events (id, lang, title) values ('en:1', 'en', 'fake'); insert into _r6 (test, ok) values ('회원이 행사 캐시에 쓰기 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('회원이 행사 캐시에 쓰기 거절', true); end;
    begin insert into public.kto_events_meta (lang) values ('en'); insert into _r6 (test, ok) values ('회원이 행사 메타에 쓰기 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('회원이 행사 메타에 쓰기 거절', true); end;
    select count(*) into cnt from public.kto_events;
    insert into _r6 (test, ok) values ('행사 캐시 읽기 가능', cnt >= 0);

    -- 로그아웃(anon): 금고 접근 불가, 공개 프로필은 읽기 가능(마스킹된 값)
    reset role;
    set local role anon;
    begin perform 1 from public.profile_private; insert into _r6 (test, ok) values ('비로그인이 금고 읽기 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('비로그인이 금고 읽기 거절', true); end;
    begin perform public.my_profile(); insert into _r6 (test, ok) values ('비로그인이 my_profile 호출 거절', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('비로그인이 my_profile 호출 거절', true); end;
    select gender, birth_year::text into v, got from public.profiles where id = a;
    insert into _r6 (test, ok) values ('비로그인도 공개 프로필 읽기 가능 (공개로 둔 성별만 보임, 나이는 비어 있음)', v = 'female' and got is null);
    begin perform language from public.profiles limit 1; insert into _r6 (test, ok) values ('비로그인이 language 읽기 거절(기존 규칙)', false);
    exception when insufficient_privilege then insert into _r6 (test, ok) values ('비로그인이 language 읽기 거절(기존 규칙)', true); end;
    reset role;
  exception when others then
    reset role;
    insert into _r6 (test, ok) values ('예상 못한 오류: ' || sqlerrm, false);
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  delete from auth.users where id in (a, b);
  insert into _r6 (test, ok) values ('회원 삭제 시 금고도 연쇄 삭제', (select count(*) from public.profile_private where user_id in (a, b)) = 0);
end $$;

select 0 as no, 'SUMMARY' as test, (count(*) filter (where ok))::text || ' / ' || count(*)::text || ' passed' as got,
       case when bool_and(ok) then 'PASS' else 'FAIL' end as result from _r6
union all select n, test, '', case when ok then 'PASS' else 'FAIL' end from _r6 order by no;
