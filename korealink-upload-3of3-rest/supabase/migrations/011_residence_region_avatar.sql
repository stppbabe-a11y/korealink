-- =====================================================================
-- 011_residence_region_avatar.sql
--   1) "거주 국가" -> "거주 지역"(한국 17개 시·도 또는 abroad=한국 밖). 여행 팁에서 내 지역 별표에 사용
--   2) 사진 대신 아바타: 아바타 설정값(avatar_cfg) 한 칸만 저장 (예: f2.s3.h4.c1.b0.e2.m1.k2.a0)
-- 여러 번 실행해도 안전합니다. (006, 007, 010 을 먼저 실행한 상태여야 합니다)
-- =====================================================================

alter table public.profile_private add column if not exists residence_region text;
alter table public.profiles        add column if not exists residence_region text;
alter table public.profiles        add column if not exists avatar_cfg text;

alter table public.profile_private drop constraint if exists pp_residence_region_chk;
alter table public.profile_private add constraint pp_residence_region_chk check (residence_region is null or residence_region in
  ('seoul','busan','incheon','daegu','daejeon','gwangju','ulsan','sejong','gyeonggi','gangwon','chungbuk','chungnam',
   'jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju','abroad'));
alter table public.profiles drop constraint if exists profiles_residence_region_chk;
alter table public.profiles add constraint profiles_residence_region_chk check (residence_region is null or residence_region in
  ('seoul','busan','incheon','daegu','daejeon','gwangju','ulsan','sejong','gyeonggi','gangwon','chungbuk','chungnam',
   'jeonbuk','jeonnam','gyeongbuk','gyeongnam','jeju','abroad'));

-- 아바타 설정값은 영문 소문자/숫자/점만, 60자 이하 (그 밖의 글자는 서버가 거절)
alter table public.profiles drop constraint if exists profiles_avatar_cfg_chk;
alter table public.profiles add constraint profiles_avatar_cfg_chk check (avatar_cfg is null or avatar_cfg ~ '^[a-z0-9.]{1,60}$');

-- 금고 -> 공개 프로필 복사 (007 규칙 그대로 + 거주 지역)
create or replace function public.sync_public_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles p set
    display_name      = new.display_name,
    bio               = new.bio,
    country           = new.country,
    residence_country = new.residence_country,
    residence_region  = new.residence_region,
    gender            = new.gender,
    birth_year        = case when new.show_age then new.birth_year end
  where p.id = new.user_id;
  new.updated_at := now();
  return new;
end;
$$;

-- 내 프로필 한 번에 가져오기 (거주 지역 추가)
create or replace function public.my_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(p) || jsonb_build_object(
    'display_name', pp.display_name, 'bio', pp.bio, 'country', pp.country,
    'residence_country', pp.residence_country, 'residence_region', pp.residence_region,
    'gender', pp.gender, 'birth_year', pp.birth_year,
    'show_name', pp.show_name, 'show_bio', pp.show_bio, 'show_country', pp.show_country,
    'show_residence', pp.show_residence, 'show_gender', pp.show_gender, 'show_age', pp.show_age)
  from public.profiles p
  join public.profile_private pp on pp.user_id = p.id
  where p.id = (select auth.uid());
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- 권한: 거주 지역은 금고에서만 수정, 아바타는 본인 행만 (RLS 가 남의 행을 막음)
grant update (residence_region) on public.profile_private to authenticated;
grant select (residence_region, avatar_cfg) on public.profiles to anon, authenticated;
grant update (avatar_cfg) on public.profiles to authenticated;
