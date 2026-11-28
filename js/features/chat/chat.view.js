// chat.view.js | 게스트 채팅방 목록 / 채팅방 화면
import { h, icon, clear } from '../../core/dom.js';
import { t, formatTime, formatDate } from '../../core/i18n.js';
import { userId, isAdmin, hasSession, isLoggedIn, isGuest } from '../../core/store.js';
import { avatar, nameWithFlag, confirmDialog, toast, spinner, emptyState, errorBox, openDialog } from '../../core/ui.js';
import { refreshRoute } from '../../core/router.js';
import { signInAsGuest } from '../auth/auth.service.js';
import { imageUrl, validateImageFiles } from '../posts/posts.service.js';
import { openMapPicker } from '../map/mapPicker.js';
import { openMapChooser } from '../map/mapChooser.js';
import { friendlyError } from '../../core/errors.js';
import { openReportDialog } from '../reports/reportDialog.js';
import * as chat from './chat.service.js';

// ------------------------------------------------------------------ 로그인 안 한 방문자: 게스트로 입장
function guestGate() {
  const btn = h('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button' }, icon('chat', 20), t('chat.guestEnter'));
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try { await signInAsGuest(); refreshRoute(); }
    catch (ex) { console.warn('[chat] guest sign-in failed', ex); btn.disabled = false; toast(t('chat.guestUnavailable'), 'error'); }
  });
  return h('div', { class: 'card stack guest-gate' },
    h('span', { class: 'room-icon' }, icon('chat', 26)),
    h('h2', null, t('chat.gateTitle')),
    h('p', { class: 'muted' }, t('chat.gateText')),
    btn,
    h('a', { class: 'btn btn-outline btn-block', href: `#/login?next=${encodeURIComponent(location.hash)}` }, t('auth.login')),
    h('p', { class: 'hint' }, icon('lock', 14), ' ', t('chat.guestLimit')));
}

// ------------------------------------------------------------------ 방 목록
export async function roomListView({ root }) {
  if (!hasSession()) {
    root.append(h('section', { class: 'hero hero-chat' }, h('h1', null, t('chat.title')), h('p', null, t('chat.subtitle'))), guestGate());
    return;
  }
  const rooms = await chat.listRooms();
  root.append(
    h('section', { class: 'hero hero-chat' }, h('h1', null, t('chat.title')), h('p', null, t('chat.subtitle'))),
    rooms.length === 0
      ? emptyState({ iconName: 'chat', title: t('chat.noRooms') })
      : h('div', { class: 'room-list' }, rooms.map((r) =>
          h('a', { class: `card room-card${r.is_active ? '' : ' closed'}`, href: `#/chat/${encodeURIComponent(r.slug)}` },
            h('span', { class: 'room-icon' }, icon('chat', 22)),
            h('span', { class: 'room-text' },
              h('strong', null, chat.roomName(r), !r.is_active && ` (${t('chat.closed')})`),
              h('span', { class: 'muted' }, chat.roomDesc(r)))))));
}

// ------------------------------------------------------------------ 채팅방
export async function roomView({ root, params }) {
  if (!hasSession()) { root.append(guestGate()); return; }
  const room = await chat.getRoom(params.slug);
  if (!room) {
    root.append(errorBox(t('chat.roomNotFound')));
    return;
  }

  const me = userId();
  const ids = new Set();                  // 화면에 있는 메시지 id (중복 방지)
  const rows = new Map();                 // id -> { el, msg }
  let oldest = null;
  let lastDay = '';

  const list = h('div', { class: 'msg-list', role: 'log', 'aria-live': 'polite' });
  const olderWrap = h('div', { class: 'center' });
  const scroller = h('div', { class: 'msg-scroll' }, olderWrap, list);
  const input = h('textarea', { rows: 1, maxlength: 500, placeholder: t('chat.placeholder'), 'aria-label': t('chat.placeholder'), disabled: !room.is_active });
  const sendBtn = h('button', { class: 'btn btn-primary send-btn', type: 'submit', 'aria-label': t('chat.send'), disabled: !room.is_active }, icon('send', 20));
  // + 버튼: 사진 / 지도(위치) 보내기 (로그인한 회원만. 게스트는 안내 문구만 보임 — 서버도 한 번 더 막음)
  const canAttach = isLoggedIn() && room.is_active;
  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/heic,image/*', hidden: true, 'aria-hidden': 'true', tabindex: -1 });
  const plusBtn = h('button', { class: 'btn plus-btn', type: 'button', 'aria-label': t('chat.attach'), 'aria-haspopup': 'true', 'aria-expanded': 'false' }, icon('plus', 22));
  const photoItem = h('button', { class: 'attach-item', type: 'button', role: 'menuitem' }, h('span', { class: 'ai-icon ai-photo' }, icon('camera', 20)), t('chat.photo'));
  const placeItem = h('button', { class: 'attach-item', type: 'button', role: 'menuitem' }, h('span', { class: 'ai-icon ai-place' }, icon('pin', 20)), t('chat.location'));
  const menu = h('div', { class: 'attach-menu', role: 'menu', hidden: true }, photoItem, placeItem);
  const closeMenu = () => { menu.hidden = true; plusBtn.setAttribute('aria-expanded', 'false'); };
  plusBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; plusBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
  const onDocClick = (e) => { if (!menu.contains(e.target) && e.target !== plusBtn) closeMenu(); };
  document.addEventListener('click', onDocClick);

  async function afterSend(promise) {                       // 사진/위치 전송 공통 처리
    sendBtn.disabled = true; plusBtn.disabled = true;
    try {
      const msg = await promise;
      list.querySelector('.empty-chat')?.remove();
      appendMessage(msg);
      toBottom();
    } catch (ex) { toast(friendlyError(ex), 'error'); }
    finally { sendBtn.disabled = !room.is_active; plusBtn.disabled = false; }
  }
  photoItem.addEventListener('click', () => { closeMenu(); fileInput.value = ''; fileInput.click(); });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try { validateImageFiles([file]); } catch (ex) { return toast(friendlyError(ex), 'error'); }
    const caption = input.value.trim();
    input.value = ''; input.style.height = '';
    toast(t('chat.uploading'));
    afterSend(chat.sendPhoto(room.id, file, caption));
  });
  placeItem.addEventListener('click', async () => {
    closeMenu();
    const place = await openMapPicker(null);                 // 지도에서 고르기 (검색/클릭, 무료 지도)
    if (!place) return;
    afterSend(chat.sendMessage(room.id, { body: '', lat: place.lat, lng: place.lng, place_name: place.place_name }));
  });

  const form = h('form', { class: 'chat-composer' }, canAttach && h('div', { class: 'attach-wrap' }, plusBtn, menu, fileInput), input, sendBtn);
  const guestBanner = (isGuest() && room.is_active)
    ? h('div', { class: 'guest-banner' }, icon('lock', 14), h('span', null, t('chat.guestBanner')),
        h('a', { class: 'btn btn-primary btn-sm', href: `#/login?next=${encodeURIComponent(location.hash)}` }, t('auth.login')))
    : null;
  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
  const toBottom = () => {
    scroller.scrollTop = scroller.scrollHeight;
    requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });   // 글이 그려진 뒤 한 번 더
    setTimeout(() => { scroller.scrollTop = scroller.scrollHeight; }, 250);          // 폰 키보드가 올라오는 동안 한 번 더
  };
  // 폰 키보드가 올라오거나 내려가 화면 높이가 바뀔 때, 맨 아래를 보고 있었다면 맨 아래를 유지
  let wasAtBottom = true;
  scroller.addEventListener('scroll', () => { wasAtBottom = nearBottom(); }, { passive: true });
  const onResize = () => { if (wasAtBottom) scroller.scrollTop = scroller.scrollHeight; };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);

  // ---- 메시지 한 줄 만들기 ------------------------------------------------------
  function messageEl(msg) {
    const mine = msg.author_id === me;
    const bodyEl = h('p', { class: 'msg-text' }, msg.body);           // 글자로만 표시
    bodyEl.hidden = !msg.body;
    const attach = msg.image ? h('button', { class: 'msg-photo', type: 'button', 'aria-label': t('chat.photo'), onClick: () => openPhoto(msg.image) },
        h('img', { src: imageUrl(msg.image, { thumb: true }), alt: '', loading: 'lazy', decoding: 'async', onError: (e) => { e.target.closest('button')?.remove(); } }))
      : (msg.lat != null && msg.lng != null) ? h('button', { class: 'msg-place', type: 'button', onClick: () => openMapChooser({ lat: msg.lat, lng: msg.lng, name: msg.place_name }) },
        h('span', { class: 'msg-place-icon' }, icon('pin', 20)),
        h('span', { class: 'msg-place-text' }, h('strong', null, msg.place_name || t('chat.sharedLocation')), h('span', null, t('chat.openMap'))))
      : null;
    const meta = h('span', { class: 'msg-time' }, formatTime(msg.created_at), msg.edited_at && ` · ${t('common.edited')}`);
    const tools = h('div', { class: 'msg-tools' });

    if (mine) {
      tools.append(
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.edit'), onClick: () => startEdit() }, icon('edit', 14)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.delete'), onClick: () => remove() }, icon('trash', 14)));
    } else {
      tools.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('report.title'), onClick: () => openReportDialog('message', msg.id) }, icon('flag', 14)));
      if (isAdmin()) tools.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('common.delete'), onClick: () => remove() }, icon('trash', 14)));
    }

    const el = h('div', { class: `msg${mine ? ' mine' : ''}`, dataset: { id: String(msg.id) } },
      !mine && h('a', { href: `#/u/${encodeURIComponent(msg.author?.username ?? '')}` }, avatar(msg.author, 32)),
      h('div', { class: 'msg-bubble-wrap' },
        !mine && h('a', { class: 'msg-author', href: `#/u/${encodeURIComponent(msg.author?.username ?? '')}`, title: t('profile.viewProfile') }, nameWithFlag(msg.author)),
        h('div', { class: 'msg-line' }, mine && tools, h('div', { class: `msg-bubble${attach ? ' has-attach' : ''}` }, attach, bodyEl), !mine && tools),
        meta));

    function startEdit() {
      const ta = h('textarea', { rows: 2, maxlength: 500, class: 'msg-edit' }, msg.body);
      const save = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, t('common.save'));
      const cancel = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, t('common.cancel'));
      const box = h('div', { class: 'msg-edit-box' }, ta, h('div', { class: 'composer-actions' }, cancel, save));
      bodyEl.hidden = true;
      bodyEl.after(box);
      ta.focus();
      cancel.addEventListener('click', () => { box.remove(); bodyEl.hidden = false; });
      save.addEventListener('click', async () => {
        const next = ta.value.trim();
        if (!next || next === msg.body) { box.remove(); bodyEl.hidden = false; return; }   // 바뀐 게 없으면 서버 요청 없음
        save.disabled = true;
        try {
          const res = await chat.editMessage(msg.id, next);
          applyUpdate({ ...msg, body: next, edited_at: res.edited_at });
          box.remove();
          bodyEl.hidden = false;
        } catch (ex) { save.disabled = false; toast(friendlyError(ex), 'error'); }
      });
    }

    async function remove() {
      if (!(await confirmDialog(t('chat.deleteConfirm'), { danger: true, confirmText: t('common.delete') }))) return;
      try { await chat.deleteMessage(msg.id, msg.image); removeRow(msg.id); }
      catch (ex) { toast(friendlyError(ex), 'error'); }
    }
    return el;
  }

  function dayDivider(iso) {
    const day = new Date(iso).toDateString();
    if (day === lastDay) return null;
    lastDay = day;
    return h('div', { class: 'day-divider' }, h('span', null, formatDate(iso, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })));
  }

  function appendMessage(msg) {
    if (ids.has(msg.id)) return;
    ids.add(msg.id);
    chat.cacheProfile(msg.author);
    const div = dayDivider(msg.created_at);
    if (div) list.append(div);
    const el = messageEl(msg);
    rows.set(msg.id, { el, msg });
    list.append(el);
    if (oldest === null || msg.id < oldest) oldest = msg.id;
  }

  function applyUpdate(msg) {
    const row = rows.get(msg.id);
    if (!row) return;
    const merged = { ...row.msg, ...msg, author: row.msg.author };
    const el = messageEl(merged);
    row.el.replaceWith(el);
    rows.set(msg.id, { el, msg: merged });
  }

  function removeRow(id) {
    const row = rows.get(id);
    if (!row) return;
    row.el.remove();
    rows.delete(id);
    ids.delete(id);
  }

  // ---- 처음 불러오기 / 이전 메시지 / 재연결 시 보충 -----------------------------------
  async function initial() {
    list.replaceChildren(spinner());
    try {
      const { messages, hasMore } = await chat.fetchMessages(room.id);
      clear(list);
      lastDay = '';
      if (messages.length === 0) list.append(h('p', { class: 'muted center pad empty-chat' }, t('chat.empty')));
      messages.forEach(appendMessage);
      showOlder(hasMore);
      toBottom();
    } catch (ex) { list.replaceChildren(errorBox(friendlyError(ex), initial)); }
  }

  function showOlder(hasMore) {
    olderWrap.replaceChildren(hasMore
      ? h('button', { class: 'btn btn-soft btn-sm', type: 'button', onClick: loadOlder }, t('chat.older'))
      : '');
  }

  async function loadOlder() {
    try {
      const { messages, hasMore } = await chat.fetchMessages(room.id, oldest);
      const prevHeight = scroller.scrollHeight;
      // 이전 메시지는 목록 맨 위에 끼워 넣음 (순서 유지를 위해 잠시 모아서 다시 그림)
      const current = [...rows.values()].map((r) => r.msg);
      ids.clear(); rows.clear(); clear(list); lastDay = ''; oldest = null;
      [...messages, ...current].forEach(appendMessage);
      showOlder(hasMore);
      scroller.scrollTop = scroller.scrollHeight - prevHeight;
    } catch (ex) { toast(friendlyError(ex), 'error'); }
  }

  async function catchUp() {
    try {
      const { messages } = await chat.fetchMessages(room.id);
      const stick = nearBottom();
      messages.forEach(appendMessage);
      if (stick) toBottom();
    } catch { /* 다음 실시간 메시지에서 다시 보충됨 */ }
  }

  // ---- 보내기 --------------------------------------------------------------------
  async function send() {
    const body = input.value.trim();
    if (!body || sendBtn.disabled) return;
    sendBtn.disabled = true;
    try {
      const msg = await chat.sendMessage(room.id, { body });
      input.value = '';
      input.style.height = '';
      list.querySelector('.empty-chat')?.remove();
      appendMessage(msg);
      toBottom();
    } catch (ex) {
      toast(friendlyError(ex), 'error');
    } finally {
      sendBtn.disabled = !room.is_active;
      input.focus();
    }
  }
  input.addEventListener('focus', () => setTimeout(toBottom, 300));   // 입력칸을 누르면(키보드 올라올 때) 최신 글이 보이게
  form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }   // 한글 입력 중 Enter 는 무시
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  root.classList.add('chat-mode');
  root.append(
    h('div', { class: 'chat-head' },
      h('a', { class: 'icon-btn', href: '#/chat', 'aria-label': t('common.back') }, icon('back', 20)),
      h('div', null, h('strong', null, chat.roomName(room)), h('span', { class: 'muted small' }, chat.roomDesc(room)))),
    scroller,
    guestBanner,
    room.is_active ? form : h('p', { class: 'muted center pad' }, t('chat.closedNotice')));

  await initial();

  const unsubscribe = chat.subscribe(room.id, {
    onInsert: async (row) => {
      if (ids.has(row.id)) return;
      const author = await chat.profileFor(row.author_id);
      const stick = nearBottom() || row.author_id === me;
      list.querySelector('.empty-chat')?.remove();
      appendMessage({ ...row, author });
      if (stick) toBottom();
    },
    onUpdate: (row) => applyUpdate(row),
    onDelete: (id) => removeRow(id),
    onReconnect: catchUp,
  });

  return () => { unsubscribe(); window.removeEventListener('resize', onResize); window.visualViewport?.removeEventListener('resize', onResize); document.removeEventListener('click', onDocClick); root.classList.remove('chat-mode'); };
}

// 사진 크게 보기 (원본 크기 사진은 이때만 내려받음 = 데이터 절약)
function openPhoto(path) {
  const dlg = openDialog(h('div', { class: 'dialog-body photo-viewer' },
    h('img', { src: imageUrl(path), alt: '' }),
    h('button', { class: 'btn btn-ghost btn-block', type: 'button', onClick: () => dlg.close('ok') }, t('common.close'))));
}
