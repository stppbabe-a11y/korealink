// posts.service.js | 게시글 서버 통신 (목록/상세/작성/수정/삭제/좋아요/사진)
//
// ★ 저장 방식 (질문하신 "데이터 하나 바꿀 때마다 전체가 다시 저장되나?" 에 대한 답)
//   - 글 수정: 바뀐 칸만 골라서(diff) 서버에 보냅니다. 제목만 고쳤으면 제목 한 칸만 저장.
//   - 바뀐 게 없으면 서버에 요청 자체를 보내지 않습니다.
//   - 좋아요: 글 전체를 저장하지 않고 "좋아요 기록 1줄"만 추가/삭제합니다.
//     숫자(like_count)는 서버 트리거가 +1/-1 로만 바꿉니다. (동시에 눌러도 숫자가 틀어지지 않음)
//   - 사진: 새로 고른 사진만 업로드하고, 지운 사진만 저장소에서 삭제합니다.
import { sb } from '../../core/supabase.js';
import { userId } from '../../core/store.js';
import { compressPostImage, extOf, randomId, escapeLike, diff, isEmpty } from '../../core/utils.js';
import { publicUrl } from '../../core/supabase.js';

export const PAGE_SIZE = 10;
export const MAX_IMAGES = 6;
export const BUCKET = 'post-images';

const AUTHOR = 'author:profiles!posts_author_id_fkey(id,username,display_name,avatar_cfg,country)';
// 데이터 절약: 목록에는 글 전체(body, 최대 5000자) 대신 서버가 만든 앞 140자(summary)만 받습니다.
const PLACE = 'place_name,lat,lng,rating';
const LIST_COLS = `id,author_id,title,summary,category,area,region,images,like_count,comment_count,is_hidden,created_at,${PLACE},${AUTHOR}`;
const COLS = `id,author_id,title,body,category,area,region,images,like_count,comment_count,is_hidden,created_at,updated_at,${PLACE},${AUTHOR}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 검색어에서 필터 문법을 깨뜨릴 수 있는 문자를 제거 (PostgREST 필터 주입 방지)
function cleanSearch(q) {
  return escapeLike(String(q ?? '').replace(/[,()"'*:]/g, ' ').trim().slice(0, 60));
}

export async function listPosts({ category = '', region = '', q = '', sort = 'latest', page = 0, authorId = '' } = {}) {
  let query = sb.from('posts').select(LIST_COLS);
  if (category) query = query.eq('category', category);
  if (region) query = query.eq('region', region);
  if (authorId) query = query.eq('author_id', authorId);
  const term = cleanSearch(q);
  if (term) query = query.or(`title.ilike.%${term}%,body.ilike.%${term}%`);
  query = sort === 'popular'
    ? query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
    : query.order('created_at', { ascending: false });
  const from = page * PAGE_SIZE;
  const { data, error } = await query.range(from, from + PAGE_SIZE);   // 한 개 더 받아서 "다음 페이지 있음" 판단
  if (error) throw error;
  return { posts: data.slice(0, PAGE_SIZE), hasMore: data.length > PAGE_SIZE };
}

export async function getPost(id) {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await sb.from('posts').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

// 내가 좋아요 누른 글/댓글 id 모음 (로그인 안 했으면 빈 집합)
export async function likedIds(table, column, ids) {
  const uid = userId();
  if (!uid || ids.length === 0) return new Set();
  const { data, error } = await sb.from(table).select(column).eq('user_id', uid).in(column, ids);
  if (error) throw error;
  return new Set(data.map((r) => r[column]));
}
export const likedPostIds = (ids) => likedIds('post_likes', 'post_id', ids);

export async function setPostLike(postId, liked) {
  if (liked) {
    const { error } = await sb.from('post_likes').insert({ post_id: postId });
    if (error && error.code !== '23505') throw error;           // 이미 눌렀다면 성공으로 취급
  } else {
    const { error } = await sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId());
    if (error) throw error;
  }
}

// ---- 사진 --------------------------------------------------------------------
export function validateImageFiles(files, existingCount = 0) {
  if (existingCount + files.length > MAX_IMAGES) throw new Error('image_count');
  for (const f of files) if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)) throw new Error('image_type');
}

// 새로 올리는 사진은 "본 사진 + 목록용 작은 사진" 2장을 올립니다.
//   본 사진:  n<랜덤>.webp      목록용:  n<랜덤>_t.webp   (이름 규칙으로 서로 연결 -> DB 에는 본 사진 경로만 저장)
//   옛 방식으로 올린 사진(.jpg, n 으로 시작 안 함)은 작은 사진이 없으므로 그대로 본 사진을 씁니다.
const NEW_STYLE = /\/n[0-9a-f]{32}\.(webp|jpg)$/;
export const thumbPath = (path) => (NEW_STYLE.test(path) ? path.replace(/\.(webp|jpg)$/, '_t.$1') : path);
export const imageUrl = (path, { thumb = false } = {}) => publicUrl(BUCKET, thumb ? thumbPath(path) : path);

async function uploadImages(files) {
  const uid = userId();
  const uploaded = [];
  const putAll = [];
  try {
    for (const file of files) {
      const { main, thumb } = await compressPostImage(file);
      const ext = extOf(main);
      const base = `${uid}/n${randomId()}`;
      const path = `${base}.${ext}`;
      const opts = (b) => ({ contentType: b.type, upsert: false, cacheControl: '31536000' });
      putAll.push(path, thumbPath(path));                     // 실패 시 정리할 목록에 먼저 기록
      const r1 = await sb.storage.from(BUCKET).upload(path, main, opts(main));
      if (r1.error) throw r1.error;
      const r2 = await sb.storage.from(BUCKET).upload(thumbPath(path), thumb, opts(thumb));
      if (r2.error) throw r2.error;
      uploaded.push(path);
    }
  } catch (e) {
    await removeImages(putAll);                               // 중간에 실패하면 이미 올린 것도 정리
    throw e;
  }
  return uploaded;
}

export { uploadImages };                                     // 모임 대표 사진 등 다른 기능에서도 같은 최적화 업로드를 씀

// 본 사진을 지울 때 작은 사진도 함께 지웁니다
export async function removeImages(paths) {
  if (!paths?.length) return;
  const all = [...new Set(paths.flatMap((p) => [p, thumbPath(p)]))];
  try { await sb.storage.from(BUCKET).remove(all); } catch (e) { console.warn('[posts] image cleanup failed', e); }
}

// ---- 작성 / 수정 / 삭제 ----------------------------------------------------------
const placeFields = (place, rating) => ({
  place_name: place?.place_name ?? null, lat: place?.lat ?? null, lng: place?.lng ?? null, rating: rating || null,
});

export async function createPost({ title, body, category, area, region, files, place, rating }) {
  const images = await uploadImages(files);
  const { data, error } = await sb.from('posts')
    .insert({ title, body, category, area: area || null, region: region || null, images, ...placeFields(place, rating) })
    .select('id').single();
  if (error) { await removeImages(images); throw error; }
  return data.id;
}

export async function updatePost(original, { title, body, category, area, region, keepImages, files, place, rating }) {
  const newPaths = await uploadImages(files);
  const next = { title, body, category, area: area || null, region: region || null, images: [...keepImages, ...newPaths], ...placeFields(place, rating) };
  const changes = diff(original, next);                        // ★ 바뀐 칸만
  if (isEmpty(changes)) return false;                          // 바뀐 게 없으면 서버 요청 없음
  const { error } = await sb.from('posts').update(changes).eq('id', original.id);
  if (error) { await removeImages(newPaths); throw error; }
  const removed = original.images.filter((p) => !next.images.includes(p));
  await removeImages(removed.filter((p) => p.startsWith(`${userId()}/`)));
  return true;
}

export async function deletePost(post) {
  const { error } = await sb.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  await removeImages(post.images);   // 본인 또는 관리자만 저장소 삭제 가능 (003_security.sql 9번)
}

// 지도 화면용: 위치가 있는 글만, 꼭 필요한 칸만 (최대 200개)
export async function listMapPosts() {
  const { data, error } = await sb.from('posts')
    .select('id,title,category,place_name,lat,lng,rating')
    .not('lat', 'is', null).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data;
}
