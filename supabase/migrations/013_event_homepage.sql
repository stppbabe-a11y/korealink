-- =====================================================================
-- 013_event_homepage.sql | 행사 카드를 누르면 그 행사의 공식 홈페이지로 바로 가도록 주소 칸을 추가합니다.
--   주소는 kto-events 서버 함수가 한국관광공사 상세정보에서 가져와 채웁니다. (함수도 새 버전으로 다시 배포해야 채워집니다)
--   NULL = 아직 안 가져옴 / 빈 글자('') = 한국관광공사에 홈페이지 없음(구글 검색으로 대체)
-- 여러 번 실행해도 안전합니다.
-- =====================================================================
alter table public.kto_events add column if not exists homepage text;
alter table public.kto_events drop constraint if exists kto_events_homepage_chk;
alter table public.kto_events add constraint kto_events_homepage_chk
  check (homepage is null or homepage = '' or (homepage ~* '^https?://[^[:space:]<>"]+$' and length(homepage) <= 300));
