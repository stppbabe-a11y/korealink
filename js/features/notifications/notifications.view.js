// notifications.view.js | 알림 목록 화면 (#/notifications)
import { h, icon, clear } from '../../core/dom.js';
import { t, timeAgo } from '../../core/i18n.js';
import { toast, emptyState, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';
import { listNotifications, markRead, markAllRead, removeNotification, notifText } from './notifications.service.js';

export async function notificationsView({ root }) {
  const list = h('div', { class: 'stack notif-list' });
  const allBtn = h('button', { class: 'btn btn-soft btn-sm', type: 'button' }, icon('check', 16), t('notif.markAll'));
  root.append(h('section', { class: 'stack' },
    h('div', { class: 'row-between' }, h('h1', null, t('notif.title')), allBtn), list));

  let items = [];
  async function load() {
    try { items = await listNotifications(); paint(); } catch (e) { list.replaceChildren(errorBox(friendlyError(e), load)); }
  }
  function paint() {
    clear(list);
    allBtn.hidden = !items.some((n) => !n.is_read);
    if (!items.length) { list.append(emptyState({ iconName: 'mail', title: t('notif.empty'), text: t('notif.emptyHint') })); return; }
    for (const n of items) {
      const open = async () => {
        if (!n.is_read) { n.is_read = true; try { await markRead(n.id); } catch { /* 읽음 표시 실패는 무시하고 이동 */ } }
        navigate(`#/meetups/${n.meetup_id}`);
      };
      list.append(h('div', { class: `card notif-item${n.is_read ? '' : ' unread'}` },
        h('button', { class: 'notif-main', type: 'button', onClick: open },
          h('span', { class: 'notif-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'notif-body' }, h('strong', null, notifText(n)), h('small', { class: 'muted' }, timeAgo(n.created_at)))),
        h('button', { class: 'btn btn-text btn-sm', type: 'button', 'aria-label': t('common.remove'), onClick: async () => {
          try { await removeNotification(n.id); items = items.filter((x) => x.id !== n.id); paint(); } catch (e) { toast(friendlyError(e), 'error'); }
        } }, icon('x', 16))));
    }
  }
  allBtn.addEventListener('click', async () => {
    try { await markAllRead(); items.forEach((n) => { n.is_read = true; }); paint(); } catch (e) { toast(friendlyError(e), 'error'); }
  });
  await load();
}
