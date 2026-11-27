// legalLinks.js | 개인정보처리방침 / 계정 삭제 안내 페이지 링크 (로그인 없이 누구나 열 수 있는 정적 페이지)
import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';

export const PRIVACY_URL = '/privacy.html';
export const DELETE_GUIDE_URL = '/delete-account.html';

export function legalLinks() {
  return h('span', { class: 'legal-links' },
    h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, t('legal.privacy')),
    ' · ',
    h('a', { href: DELETE_GUIDE_URL, target: '_blank', rel: 'noopener' }, t('legal.deleteGuide')));
}
