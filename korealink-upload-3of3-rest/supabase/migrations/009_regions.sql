-- 009_regions.sql | 전국 서비스: 글/모임에 "지역(시·도)" 칸 추가 (여러 번 실행해도 안전)
--   지역 코드 17개는 한국관광공사 이벤트 함수(kto-events)와 같은 값입니다.
--   기존 글/모임은 모두 부산에서 만들어진 것이라 'busan' 으로 채웁니다. 새 글/모임은 이용자가 고른 지역(비워둘 수도 있음)이 들어갑니다.

alter table public.posts   add column if not exists region text;
alter table public.meetups add column if not exists region text;

update public.posts   set region = 'busan' where region is null and created_at < now();
update public.meetups set region = 'busan' where region is null and created_at < now();

alter table public.posts   drop constraint if exists posts_region_valid;
alter table public.posts   add constraint posts_region_valid check (region is null or region in
  ('seoul','busan','incheon','daegu','daejeon','gwangju','ulsan','sejong','gyeonggi','gangwon','chungbuk','chungnam','jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju'));
alter table public.meetups drop constraint if exists meetups_region_valid;
alter table public.meetups add constraint meetups_region_valid check (region is null or region in
  ('seoul','busan','incheon','daegu','daejeon','gwangju','ulsan','sejong','gyeonggi','gangwon','chungbuk','chungnam','jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju'));

create index if not exists posts_region_created_idx   on public.posts   (region, created_at desc);
create index if not exists meetups_region_starts_idx  on public.meetups (region, starts_at);

-- 쓰기 권한: 기존처럼 "열 단위"로만 허용 (region 칸 추가). 남의 글/모임은 RLS 가 그대로 막습니다.
grant insert (region) on public.posts   to authenticated;
grant update (region) on public.posts   to authenticated;
grant insert (region) on public.meetups to authenticated;
grant update (region) on public.meetups to authenticated;
