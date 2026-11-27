// chat.service.js | 채팅방 서버 통신 + 실시간 수신
//   ★ 남이 쓴 메시지를 고치거나 지우는 것은 서버(RLS)가 막습니다.
//     아래 editMessage/deleteMessage 는 "내 메시지"에만 성공하고, 다른 사람 것은 0건 처리됩니다.
import { sb } from '../../core/supabase.js';
import { t } from '../../core/i18n.js';
import { removeImages, uploadImages } from '../posts/posts.service.js';

export const PAGE = 40;
const AUTHOR = 'author:profiles!chat_messages_author_id_fkey(id,username,display_name,avatar_cfg,country)';
const COLS = `id,room_id,author_id,body,image,lat,lng,place_name,created_at,edited_at,${AUTHOR}`;

export async function listRooms() {
  const { data, error } = await sb.from('chat_rooms').select('id,slug,name,description,is_active')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getRoom(slug) {
  const { data, error } = await sb.from('chat_rooms').select('id,slug,name,description,is_active')
    .eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data;
}

// 방 이름/설명은 번역 문구가 있으면 그것을, 없으면(관리자가 새로 만든 방) DB 에 적힌 이름을 보여줌
export function roomName(room) {
  const k = `room.${room.slug}.name`;
  const v = t(k);
  return v === k ? room.name : v;
}
export function roomDesc(room) {
  const k = `room.${room.slug}.desc`;
  const v = t(k);
  return v === k ? (room.description ?? '') : v;
}

// 최근 메시지 PAGE 개. beforeId 가 있으면 그보다 오래된 것. (오래된 -> 최신 순서로 반환)
export async function fetchMessages(roomId, beforeId = null) {
  let q = sb.from('chat_messages').select(COLS).eq('room_id', roomId).order('id', { ascending: false }).limit(PAGE + 1);
  if (beforeId) q = q.lt('id', beforeId);
  const { data, error } = await q;
  if (error) throw error;
  return { messages: data.slice(0, PAGE).reverse(), hasMore: data.length > PAGE };
}

// 글자만 / 사진(image 경로) / 위치(lat,lng,place_name) 중 하나를 보냅니다. 사진·위치는 로그인 회원만 (서버 규칙이 한 번 더 확인)
export async function sendMessage(roomId, { body = '', image = null, lat = null, lng = null, place_name = null } = {}) {
  const row = { room_id: roomId, body };
  if (image) row.image = image;
  if (lat != null && lng != null) Object.assign(row, { lat, lng, place_name: place_name || null });
  const { data, error } = await sb.from('chat_messages').insert(row).select(COLS).single();
  if (error) throw error;
  return data;
}

// 사진을 올리고(압축·EXIF 제거·섬네일) 그 경로로 메시지 전송. 전송이 실패하면 올린 사진도 정리
export async function sendPhoto(roomId, file, caption = '') {
  const [path] = await uploadImages([file]);
  try { return await sendMessage(roomId, { body: caption, image: path }); }
  catch (e) { await removeImages([path, path.replace(/\.(webp|jpg)$/, '_t.$1')]); throw e; }
}

export async function editMessage(id, body) {
  const { data, error } = await sb.from('chat_messages').update({ body }).eq('id', id).select('id,edited_at');
  if (error) throw error;
  if (!data?.length) throw new Error('forbidden');             // 내 메시지가 아니면 0건 => 거절로 처리
  return data[0];
}

export async function deleteMessage(id, image = null) {
  const { data, error } = await sb.from('chat_messages').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('forbidden');
  if (image) removeImages([image, image.replace(/\.(webp|jpg)$/, '_t.$1')]).catch(() => {});      // 사진 파일도 함께 정리(내 메시지만 여기까지 옴)
}

// ---- 프로필 캐시: 실시간으로 도착한 메시지에는 작성자 정보가 없어서 따로 조회 -----------
const profileCache = new Map();
export function cacheProfile(p) { if (p?.id) profileCache.set(p.id, p); }
export async function profileFor(id) {
  if (profileCache.has(id)) return profileCache.get(id);
  const { data } = await sb.from('profiles').select('id,username,display_name,avatar_cfg,country').eq('id', id).maybeSingle();
  if (data) profileCache.set(id, data);
  return data;
}

// ---- 실시간 구독. 반환값을 호출하면 구독 해제 -------------------------------------
export function subscribe(roomId, { onInsert, onUpdate, onDelete, onReconnect }) {
  let connectedBefore = false;
  const channel = sb.channel(`room-${roomId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
      (p) => onInsert(p.new))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
      (p) => onUpdate(p.new))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' },   // DELETE 는 방 필터 불가 -> id 로만 처리
      (p) => onDelete(p.old.id))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (connectedBefore) onReconnect?.();                  // 연결이 끊겼다 돌아오면 놓친 메시지 보충
        connectedBefore = true;
      }
    });
  return () => { sb.removeChannel(channel); };
}
