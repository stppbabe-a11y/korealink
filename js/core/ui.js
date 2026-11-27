// ui.js | 여러 화면에서 함께 쓰는 작은 화면 조각들 (알림, 확인창, 아바타 등)
import { h, icon } from './dom.js';
import { t } from './i18n.js';
import { publicUrl } from './supabase.js';
import { countryName } from './countries.js';
import { avatarSvg } from '../features/avatar/avatar.render.js';

// ---- 잠깐 떴다 사라지는 알림 ------------------------------------------------
export function toast(message, type = 'info') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = h('div', { id: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: `toast toast-${type}` }, message);
  host.append(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ---- 팝업(대화상자) ----------------------------------------------------------
export function openDialog(content, { onClose } = {}) {
  const dlg = h('dialog', { class: 'dialog' }, content);
  document.body.append(dlg);
  dlg.addEventListener('close', () => {
    dlg.remove();
    onClose?.(dlg.returnValue);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); }); // 바깥을 누르면 닫힘
  dlg.showModal();
  return dlg;
}

// "정말 삭제할까요?" 같은 확인창. 확인하면 true, 취소하면 false
export function confirmDialog(message, { title, confirmText, cancelText, danger = false } = {}) {
  return new Promise((resolve) => {
    const form = h('form', { method: 'dialog', class: 'dialog-body' },
      title && h('h3', null, title),
      h('p', null, message),
      h('div', { class: 'dialog-actions' },
        h('button', { class: 'btn btn-ghost', value: 'cancel', formnovalidate: true }, cancelText ?? t('common.cancel')),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, value: 'ok', autofocus: true }, confirmText ?? t('common.confirm'))));
    openDialog(form, { onClose: (rv) => resolve(rv === 'ok') });
  });
}

// ---- 상태 표시 ---------------------------------------------------------------
export const spinner = () => h('div', { class: 'spinner-wrap', role: 'status', 'aria-label': t('common.loading') }, h('div', { class: 'spinner' }));

export function emptyState({ iconName = 'compass', title, text, action } = {}) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon' }, icon(iconName, 32)),
    title && h('h3', null, title),
    text && h('p', null, text),
    action);
}

export function errorBox(message, onRetry) {
  return h('div', { class: 'empty empty-error', role: 'alert' },
    h('p', null, message),
    onRetry && h('button', { class: 'btn btn-soft', onClick: onRetry }, t('common.retry')));
}

// ---- 아바타 (사진 대신 직접 꾸민 캐릭터. 안 꾸민 회원은 이름으로 정해지는 기본 캐릭터) ----------
export function avatar(profile, size = 40) {
  const wrap = h('span', { class: 'avatar', 'aria-hidden': 'true' });
  wrap.style.setProperty('--size', `${size}px`);
  wrap.append(avatarSvg(profile?.avatar_cfg, { seed: profile?.id || profile?.username || profile?.display_name || '?' }));
  return wrap;
}

export function displayName(profile) {
  return profile?.display_name || profile?.username || '—';
}

// 국기: 국가를 설정한 회원만 표시. 그림 파일(icons/flags)이라 Windows/안드로이드/아이폰 어디서나 똑같이 보입니다.
export function flagImg(code, height = 15) {
  if (!/^[A-Z]{2}$/.test(code ?? '')) return null;
  const img = h('img', { class: 'flag-img', src: `icons/flags/${code.toLowerCase()}.svg`, alt: '', width: Math.round(height * 4 / 3), height, loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.remove());
  return img;
}
export function flagBadge(code) {
  const img = flagImg(code);
  if (!img) return null;
  return h('span', { class: 'flag', role: 'img', 'aria-label': countryName(code), title: countryName(code) }, img);
}

// 이름 + 국기 (글 카드/댓글/채팅/글 상세에서 공통 사용)
export function nameWithFlag(profile) {
  return h('span', { class: 'name-flag' }, displayName(profile), flagBadge(profile?.country));
}
