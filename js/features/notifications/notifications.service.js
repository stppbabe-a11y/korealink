// notifications.service.js | 앱 안 알림 (모임 승인 등)
//   알림은 서버(meetup_decide 함수)만 만들 수 있고, 여기서는 읽기/읽음 표시/삭제만 합니다.
//   새 알림이 오면 실시간으로 받아서 작은 알림창(toast)과 종 모양 숫자를 갱신합니다.
import { sb } from '../../core/supabase.js';
import { state, on, emit, userId, isLoggedIn } from '../../core/store.js';
import { t } from '../../core/i18n.js';
import { toast } from '../../core/ui.js';

export const notifState = { unread: 0 };
let channel = null;
let channelUser = null;

export const notifText = (n) => t('notif.meetup_approved', { title: n.title });

export async function listNotifications() {
  const { data, error } = await sb.from('notifications')
    .select('id,kind,meetup_id,title,is_read,created_at').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

export async function refreshUnread() {
  if (!isLoggedIn()) { notifState.unread = 0; emit('notif'); return; }
  const { count, error } = await sb.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
  if (!error) { notifState.unread = count ?? 0; emit('notif'); }
}

export async function markRead(id) {
  const { error } = await sb.from('notifications').update({ is_read: true }).eq('id', id);
  if (error) throw error;
  refreshUnread();
}
export async function markAllRead() {
  const { error } = await sb.from('notifications').update({ is_read: true }).eq('is_read', false);
  if (error) throw error;
  refreshUnread();
}
export async function removeNotification(id) {
  const { error } = await sb.from('notifications').delete().eq('id', id);
  if (error) throw error;
  refreshUnread();
}

function stop() {
  if (channel) { sb.removeChannel(channel); channel = null; channelUser = null; }
}

// 로그인 상태에 맞춰 실시간 구독을 켜고 끕니다 (앱 시작 때 한 번 호출)
function sync() {
  const uid = isLoggedIn() ? userId() : null;
  if (!uid) { stop(); notifState.unread = 0; emit('notif'); return; }
  if (channelUser === uid) return;
  stop();
  channelUser = uid;
  channel = sb.channel(`notif-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
      (p) => { toast(`🎉 ${notifText(p.new)}`, 'success'); refreshUnread(); })
    .subscribe();
  refreshUnread();
}

export function startNotifications() {
  on('auth', sync);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshUnread(); });   // 앱이 꺼져 있던 동안 온 알림 확인
  sync();
}
