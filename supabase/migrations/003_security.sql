-- =====================================================================
-- 003_security.sql  |  누가 무엇을 읽고/쓰고/지울 수 있는지 (보안 규칙)
--
-- 방어는 3겹입니다.
--   1겹  GRANT      : 이 칸(컬럼)을 건드릴 권한 자체가 있는가?  (예: role 칸은 아무도 못 씀)
--   2겹  RLS 정책   : 이 "줄(row)"의 주인이 나인가?            (예: 남의 글은 수정/삭제 불가)
--   3겹  트리거     : 도배, 남의 사진 끼워넣기 등 서버가 직접 검사 (002 파일)
--
-- 다시 실행해도 안전합니다. (먼저 권한을 모두 회수한 뒤 필요한 것만 다시 부여)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) 기본 권한 모두 회수 (Supabase 는 기본으로 넓게 열어 두기 때문에 먼저 닫습니다)
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.posts, public.comments, public.post_likes,
              public.comment_likes, public.chat_rooms, public.chat_messages, public.reports
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 1) 모든 테이블에서 RLS(줄 단위 보안) 켜기
--    FORCE 는 쓰지 않습니다: 테이블 주인(서버 함수)만 규칙을 우회할 수 있어야 하기 때문.
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.posts         enable row level security;
alter table public.comments      enable row level security;
alter table public.post_likes    enable row level security;
alter table public.comment_likes enable row level security;
alter table public.chat_rooms    enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reports       enable row level security;   -- 정책 없음 = 일반 회원 접근 완전 차단

-- ---------------------------------------------------------------------
-- 2) profiles
--    - 누구나 "공개 칸"만 읽을 수 있음 (role, is_banned, language 는 비공개)
--    - 내 프로필만, 지정된 칸만 수정 가능 (role/is_banned 는 수정 불가)
--    - 생성은 가입 트리거가, 삭제는 탈퇴 함수가 담당 (직접 insert/delete 권한 없음)
-- ---------------------------------------------------------------------
grant select (id, username, display_name, avatar_path, bio, country, created_at)
  on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_path, bio, country, language)
  on public.profiles to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 3) posts
-- ---------------------------------------------------------------------
grant select on public.posts to anon, authenticated;
grant insert (author_id, title, body, category, area, images) on public.posts to authenticated;
grant update (title, body, category, area, images)            on public.posts to authenticated;
grant delete on public.posts to authenticated;

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to anon, authenticated
  using (not is_hidden or author_id = (select auth.uid()) or public.is_admin());

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_write());

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) and public.can_write())
  with check (author_id = (select auth.uid()));

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------
-- 4) comments
-- ---------------------------------------------------------------------
grant select on public.comments to anon, authenticated;
grant insert (post_id, parent_id, author_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to anon, authenticated
  using (not is_hidden or author_id = (select auth.uid()) or public.is_admin());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_write());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()) and public.can_write())
  with check (author_id = (select auth.uid()));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- ---------------------------------------------------------------------
-- 5) 좋아요: 내 좋아요만 보이고, 내 이름으로만 누르고/취소할 수 있음
-- ---------------------------------------------------------------------
grant select, delete on public.post_likes, public.comment_likes to authenticated;
grant insert (post_id, user_id)    on public.post_likes    to authenticated;
grant insert (comment_id, user_id) on public.comment_likes to authenticated;

drop policy if exists post_likes_select on public.post_likes;
create policy post_likes_select on public.post_likes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists post_likes_insert on public.post_likes;
create policy post_likes_insert on public.post_likes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_write());
drop policy if exists post_likes_delete on public.post_likes;
create policy post_likes_delete on public.post_likes
  for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists comment_likes_select on public.comment_likes;
create policy comment_likes_select on public.comment_likes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists comment_likes_insert on public.comment_likes;
create policy comment_likes_insert on public.comment_likes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.can_write());
drop policy if exists comment_likes_delete on public.comment_likes;
create policy comment_likes_delete on public.comment_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 6) 채팅방 (읽기: 로그인 회원 / 만들기·수정·삭제: 관리자만)
-- ---------------------------------------------------------------------
grant select on public.chat_rooms to authenticated;
grant insert (slug, name, description, is_active) on public.chat_rooms to authenticated;
grant update (name, description, is_active)       on public.chat_rooms to authenticated;
grant delete on public.chat_rooms to authenticated;

drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms
  for select to authenticated using (is_active or public.is_admin());
drop policy if exists chat_rooms_insert on public.chat_rooms;
create policy chat_rooms_insert on public.chat_rooms
  for insert to authenticated with check (public.is_admin());
drop policy if exists chat_rooms_update on public.chat_rooms;
create policy chat_rooms_update on public.chat_rooms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists chat_rooms_delete on public.chat_rooms;
create policy chat_rooms_delete on public.chat_rooms
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 7) 채팅 메시지 (★ 남이 쓴 메시지는 수정/삭제 불가 ★)
--    - 읽기/쓰기: 로그인 회원 (쓸 때 author 는 반드시 "나")
--    - 수정/삭제: 내가 쓴 메시지만. (삭제는 관리자도 가능 = 운영용)
-- ---------------------------------------------------------------------
grant select on public.chat_messages to authenticated;
grant insert (room_id, author_id, body) on public.chat_messages to authenticated;
grant update (body) on public.chat_messages to authenticated;
grant delete on public.chat_messages to authenticated;

drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated using (true);
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_write());
drop policy if exists chat_messages_update_own on public.chat_messages;
create policy chat_messages_update_own on public.chat_messages
  for update to authenticated
  using (author_id = (select auth.uid()) and public.can_write())
  with check (author_id = (select auth.uid()));
drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- reports : 위에서 모든 권한을 회수했고 정책도 없으므로 일반 회원은 접근 불가.
--           접수는 report_content(), 관리자 조회는 admin_* 함수로만 가능.

-- ---------------------------------------------------------------------
-- 8) 함수 실행 권한: 먼저 모두 회수 -> 필요한 것만 부여
--    (트리거용 함수는 앱에서 직접 부를 수 없게 완전히 닫아 둠)
-- ---------------------------------------------------------------------
revoke all on function
  public.is_admin(), public.can_write(), public.touch_updated_at(), public.handle_new_user(),
  public.protect_profile(), public.enforce_post_rules(), public.enforce_comment_rules(),
  public.enforce_message_rules(), public.bump_post_likes(), public.bump_comment_likes(),
  public.bump_comment_count(), public.me(), public.is_username_available(text),
  public.delete_my_account(), public.report_content(text, text, text, text),
  public.admin_list_reports(text), public.admin_resolve_report(uuid, text),
  public.admin_set_hidden(text, uuid, boolean), public.admin_set_ban(uuid, boolean),
  public.admin_list_users(text, integer)
  from public, anon, authenticated;

grant execute on function public.is_admin(), public.is_username_available(text)
  to anon, authenticated;
grant execute on function
  public.can_write(), public.me(), public.delete_my_account(),
  public.report_content(text, text, text, text),
  public.admin_list_reports(text), public.admin_resolve_report(uuid, text),
  public.admin_set_hidden(text, uuid, boolean), public.admin_set_ban(uuid, boolean),
  public.admin_list_users(text, integer)
  to authenticated;
-- 주의: admin_* 함수는 로그인만 하면 "호출"은 되지만, 함수 첫 줄에서 서버가
--       관리자인지 다시 확인하고 아니면 'forbidden' 오류를 냅니다.

-- ---------------------------------------------------------------------
-- 9) 사진 저장소(Storage)
--    - 형식: jpeg/png/webp 만, 크기: 게시글 사진 5MB / 프로필 2MB 까지
--    - 올리기/수정/삭제: "내 폴더(내 user id 이름의 폴더)" 안에서만
--    - 읽기: 공개 버킷이라 주소를 아는 사람은 볼 수 있음 (여행 사진은 원래 공개 용도)
--      ※ 개인 사진/문서는 이 버킷에 올리지 마세요.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',     'avatars',     true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists busan_storage_select_own on storage.objects;
create policy busan_storage_select_own on storage.objects
  for select to authenticated
  using (bucket_id in ('post-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists busan_storage_insert_own on storage.objects;
create policy busan_storage_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id in ('post-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.can_write());

drop policy if exists busan_storage_update_own on storage.objects;
create policy busan_storage_update_own on storage.objects
  for update to authenticated
  using (bucket_id in ('post-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('post-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists busan_storage_delete_own on storage.objects;
create policy busan_storage_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id in ('post-images', 'avatars')
         and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

-- ---------------------------------------------------------------------
-- 10) 실시간 채팅: 새 메시지가 올라오면 화면이 즉시 갱신되도록 등록
--     (Realtime 도 위의 RLS 규칙을 그대로 따릅니다)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
