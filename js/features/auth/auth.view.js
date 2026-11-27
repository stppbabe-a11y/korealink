// auth.view.js | 로그인 화면: 구글 / 카카오톡 로그인만 가능합니다. (처음 로그인하면 계정이 자동으로 만들어집니다. 이메일 가입/로그인은 없습니다)
import { h } from '../../core/dom.js';
import { legalLinks } from '../legal/legalLinks.js';
import { t } from '../../core/i18n.js';
import { formError } from '../../core/form.js';
import { friendlyError } from '../../core/errors.js';
import * as auth from './auth.service.js';

export function loginView({ root }) {
  const err = formError();
  const social = (cls, label, fn) => {
    const btn = h('button', { class: `btn ${cls} btn-block`, type: 'button' }, label);
    btn.addEventListener('click', async () => {
      err.set('');
      btn.disabled = true;
      try { await fn(); } catch (ex) { err.set(friendlyError(ex)); btn.disabled = false; }
    });
    return btn;
  };
  root.append(h('div', { class: 'auth-wrap' }, h('div', { class: 'card auth-card stack' },
    h('h1', null, t('auth.loginTitle')),
    h('p', { class: 'muted' }, t('auth.googleOnlyHint')),
    social('btn-outline', t('auth.google'), auth.signInWithGoogle),
    social('btn-kakao', t('auth.kakao'), auth.signInWithKakao),
    err.el,
    h('p', { class: 'muted small center' }, t('legal.agree'), ' ', legalLinks()))));
}
