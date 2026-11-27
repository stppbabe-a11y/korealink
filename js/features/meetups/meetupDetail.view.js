// meetupDetail.view.js | 모임 상세: 일정/장소/참여자/참여 신청/방장 관리/단체 채팅
import { h, icon, clear } from '../../core/dom.js';
import { t, formatDateTime, formatTime, LANGS } from '../../core/i18n.js';
import { userId, isLoggedIn, isAdmin } from '../../core/store.js';
import { avatar, nameWithFlag, toast, spinner, errorBox, confirmDialog, openDialog } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';
import { imageUrl } from '../posts/posts.service.js';
import { openMapChooser } from '../map/mapChooser.js';
import { mountPlaceMap } from '../map/mapPicker.js';
import { openReportDialog } from '../reports/reportDialog.js';
import { cacheProfile, profileFor } from '../chat/chat.service.js';
import * as svc from './meetups.service.js';
import { catEmoji } from './categories.js';
import { isPast, isFull, spotsBar, statusBadges } from './meetupCard.js';

const profileLink = (p, ...kids) => h('a', { class: 'person', href: `#/u/${encodeURIComponent(p.username)}` }, ...kids);

function errText(ex) {
  const m = String(ex?.message ?? '');
  if (/meetup_full/.test(m)) return t('meet.err.full');
  if (/meetup_closed/.test(m)) return t('meet.err.closed');
  if (/host_cannot_leave/.test(m)) return t('meet.err.hostLeave');
  return friendlyError(ex);
}

export async function meetupDetailView({ root, params }) {
  const first = await svc.getMeetup(params.id);
  if (!first) { root.append(errorBox(t('meet.notFound'))); return; }

  const me = userId();
  let m = first;
  let members = [];
  let stopMap = () => {};
  let stopChat = () => {};
  let alive = true;
  const page = h('div', { class: 'meetup-detail stack' });
  root.append(page);

  async function reloadAll() {
    const [mm, mem] = await Promise.all([svc.getMeetup(m.id), isLoggedIn() ? svc.listMembers(m.id) : Promise.resolve([])]);
    if (!alive) return;
    if (!mm) { navigate('#/meetups'); return; }
    m = mm; members = mem;
    paint();
  }

  const isHost = () => m.host_id === me;
  const mine = () => members.find((x) => x.user_id === me);
  const joined = () => members.filter((x) => x.status === 'joined');
  const pending = () => members.filter((x) => x.status === 'pending');
  const over = () => m.is_cancelled || isPast(m);

  // ---------------- 참여 / 나가기 ----------------
  async function join() {
    if (!isLoggedIn()) { navigate(`#/login?next=${encodeURIComponent(location.hash)}`); return; }
    let note = '';
    if (m.approval) {
      const ta = h('textarea', { rows: 3, maxlength: 200, placeholder: t('meet.noteHint'), 'aria-label': t('meet.noteHint') });
      const ok = await new Promise((resolve) => {
        const form = h('form', { class: 'dialog-body stack', method: 'dialog' },
          h('h3', null, t('meet.requestTitle')), h('p', { class: 'muted' }, t('meet.requestText')), ta,
          h('div', { class: 'dialog-actions' },
            h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => dlg.close('cancel') }, t('common.cancel')),
            h('button', { class: 'btn btn-primary', type: 'submit' }, t('meet.sendRequest'))));
        const dlg = openDialog(form, { onClose: () => resolve(form.dataset.ok === '1') });
        form.addEventListener('submit', (e) => { e.preventDefault(); form.dataset.ok = '1'; note = ta.value.trim(); dlg.close('ok'); });
      });
      if (!ok) return;
    }
    try {
      const status = await svc.joinMeetup(m.id, note);
      toast(status === 'pending' ? t('meet.requested') : t('meet.joinedToast'), 'success');
      await reloadAll();
    } catch (ex) { toast(errText(ex), 'error'); await reloadAll().catch(() => {}); }
  }
  async function leave() {
    if (!(await confirmDialog(mine()?.status === 'pending' ? t('meet.cancelRequestConfirm') : t('meet.leaveConfirm'), { danger: true }))) return;
    try { await svc.leaveMeetup(m.id); toast(t('meet.left'), 'success'); await reloadAll(); } catch (ex) { toast(errText(ex), 'error'); }
  }
  async function decide(uid, accept) {
    try { await svc.decideMember(m.id, uid, accept); await reloadAll(); } catch (ex) { toast(errText(ex), 'error'); await reloadAll().catch(() => {}); }
  }
  async function kick(uid) {
    if (!(await confirmDialog(t('meet.removeConfirm'), { danger: true }))) return;
    try { await svc.removeMember(m.id, uid); await reloadAll(); } catch (ex) { toast(errText(ex), 'error'); }
  }
  async function toggleCancel() {
    if (!(await confirmDialog(m.is_cancelled ? t('meet.reopenConfirm') : t('meet.cancelConfirm'), { danger: !m.is_cancelled }))) return;
    try { await svc.setCancelled(m.id, !m.is_cancelled); await reloadAll(); toast(t('common.saved'), 'success'); } catch (ex) { toast(errText(ex), 'error'); }
  }
  async function remove() {
    if (!(await confirmDialog(t('meet.deleteConfirm'), { danger: true }))) return;
    try { await svc.deleteMeetup(m); toast(t('meet.deleted'), 'success'); navigate('#/meetups'); } catch (ex) { toast(errText(ex), 'error'); }
  }
  async function share() {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: m.title, url });
      else { await navigator.clipboard.writeText(url); toast(t('meet.linkCopied'), 'success'); }
    } catch { /* 사용자가 공유를 취소한 경우 */ }
  }

  // ---------------- 단체 채팅 ----------------
  function chatSection() {
    const list = h('div', { class: 'msg-list mm-list', role: 'log', 'aria-live': 'polite' });
    const scroller = h('div', { class: 'mm-scroll' }, list);
    const input = h('textarea', { rows: 1, maxlength: 500, placeholder: t('chat.placeholder'), 'aria-label': t('chat.placeholder') });
    const sendBtn = h('button', { class: 'btn btn-primary send-btn', type: 'submit', 'aria-label': t('chat.send') }, icon('send', 20));
    const form = h('form', { class: 'chat-composer' }, input, sendBtn);
    const ids = new Set();
    const toBottom = () => { scroller.scrollTop = scroller.scrollHeight; };

    const msgEl = (msg) => {
      const mineMsg = msg.author_id === me;
      const el = h('div', { class: `msg${mineMsg ? ' mine' : ''}`, 'data-id': String(msg.id) },
        !mineMsg && profileLink(msg.author ?? { username: '' }, avatar(msg.author, 32)),
        h('div', { class: 'msg-bubble' },
          !mineMsg && h('span', { class: 'msg-author' }, nameWithFlag(msg.author)),
          h('p', { class: 'msg-text' }, msg.body),
          h('span', { class: 'msg-time' }, formatTime(msg.created_at),
            (mineMsg || isHost()) && h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.delete'), onClick: async () => {
              try { await svc.deleteMessage(msg.id); el.remove(); ids.delete(msg.id); } catch (ex) { toast(errText(ex), 'error'); }
            } }, icon('trash', 12)))));
      return el;
    };
    const add = (msg) => {
      if (ids.has(msg.id)) return;
      ids.add(msg.id); cacheProfile(msg.author);
      list.querySelector('.empty-chat')?.remove();
      list.append(msgEl(msg));
    };
    async function load() {
      try {
        const msgs = await svc.listMessages(m.id);
        clear(list);
        if (!msgs.length) list.append(h('p', { class: 'muted center pad empty-chat' }, t('meet.chatEmpty')));
        msgs.forEach(add); toBottom();
      } catch (ex) { list.replaceChildren(errorBox(errText(ex), load)); }
    }
    async function send() {
      const body = input.value.trim();
      if (!body || sendBtn.disabled) return;
      sendBtn.disabled = true;
      try { const msg = await svc.sendMessage(m.id, body); input.value = ''; add(msg); toBottom(); }
      catch (ex) { toast(errText(ex), 'error'); } finally { sendBtn.disabled = false; input.focus(); }
    }
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    load();
    stopChat();
    stopChat = svc.subscribeMessages(m.id, async (row) => {
      if (ids.has(row.id)) return;
      const author = row.author ?? await profileFor(row.author_id);
      const stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
      add({ ...row, author });
      if (stick) toBottom();
    }, load);
    return h('section', { class: 'card mm-chat' }, h('h2', null, icon('chat', 20), ' ', t('meet.groupChat')), h('p', { class: 'muted small' }, t('meet.groupChatHint')), scroller, form);
  }

  // ---------------- 화면 그리기 ----------------
  function actionBar() {
    if (m.is_cancelled) return h('p', { class: 'notice notice-bad' }, t('meet.cancelledNotice'));
    if (isPast(m)) return h('p', { class: 'notice' }, t('meet.endedNotice'));
    if (!isLoggedIn()) return h('a', { class: 'btn btn-primary btn-lg', href: `#/login?next=${encodeURIComponent(location.hash)}` }, t('meet.loginToJoin'));
    if (isHost()) return h('p', { class: 'notice' }, icon('check', 16), t('meet.youAreHost'));
    const my = mine();
    if (my?.status === 'joined') return h('div', { class: 'stack' }, h('p', { class: 'notice notice-good' }, icon('check', 16), t('meet.youAreIn')),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: leave }, t('meet.leave')));
    if (my?.status === 'pending') return h('div', { class: 'stack' }, h('p', { class: 'notice notice-warn' }, icon('clock', 16), t('meet.requestPending')),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: leave }, t('meet.cancelRequest')));
    if (!m.approval && isFull(m)) return h('button', { class: 'btn btn-primary btn-lg', type: 'button', disabled: true }, t('meet.full'));
    return h('button', { class: 'btn btn-primary btn-lg', type: 'button', onClick: join }, m.approval ? t('meet.requestJoin') : t('meet.join'));
  }

  function hostPanel() {
    if (!isHost()) return null;
    const req = pending();
    return h('section', { class: 'card stack host-panel' },
      h('h2', null, icon('shield', 20), ' ', t('meet.hostTools')),
      req.length > 0 && h('div', { class: 'stack' }, h('h3', null, t('meet.requests', { n: req.length })),
        req.map((r) => h('div', { class: 'request-row' },
          profileLink(r.user, avatar(r.user, 40)),
          h('div', { class: 'request-text' }, profileLink(r.user, nameWithFlag(r.user)), r.note && h('p', { class: 'muted small' }, `“${r.note}”`)),
          h('div', { class: 'request-actions' },
            h('button', { class: 'btn btn-primary btn-sm', type: 'button', onClick: () => decide(r.user_id, true) }, t('meet.approve')),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onClick: () => decide(r.user_id, false) }, t('meet.decline')))))),
      h('div', { class: 'actions wrap' },
        !isPast(m) && h('a', { class: 'btn btn-soft', href: `#/meetups/${m.id}/edit` }, icon('edit', 16), t('common.edit')),
        !isPast(m) && h('button', { class: 'btn btn-soft', type: 'button', onClick: toggleCancel }, m.is_cancelled ? t('meet.reopen') : t('meet.cancel')),
        h('button', { class: 'btn btn-text danger', type: 'button', onClick: remove }, icon('trash', 16), t('common.delete'))));
  }

  function paint() {
    stopMap(); stopMap = () => {};
    const mini = h('div', { class: 'map-mini' });
    const langs = (m.languages ?? []).map((c) => LANGS.find((l) => l.code === c)?.label ?? c);
    const crew = joined();
    const my = mine();
    clear(page);
    page.append(
      h('a', { class: 'back-link', href: '#/meetups' }, icon('back', 16), t('meet.back')),
      h('div', { class: 'card meetup-head' },
        m.cover && h('img', { class: 'md-cover', src: imageUrl(m.cover), alt: '', decoding: 'async', onError: (e) => e.target.remove() }),
        h('div', { class: 'md-body stack' },
          h('div', { class: 'mc-badges' }, h('span', { class: 'badge badge-soft' }, `${catEmoji(m.category)} ${t(`meet.cat.${m.category}`)}`), statusBadges({ ...m, my_status: undefined })),
          h('h1', null, m.title),
          profileLink(m.host, avatar(m.host, 40), h('span', { class: 'person-text' }, h('small', { class: 'muted' }, t('meet.hostedBy')), nameWithFlag(m.host))))),
      h('div', { class: 'card stack' },
        h('div', { class: 'md-facts' },
          h('div', { class: 'md-fact' }, icon('calendar', 20), h('div', null, h('strong', null, formatDateTime(m.starts_at)))),
          h('div', { class: 'md-fact' }, icon('pin', 20), h('div', null, h('strong', null, m.place_name),
            h('button', { class: 'btn btn-text btn-sm map-open', type: 'button', onClick: () => openMapChooser({ lat: m.lat, lng: m.lng, name: m.place_name }) }, t('map.openIn'), ' ', icon('external', 12)))),
          h('div', { class: 'md-fact' }, icon('users', 20), h('div', null, spotsBar(m), m.approval && h('small', { class: 'muted' }, t('meet.approvalNote')))),
          langs.length > 0 && h('div', { class: 'md-fact' }, icon('globe', 20), h('div', null, h('strong', null, langs.join(' · ')))),
          m.cost_note && h('div', { class: 'md-fact' }, icon('star', 20), h('div', null, h('strong', null, m.cost_note)))),
        mini, h('p', { class: 'hint small' }, icon('pin', 12), ' ', t('map.openInHint'))),
      h('div', { class: 'card stack' }, h('h2', null, t('meet.about')), h('p', { class: 'md-desc' }, m.description)),
      h('div', { class: 'card stack' },
        h('h2', null, t('meet.who', { n: m.joined_count })),
        isLoggedIn()
          ? h('div', { class: 'people-grid' }, crew.map((x) => h('div', { class: 'person-tile' },
              profileLink(x.user, avatar(x.user, 48)), profileLink(x.user, h('span', { class: 'person-name' }, nameWithFlag(x.user))),
              x.user_id === m.host_id && h('span', { class: 'badge badge-soft' }, t('meet.hostBadge')),
              isHost() && x.user_id !== me && h('button', { class: 'btn btn-text btn-sm danger', type: 'button', onClick: () => kick(x.user_id) }, t('meet.remove')))))
          : h('p', { class: 'muted' }, t('meet.loginToSee'))),
      actionBar(),
      hostPanel(),
      (my?.status === 'joined' || isHost()) ? chatSection() : (isLoggedIn() && !over() && h('p', { class: 'muted small center' }, icon('lock', 14), ' ', t('meet.chatLocked'))),
      h('section', { class: 'card safety-card stack' }, h('h2', null, icon('shield', 20), ' ', t('meet.safetyTitle')),
        h('ul', { class: 'safety-list' }, [1, 2, 3, 4].map((n) => h('li', null, t(`meet.safety${n}`))))),
      h('div', { class: 'actions wrap center-actions' },
        h('button', { class: 'btn btn-soft btn-sm', type: 'button', onClick: share }, icon('share', 14), t('meet.share')),
        !isHost() && isLoggedIn() && h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: () => openReportDialog('meetup', m.id) }, icon('flag', 14), t('report.title')),
        isAdmin() && !isHost() && h('button', { class: 'btn btn-text btn-sm danger', type: 'button', onClick: remove }, icon('trash', 14), t('common.delete'))));
    mountPlaceMap(mini, { lat: m.lat, lng: m.lng, interactive: true, wheel: 'smart', onClick: () => openMapChooser({ lat: m.lat, lng: m.lng, name: m.place_name }) }).then((stop) => { if (alive) stopMap = stop; else stop(); }).catch(() => {});
  }

  try { members = isLoggedIn() ? await svc.listMembers(m.id) : []; } catch (ex) { console.warn('[meetup] members failed', ex); }
  paint();
  return () => { alive = false; stopMap(); stopChat(); };
}
