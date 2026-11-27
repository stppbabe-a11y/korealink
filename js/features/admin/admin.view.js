// admin.view.js | 관리자 화면 (신고 처리 / 회원 관리 / 채팅방 관리)
// 이 파일은 관리자만 내려받습니다 (routes.js 에서 필요할 때만 불러옴).
// 일반 회원이 주소를 직접 입력해도 router 가 막고, 설령 뚫어도 서버 함수가 'forbidden' 을 돌려줍니다.
import { h, icon, clear } from '../../core/dom.js';
import { t, timeAgo } from '../../core/i18n.js';
import { field, formError, runBusy } from '../../core/form.js';
import { toast, spinner, emptyState, errorBox, confirmDialog } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { debounce } from '../../core/utils.js';
import * as admin from './admin.service.js';
import { roomName } from '../chat/chat.service.js';

export function adminView({ root }) {
  const tabs = ['reports', 'users', 'rooms'];
  let current = 'reports';
  const body = h('div', { class: 'admin-body' });
  const tabBar = h('div', { class: 'chips', role: 'tablist' });

  function paintTabs() {
    clear(tabBar);
    for (const k of tabs) {
      tabBar.append(h('button', {
        class: `chip${current === k ? ' active' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(current === k),
        onClick: () => { current = k; paintTabs(); show(); },
      }, t(`admin.tab.${k}`)));
    }
  }
  function show() {
    clear(body);
    ({ reports: reportsTab, users: usersTab, rooms: roomsTab })[current](body);
  }

  root.append(
    h('section', { class: 'hero hero-admin' }, h('h1', null, icon('shield', 26), ' ', t('nav.admin')), h('p', null, t('admin.subtitle'))),
    tabBar, body);
  paintTabs();
  show();
}

// ------------------------------------------------------------------ 신고
function reportsTab(host) {
  let status = 'open';
  const list = h('div', { class: 'stack' });
  const statusSel = h('select', { class: 'select-sm', 'aria-label': t('admin.status') },
    ['open', 'resolved', 'dismissed'].map((s) => h('option', { value: s }, t(`admin.status.${s}`))));
  statusSel.addEventListener('change', () => { status = statusSel.value; load(); });
  host.append(statusSel, list);

  async function load() {
    list.replaceChildren(spinner());
    try {
      const rows = await admin.listReports(status);
      clear(list);
      if (rows.length === 0) return list.append(emptyState({ iconName: 'check', title: t('admin.noReports') }));
      rows.forEach((r) => list.append(reportCard(r)));
    } catch (ex) { list.replaceChildren(errorBox(friendlyError(ex), load)); }
  }

  function reportCard(r) {
    const card = h('div', { class: 'card report-card' });
    const act = (fn, doneKey) => async () => {
      try { await fn(); toast(t(doneKey), 'success'); card.remove(); }
      catch (ex) { toast(friendlyError(ex), 'error'); }
    };
    card.append(
      h('div', { class: 'chips-row' },
        h('span', { class: 'badge' }, t(`admin.type.${r.target_type}`)),
        h('span', { class: 'badge badge-warn' }, t(`report.${r.reason}`)),
        h('span', { class: 'muted small' }, `${timeAgo(r.created_at)} · ${t('admin.reportedBy', { name: r.reporter_username ?? '—' })}`)),
      h('blockquote', { class: 'snapshot' }, r.snapshot ?? '—'),
      h('p', { class: 'muted small' }, t('admin.author', { name: r.target_author_username ?? '—' })),
      r.note && h('p', { class: 'small' }, `“${r.note}”`),
      h('div', { class: 'actions wrap' },
        r.target_type !== 'message' && h('button', { class: 'btn btn-soft btn-sm', type: 'button',
          onClick: act(async () => { await admin.setHidden(r.target_type, r.target_id, true); await admin.resolveReport(r.id, 'resolved'); }, 'admin.hidden') }, t('admin.hide')),
        r.target_type === 'message' && h('button', { class: 'btn btn-soft btn-sm danger', type: 'button',
          onClick: act(async () => { await admin.deleteMessage(Number(r.target_id)); await admin.resolveReport(r.id, 'resolved'); }, 'common.deleted') }, t('common.delete')),
        r.target_author_id && h('button', { class: 'btn btn-soft btn-sm danger', type: 'button',
          onClick: async () => {
            if (!(await confirmDialog(t('admin.banConfirm', { name: r.target_author_username ?? '' }), { danger: true }))) return;
            act(async () => { await admin.setBan(r.target_author_id, true); await admin.resolveReport(r.id, 'resolved'); }, 'admin.banned')();
          } }, t('admin.ban')),
        status === 'open' && h('button', { class: 'btn btn-text btn-sm', type: 'button',
          onClick: act(() => admin.resolveReport(r.id, 'dismissed'), 'admin.dismissed') }, t('admin.dismiss')),
        r.target_type === 'post' && h('a', { class: 'btn btn-text btn-sm', href: `#/posts/${r.target_id}` }, t('admin.view'))));
    return card;
  }
  load();
}

// ------------------------------------------------------------------ 회원
function usersTab(host) {
  const list = h('div', { class: 'stack' });
  const q = h('input', { type: 'search', class: 'search-input', placeholder: t('admin.searchUsers'), maxlength: 40, 'aria-label': t('admin.searchUsers') });
  host.append(h('div', { class: 'search-wrap' }, icon('search', 18), q), list);

  async function load() {
    list.replaceChildren(spinner());
    try {
      const rows = await admin.listUsers(q.value.trim());
      clear(list);
      if (rows.length === 0) return list.append(emptyState({ title: t('post.noResults') }));
      rows.forEach((u) => list.append(userRow(u)));
    } catch (ex) { list.replaceChildren(errorBox(friendlyError(ex), load)); }
  }

  function userRow(u) {
    const btn = h('button', { class: `btn btn-sm ${u.is_banned ? 'btn-soft' : 'btn-soft danger'}`, type: 'button' },
      u.is_banned ? t('admin.unban') : t('admin.ban'));
    const badge = h('span', { class: 'badge badge-warn', hidden: !u.is_banned }, t('admin.banned'));
    btn.addEventListener('click', async () => {
      const next = !u.is_banned;
      if (next && !(await confirmDialog(t('admin.banConfirm', { name: u.username }), { danger: true }))) return;
      try {
        await admin.setBan(u.id, next);
        u.is_banned = next;
        btn.textContent = next ? t('admin.unban') : t('admin.ban');
        btn.classList.toggle('danger', !next);
        badge.hidden = !next;
        toast(t(next ? 'admin.banned' : 'admin.unbanned'), 'success');
      } catch (ex) { toast(friendlyError(ex), 'error'); }
    });
    return h('div', { class: 'card user-row' },
      h('a', { href: `#/u/${encodeURIComponent(u.username)}` }, h('strong', null, u.display_name || u.username), h('span', { class: 'muted' }, ` @${u.username}`)),
      u.role === 'admin' && h('span', { class: 'badge' }, t('admin.roleAdmin')),
      badge, h('span', { class: 'spacer' }),
      u.role !== 'admin' && btn);
  }
  q.addEventListener('input', debounce(load, 350));
  load();
}

// ------------------------------------------------------------------ 채팅방
function roomsTab(host) {
  const list = h('div', { class: 'stack' });
  const slug = field({ label: t('admin.roomSlug'), name: 'slug', required: true, minlength: 2, maxlength: 30, pattern: '[a-z0-9\\-]{2,30}', hint: t('admin.roomSlugHint') });
  const name = field({ label: t('admin.roomName'), name: 'name', required: true, maxlength: 60 });
  const desc = field({ label: t('admin.roomDesc'), name: 'desc', maxlength: 200 });
  const err = formError();
  const form = h('form', { class: 'card stack' }, h('h3', null, t('admin.newRoom')), slug.root, name.root, desc.root, err.el,
    h('button', { class: 'btn btn-primary', type: 'submit' }, t('common.create')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.set('');
    try {
      await runBusy(form, () => admin.createRoom({ slug: slug.input.value.trim(), name: name.input.value.trim(), description: desc.input.value.trim() }));
      form.reset();
      toast(t('common.saved'), 'success');
      load();
    } catch (ex) { err.set(friendlyError(ex)); }
  });
  host.append(form, list);

  async function load() {
    list.replaceChildren(spinner());
    try {
      const rooms = await admin.listAllRooms();
      clear(list);
      rooms.forEach((r) => {
        const toggle = h('button', { class: 'btn btn-soft btn-sm', type: 'button' }, r.is_active ? t('admin.closeRoom') : t('admin.openRoom'));
        toggle.addEventListener('click', async () => {
          try { await admin.setRoomActive(r.id, !r.is_active); toast(t('common.saved'), 'success'); load(); }
          catch (ex) { toast(friendlyError(ex), 'error'); }
        });
        list.append(h('div', { class: 'card user-row' },
          h('strong', null, roomName(r)), h('span', { class: 'muted' }, `#${r.slug}`),
          !r.is_active && h('span', { class: 'badge badge-warn' }, t('chat.closed')),
          h('span', { class: 'spacer' }), toggle));
      });
    } catch (ex) { list.replaceChildren(errorBox(friendlyError(ex), load)); }
  }
  load();
}
