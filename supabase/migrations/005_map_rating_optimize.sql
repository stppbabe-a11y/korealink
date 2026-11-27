-- =====================================================================
-- 005_map_rating_optimize.sql | 지도 위치 + 별점 + 데이터/사진 절약
-- 실행 방법: SQL Editor 에서 이 파일 전체를 붙여넣고 Run (여러 번 실행해도 안전)
--   * 위치: place_name(장소 이름), lat/lng(좌표)
--   * 별점: rating 1~5 (글쓴이가 직접 줌, 선택 사항)
--   * summary: 목록에서는 글 전체 대신 앞 140자만 받아 데이터를 아낌
--   * 사진 저장소 용량 제한을 낮춰서(앱이 미리 줄여서 올림) 무료 한도를 오래 쓰게 함
-- =====================================================================

alter table public.posts add column if not exists place_name text;
alter table public.posts add column if not exists lat double precision;
alter table public.posts add column if not exists lng double precision;
alter table public.posts add column if not exists rating smallint;

-- 목록용 요약: 서버가 자동으로 계산하는 칸 (앱이 직접 쓸 수 없음)
alter table public.posts add column if not exists summary text
  generated always as (left(body, 140)) stored;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_rating_chk') then
    alter table public.posts add constraint posts_rating_chk check (rating is null or rating between 1 and 5);
  end if;
  -- 위도/경도는 "둘 다 있거나 둘 다 없거나" + 올바른 범위 (다시 실행해도 안전하게 교체)
  alter table public.posts drop constraint if exists posts_geo_chk;
  alter table public.posts add constraint posts_geo_chk check (
    (lat is null and lng is null)
    or (lat is not null and lng is not null and lat between -90 and 90 and lng between -180 and 180));
  if not exists (select 1 from pg_constraint where conname = 'posts_place_len') then
    alter table public.posts add constraint posts_place_len check (
      place_name is null or (char_length(btrim(place_name)) between 1 and 100 and lat is not null));
  end if;
end $$;

-- 지도에 모아 보기용 (좌표가 있는 글만 색인)
create index if not exists posts_geo_idx on public.posts (created_at desc) where lat is not null;

-- 새 칸의 권한: 글쓴이만 입력/수정 (summary 는 서버 계산이라 쓰기 권한 없음)
grant insert (place_name, lat, lng, rating) on public.posts to authenticated;
grant update (place_name, lat, lng, rating) on public.posts to authenticated;

-- 내용을 고치면 updated_at 갱신 (새 칸 포함)
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update of title, body, category, area, images, place_name, lat, lng, rating on public.posts
  for each row execute function public.touch_updated_at();

-- 사진 저장소 한도 낮춤: 게시글 사진 1MB, 프로필 사진 300KB (앱이 WebP 로 줄여서 올립니다)
update storage.buckets set file_size_limit = 1048576 where id = 'post-images';
update storage.buckets set file_size_limit = 307200  where id = 'avatars';
