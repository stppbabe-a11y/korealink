-- =====================================================================
-- 006_profile_privacy_events_langs.sql
--   1) 프로필 항목별 공개/비공개 (이름·소개·국적·거주 국가·성별·나이)
--   2) 한국관광공사 행사 정보를 저장해 두는 창고(캐시) 테이블
--   3) 12개 언어 허용
-- 실행 방법: SQL Editor 에서 이 파일 전체를 붙여넣고 Run (여러 번 실행해도 안전)
--
-- [개인정보 설계 - 쉬운 설명]
--   * 진짜 값은 "profile_private" (본인만 읽고 고칠 수 있는 금고)에 보관합니다.
--   * 다른 사람이 보는 "profiles" 에는, 공개로 정한 칸만 서버가 자동으로 복사해 둡니다.
--     (비공개 칸은 비어 있음 => 앱을 해킹해도, 개발자도구(F12)로 봐도 값이 없습니다)
--   * 닉네임(username)과 프로필 사진은 항상 공개입니다 (글/댓글에 표시되는 최소 정보).
-- =====================================================================

-- ---------- 1) 본인 전용 금고 ----------
create table if not exists public.profile_private (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  display_name      text,
  bio               text,
  country           text,            -- 국적 (예: 'KR')
  residence_country text,            -- 거주 국가
  gender            text,
  birth_year        smallint,        -- 나이는 "태어난 해"만 저장 (정확한 생일은 받지 않음)
  show_name         boolean not null default true,
  show_bio          boolean not null default true,
  show_country      boolean not null default true,
  show_residence    boolean not null default false,
  show_gender       boolean not null default false,
  show_age          boolean not null default false,
  updated_at        timestamptz not null default now(),
  constraint pp_display_name_len check (display_name is null or char_length(display_name) between 1 and 40),
  constraint pp_bio_len check (bio is null or char_length(bio) <= 300),
  constraint pp_country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint pp_residence_fmt check (residence_country is null or residence_country ~ '^[A-Z]{2}$'),
  constraint pp_gender_chk check (gender is null or gender in ('female', 'male', 'nonbinary', 'other')),
  constraint pp_birth_year_chk check (birth_year is null or birth_year between 1900 and 2100)
);

-- 공개 프로필(profiles)에 새 칸 (값은 아래 트리거가 "공개로 정한 것만" 채움)
alter table public.profiles add column if not exists residence_country text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists birth_year smallint;

-- 12개 언어 허용
alter table public.profiles drop constraint if exists profiles_language_chk;
alter table public.profiles add constraint profiles_language_chk
  check (language in ('en','ko','ja','zh','zh-TW','es','fr','de','ru','vi','th','id'));

-- 금고 -> 공개 프로필 자동 복사 (공개로 정한 칸만)
create or replace function public.sync_public_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles p set
    display_name      = case when new.show_name      then new.display_name      end,
    bio               = case when new.show_bio       then new.bio               end,
    country           = case when new.show_country   then new.country           end,
    residence_country = case when new.show_residence then new.residence_country end,
    gender            = case when new.show_gender    then new.gender            end,
    birth_year        = case when new.show_age       then new.birth_year        end
  where p.id = new.user_id;
  new.updated_at := now();
  return new;
end;
$$;
-- (before 트리거로 updated_at 갱신 + after 로 복사. 한 함수에서 처리하기 위해 BEFORE 사용: profiles 행은 이미 존재)
drop trigger if exists pp_sync on public.profile_private;
create trigger pp_sync before insert or update on public.profile_private
  for each row execute function public.sync_public_profile();

-- 이미 가입한 회원의 값을 금고로 옮김 (기존에 공개였던 이름/소개/국적은 계속 공개)
insert into public.profile_private (user_id, display_name, bio, country)
select id, display_name, bio, country from public.profiles
on conflict (user_id) do nothing;

-- 새 회원 가입 시 금고도 함께 만들기 (+ 12개 언어)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text  := meta ->> 'username';
  v_display  text  := nullif(btrim(coalesce(meta ->> 'display_name', meta ->> 'full_name', meta ->> 'name', '')), '');
  v_country  text  := upper(nullif(meta ->> 'country', ''));
  v_lang     text  := coalesce(nullif(meta ->> 'language', ''), 'en');
  v_fallback text  := 'traveler_' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  if v_username is null
     or v_username !~ '^[A-Za-z0-9_]{3,20}$'
     or exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := v_fallback;
  end if;
  if v_display is not null then v_display := left(v_display, 40); end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  if v_lang not in ('en','ko','ja','zh','zh-TW','es','fr','de','ru','vi','th','id') then v_lang := 'en'; end if;

  begin
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_username, coalesce(v_display, v_username), v_country, v_lang);
  exception when unique_violation then
    -- 동시에 같은 닉네임으로 가입한 경우: 자동 닉네임으로 대신 저장 (가입이 막히지 않게)
    v_username := v_fallback;
    insert into public.profiles (id, username, display_name, country, language)
    values (new.id, v_username, coalesce(v_display, v_username), v_country, v_lang);
  end;
  insert into public.profile_private (user_id, display_name, country)
  values (new.id, coalesce(v_display, v_username), v_country);
  return new;
end;
$$;

-- 내 프로필(금고 값 포함)을 한 번에 가져오기: 본인만 호출 가능
create or replace function public.my_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select to_jsonb(p) || jsonb_build_object(
    'display_name', pp.display_name, 'bio', pp.bio, 'country', pp.country,
    'residence_country', pp.residence_country, 'gender', pp.gender, 'birth_year', pp.birth_year,
    'show_name', pp.show_name, 'show_bio', pp.show_bio, 'show_country', pp.show_country,
    'show_residence', pp.show_residence, 'show_gender', pp.show_gender, 'show_age', pp.show_age)
  from public.profiles p
  join public.profile_private pp on pp.user_id = p.id
  where p.id = (select auth.uid());
$$;

-- ---------- 권한 / 보안 규칙 ----------
alter table public.profile_private enable row level security;
revoke all on public.profile_private from anon, authenticated;
grant select on public.profile_private to authenticated;
grant update (display_name, bio, country, residence_country, gender, birth_year,
              show_name, show_bio, show_country, show_residence, show_gender, show_age)
  on public.profile_private to authenticated;

drop policy if exists pp_select_own on public.profile_private;
create policy pp_select_own on public.profile_private for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists pp_update_own on public.profile_private;
create policy pp_update_own on public.profile_private for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 공개 프로필: 새 칸을 읽을 수 있게 + "공개 칸"은 직접 못 고치게(금고를 통해서만 변경)
revoke update (display_name, bio, country) on public.profiles from authenticated;
grant select (residence_country, gender, birth_year) on public.profiles to anon, authenticated;

revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- ---------- 2) 한국관광공사 행사 캐시 ----------
--   Edge Function(서버)이 하루 몇 번만 한국관광공사에서 받아 와서 저장하고, 앱은 여기서 읽기만 합니다.
--   => 공공데이터 호출 횟수(하루 한도)와 서버 비용을 아낍니다. 인증키는 이 DB 가 아니라 Edge Function 비밀값에만 있습니다.
create table if not exists public.kto_events (
  id         text not null,                -- <언어>:<contentid>
  lang       text not null,
  title      text not null,
  addr       text,
  start_date date,
  end_date   date,
  region     text,                         -- 'busan','seoul',... (지역 필터용)
  lat        double precision,
  lng        double precision,
  tel        text,
  fetched_at timestamptz not null default now(),
  primary key (id),
  constraint kto_events_lang_chk check (lang in ('en','ko','ja','zh','zh-TW','de','fr','es','ru'))
);
create index if not exists kto_events_lang_end_idx on public.kto_events (lang, end_date);

create table if not exists public.kto_events_meta (
  lang       text primary key,
  fetched_at timestamptz not null default now(),
  ok         boolean not null default true,
  message    text
);

alter table public.kto_events enable row level security;
alter table public.kto_events_meta enable row level security;
revoke all on public.kto_events, public.kto_events_meta from anon, authenticated;
grant select on public.kto_events, public.kto_events_meta to anon, authenticated;
drop policy if exists kto_events_read on public.kto_events;
create policy kto_events_read on public.kto_events for select to anon, authenticated using (true);
drop policy if exists kto_events_meta_read on public.kto_events_meta;
create policy kto_events_meta_read on public.kto_events_meta for select to anon, authenticated using (true);
-- (쓰기 권한/정책 없음: 서버 함수(service_role)만 저장 가능)
