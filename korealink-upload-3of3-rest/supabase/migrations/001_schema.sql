-- =====================================================================
-- 001_schema.sql  |  테이블(데이터 저장 공간) 만들기
-- KoreaLink
--
-- 이 파일은 "어떤 정보를 어떤 모양으로 저장할지"만 정합니다.
-- 누가 읽고/쓸 수 있는지(보안 규칙)는 003_security.sql 에 있습니다.
-- 여러 번 실행해도 안전하게(이미 있으면 건너뛰게) 만들어져 있습니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles : 회원 프로필 (로그인 정보 자체는 Supabase Auth가 따로 보관)
--    비밀번호는 여기 없습니다. Supabase Auth 가 bcrypt 로 해시해서 저장합니다.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text,
  avatar_path  text,                       -- 저장소 안의 파일 경로 (외부 URL 아님)
  bio          text,
  country      text,                       -- 'KR', 'JP' 같은 2글자 국가코드
  language     text not null default 'en',
  role         text not null default 'user',
  is_banned    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (display_name is null or char_length(display_name) between 1 and 40),
  constraint profiles_bio_len check (bio is null or char_length(bio) <= 300),
  constraint profiles_country_fmt check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_language_chk check (language in ('en', 'ko', 'ja', 'zh')),
  constraint profiles_role_chk check (role in ('user', 'admin')),
  constraint profiles_avatar_len check (avatar_path is null or char_length(avatar_path) <= 200)
);
create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

-- ---------------------------------------------------------------------
-- 2) posts : 여행하기 좋은 장소 게시글
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null default auth.uid(),
  title         text not null,
  body          text not null,
  category      text not null default 'sightseeing',
  area          text,
  images        text[] not null default '{}',   -- 저장소 파일 경로 목록 (최대 6장)
  like_count    integer not null default 0,     -- 서버(트리거)만 바꿀 수 있음
  comment_count integer not null default 0,     -- 서버(트리거)만 바꿀 수 있음
  is_hidden     boolean not null default false, -- 관리자만 바꿀 수 있음
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint posts_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade,
  constraint posts_title_len check (char_length(btrim(title)) between 3 and 120),
  constraint posts_body_len check (char_length(btrim(body)) between 10 and 5000),
  constraint posts_category_chk check (category in
    ('sightseeing', 'food', 'nature', 'nightlife', 'culture', 'shopping', 'transport', 'other')),
  constraint posts_area_len check (area is null or char_length(area) <= 60),
  constraint posts_images_max check (coalesce(array_length(images, 1), 0) <= 6)
);
create index if not exists posts_created_idx  on public.posts (created_at desc);
create index if not exists posts_popular_idx  on public.posts (like_count desc, created_at desc);
create index if not exists posts_author_idx   on public.posts (author_id, created_at desc);
create index if not exists posts_category_idx on public.posts (category, created_at desc);

-- ---------------------------------------------------------------------
-- 3) comments : 댓글 + 대댓글 (대댓글은 한 단계만 허용: 트리거에서 검사)
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null,
  parent_id  uuid,
  author_id  uuid not null default auth.uid(),
  body       text not null,
  like_count integer not null default 0,
  is_hidden  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_post_id_fkey   foreign key (post_id)   references public.posts (id)    on delete cascade,
  constraint comments_parent_id_fkey foreign key (parent_id) references public.comments (id) on delete cascade,
  constraint comments_author_id_fkey foreign key (author_id) references public.profiles (id) on delete cascade,
  constraint comments_body_len check (char_length(btrim(body)) between 1 and 1000)
);
create index if not exists comments_post_idx   on public.comments (post_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_author_idx on public.comments (author_id);

-- ---------------------------------------------------------------------
-- 4) 좋아요 (한 사람이 같은 글/댓글에 한 번만: 기본키가 중복을 막아 줌)
-- ---------------------------------------------------------------------
create table if not exists public.post_likes (
  post_id    uuid not null,
  user_id    uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint post_likes_post_id_fkey foreign key (post_id) references public.posts (id)    on delete cascade,
  constraint post_likes_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.comment_likes (
  comment_id uuid not null,
  user_id    uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id),
  constraint comment_likes_comment_id_fkey foreign key (comment_id) references public.comments (id) on delete cascade,
  constraint comment_likes_user_id_fkey    foreign key (user_id)    references public.profiles (id) on delete cascade
);
create index if not exists comment_likes_user_idx on public.comment_likes (user_id);

-- ---------------------------------------------------------------------
-- 5) 게스트 채팅방 / 메시지
-- ---------------------------------------------------------------------
create table if not exists public.chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint chat_rooms_slug_fmt check (slug ~ '^[a-z0-9-]{2,30}$'),
  constraint chat_rooms_name_len check (char_length(btrim(name)) between 1 and 60),
  constraint chat_rooms_desc_len check (description is null or char_length(description) <= 200)
);

create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null,
  author_id  uuid not null default auth.uid(),
  body       text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  constraint chat_messages_room_id_fkey   foreign key (room_id)   references public.chat_rooms (id) on delete cascade,
  constraint chat_messages_author_id_fkey foreign key (author_id) references public.profiles (id)   on delete cascade,
  constraint chat_messages_body_len check (char_length(btrim(body)) between 1 and 500)
);
create index if not exists chat_messages_room_idx   on public.chat_messages (room_id, id desc);
create index if not exists chat_messages_author_idx on public.chat_messages (author_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6) reports : 신고 (일반 회원은 직접 읽거나 쓸 수 없고, 함수를 통해서만 접수됨)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null,
  target_type      text not null,
  target_id        text not null,
  target_author_id uuid,
  reason           text not null,
  note             text,
  snapshot         text,                      -- 신고 당시 내용 (나중에 수정해도 증거가 남음)
  status           text not null default 'open',
  created_at       timestamptz not null default now(),
  constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles (id) on delete cascade,
  constraint reports_target_author_fkey foreign key (target_author_id) references public.profiles (id) on delete set null,
  constraint reports_type_chk   check (target_type in ('post', 'comment', 'message')),
  constraint reports_reason_chk check (reason in ('spam', 'abuse', 'inappropriate', 'other')),
  constraint reports_status_chk check (status in ('open', 'resolved', 'dismissed')),
  constraint reports_note_len   check (note is null or char_length(note) <= 200),
  constraint reports_unique_per_user unique (reporter_id, target_type, target_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
