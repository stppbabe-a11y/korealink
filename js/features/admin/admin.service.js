// admin.service.js | 관리자 기능 서버 통신
// ★ 이 파일의 모든 호출은 서버가 "요청한 사람이 진짜 관리자인지" 다시 확인합니다.
//   (화면에서 관리자 메뉴를 숨기는 것은 편의일 뿐이고, 보안은 서버의 is_admin() 이 담당)
import { sb } from '../../core/supabase.js';

export async function listReports(status = 'open') {
  const { data, error } = await sb.rpc('admin_list_reports', { p_status: status });
  if (error) throw error;
  return data;
}

export async function resolveReport(id, status) {
  const { error } = await sb.rpc('admin_resolve_report', { p_id: id, p_status: status });
  if (error) throw error;
}

export async function setHidden(type, id, hidden) {
  const { error } = await sb.rpc('admin_set_hidden', { p_type: type, p_id: id, p_hidden: hidden });
  if (error) throw error;
}

export async function deleteMessage(id) {
  const { error } = await sb.from('chat_messages').delete().eq('id', id);
  if (error) throw error;
}

export async function setBan(userId, banned) {
  const { error } = await sb.rpc('admin_set_ban', { p_user: userId, p_banned: banned });
  if (error) throw error;
}

export async function listUsers(query = '') {
  const { data, error } = await sb.rpc('admin_list_users', { p_query: query, p_limit: 50 });
  if (error) throw error;
  return data;
}

export async function listAllRooms() {
  const { data, error } = await sb.from('chat_rooms').select('id,slug,name,description,is_active').order('created_at');
  if (error) throw error;
  return data;
}

export async function createRoom({ slug, name, description }) {
  const { error } = await sb.from('chat_rooms').insert({ slug, name, description: description || null });
  if (error) throw error;
}

export async function setRoomActive(id, isActive) {
  const { error } = await sb.from('chat_rooms').update({ is_active: isActive }).eq('id', id);
  if (error) throw error;
}
