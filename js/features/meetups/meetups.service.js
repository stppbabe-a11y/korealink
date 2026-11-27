// meetups.service.js | 모임 & 동행 서버 통신
//   - 참여 신청/취소/승인은 "참여 기록 1줄"만 추가/삭제합니다. (정원/승인 규칙은 서버(DB 트리거)가 강제)
//   - 인원 숫자(joined_count)는 서버가 계산합니다.
import { sb } from '../../core/supabase.js';
import { userId } from '../../core/store.js';
import { diff, isEmpty } from '../../core/utils.js';
import { uploadImages, removeImages } from '../posts/posts.service.js';

export const PAGE = 12;
const HOST = 'host:profiles!meetups_host_fkey(id,username,display_name,avatar_cfg,country)';
const LIST_COLS = `id,host_id,title,category,region,starts_at,place_name,capacity,joined_count,approval,languages,cost_note,cover,is_cancelled,${HOST}`;
const COLS = `${LIST_COLS},description,lat,lng,created_at,updated_at`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const endOfDay = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

// 앞으로 열리는 모임 (취소된 모임 제외). when: any | today | week
export async function listMeetups({ category = '', region = '', when = 'any', lang = '', page = 0 } = {}) {
  let q = sb.from('meetups').select(LIST_COLS).eq('is_cancelled', false).gt('starts_at', new Date().toISOString());
  if (category) q = q.eq('category', category);
  if (region) q = q.eq('region', region);
  if (lang) q = q.contains('languages', [lang]);
  const now = new Date();
  if (when === 'today') q = q.lte('starts_at', endOfDay(now).toISOString());
  if (when === 'week') q = q.lte('starts_at', endOfDay(new Date(now.getTime() + 6 * 86400000)).toISOString());
  q = q.order('starts_at', { ascending: true });
  const from = page * PAGE;
  const { data, error } = await q.range(from, from + PAGE);
  if (error) throw error;
  return { items: data.slice(0, PAGE), hasMore: data.length > PAGE };
}

// 내가 방장이거나 참여/신청한 모임
export async function listMyMeetups() {
  const uid = userId();
  const { data, error } = await sb.from('meetup_members')
    .select(`status,meetup:meetups!mm_meetup_fkey(${LIST_COLS})`)
    .eq('user_id', uid).limit(100);
  if (error) throw error;
  return (data ?? []).filter((r) => r.meetup).map((r) => ({ ...r.meetup, my_status: r.status }));
}

export async function getMeetup(id) {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await sb.from('meetups').select(COLS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

const USER = 'user:profiles!meetup_members_user_id_fkey(id,username,display_name,avatar_cfg,country)';
export async function listMembers(meetupId) {
  const { data, error } = await sb.from('meetup_members')
    .select(`user_id,status,note,created_at,${USER}`).eq('meetup_id', meetupId).order('created_at', { ascending: true }).limit(60);
  if (error) throw error;
  return data ?? [];
}

export async function joinMeetup(id, note) {
  const { data, error } = await sb.from('meetup_members').insert({ meetup_id: id, note: note || null }).select('status').single();
  if (error) throw error;
  return data.status;
}
export async function leaveMeetup(id) {
  const { error } = await sb.from('meetup_members').delete().eq('meetup_id', id).eq('user_id', userId());
  if (error) throw error;
}
export async function removeMember(id, uid) {
  const { error } = await sb.from('meetup_members').delete().eq('meetup_id', id).eq('user_id', uid);
  if (error) throw error;
}
export async function decideMember(id, uid, accept) {
  const { error } = await sb.rpc('meetup_decide', { p_meetup: id, p_user: uid, p_accept: accept });
  if (error) throw error;
}

const FIELDS = ({ title, description, category, region, startsAt, place, capacity, approval, languages, costNote }) => ({
  title, description, category, region: region || null, starts_at: startsAt, place_name: place.place_name || 'Meeting point',
  lat: place.lat, lng: place.lng, capacity, approval, languages, cost_note: costNote || null,
});

export async function createMeetup(values, coverFile) {
  let cover = null;
  if (coverFile) [cover] = await uploadImages([coverFile]);
  const { data, error } = await sb.from('meetups').insert({ ...FIELDS(values), cover }).select('id').single();
  if (error) { if (cover) await removeImages([cover]); throw error; }
  return data.id;
}

export async function updateMeetup(original, values, { coverFile, removeCover }) {
  let cover = original.cover;
  let uploaded = null;
  if (coverFile) { [uploaded] = await uploadImages([coverFile]); cover = uploaded; }
  else if (removeCover) cover = null;
  const next = { ...FIELDS(values), cover };
  if (new Date(next.starts_at).getTime() === new Date(original.starts_at).getTime()) next.starts_at = original.starts_at;   // 같은 시각이면 바뀐 것으로 치지 않음
  const changes = diff(original, next);                                          // ★ 바뀐 칸만
  if (isEmpty(changes)) return false;
  const { error } = await sb.from('meetups').update(changes).eq('id', original.id);
  if (error) { if (uploaded) await removeImages([uploaded]); throw error; }
  if (original.cover && original.cover !== cover) await removeImages([original.cover]);
  return true;
}

export async function setCancelled(id, cancelled) {
  const { error } = await sb.from('meetups').update({ is_cancelled: cancelled }).eq('id', id);
  if (error) throw error;
}
export async function deleteMeetup(m) {
  const { error } = await sb.from('meetups').delete().eq('id', m.id);
  if (error) throw error;
  if (m.cover) await removeImages([m.cover]);
}

// ---- 단체 채팅 (참여 확정자만 읽고 쓸 수 있음: 서버 규칙) ----
const MSG_COLS = 'id,meetup_id,author_id,body,created_at,author:profiles!meetup_messages_author_id_fkey(id,username,display_name,avatar_cfg,country)';
export async function listMessages(meetupId) {
  const { data, error } = await sb.from('meetup_messages').select(MSG_COLS).eq('meetup_id', meetupId).order('id', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []).reverse();
}
export async function sendMessage(meetupId, body) {
  const { data, error } = await sb.from('meetup_messages').insert({ meetup_id: meetupId, body }).select(MSG_COLS).single();
  if (error) throw error;
  return data;
}
export async function deleteMessage(id) {
  const { error } = await sb.from('meetup_messages').delete().eq('id', id);
  if (error) throw error;
}
export function subscribeMessages(meetupId, onInsert, onReconnect) {
  let before = false;
  const ch = sb.channel(`meetup-${meetupId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'meetup_messages', filter: `meetup_id=eq.${meetupId}` }, (p) => onInsert(p.new))
    .subscribe((s) => { if (s === 'SUBSCRIBED') { if (before) onReconnect?.(); before = true; } });
  return () => { sb.removeChannel(ch); };
}
