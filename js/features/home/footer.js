// footer.js | 화면 맨 아래: 소개 / 커뮤니티 규칙 / 개인정보처리방침 / 문의 / SNS
//   연락처·SNS 주소는 js/config.js 의 CONTACT_EMAIL / SOCIAL 에 적은 것만 보입니다. (비어 있으면 숨김 = 가짜 링크 없음)
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { CONTACT_EMAIL, SOCIAL } from '../../config.js';
import { PRIVACY_URL } from '../legal/legalLinks.js';

const SOCIAL_LABEL = { instagram: 'Instagram', youtube: 'YouTube', x: 'X', facebook: 'Facebook' };
const safeUrl = (u) => (/^https:\/\/[^\s]+$/.test(u) ? u : '');
const safeMail = (m) => (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(m) ? m : '');

export function siteFooter() {
  const mail = safeMail(CONTACT_EMAIL ?? '');
  const social = Object.entries(SOCIAL ?? {}).filter(([, v]) => safeUrl(v));
  return h('div', { class: 'footer-inner' },
    h('p', { class: 'footer-tag' }, h('img', { src: 'icons/art/logo-mark.png', alt: '', width: 40, height: 24 }), h('strong', null, 'KoreaLink'), h('span', null, 'Travel · Meet · Explore Korea')),
    h('nav', { class: 'footer-links', 'aria-label': 'Footer' },
      h('a', { href: '#/about' }, t('foot.about')),
      h('a', { href: '#/guidelines' }, t('foot.guidelines')),
      h('a', { href: PRIVACY_URL, target: '_blank', rel: 'noopener' }, t('legal.privacy')),
      mail ? h('a', { href: `mailto:${mail}` }, icon('mail', 14), ' ', t('foot.contact')) : h('a', { href: '#/about' }, t('foot.contact'))),
    social.length ? h('div', { class: 'footer-social' }, social.map(([k, v]) =>
      h('a', { href: safeUrl(v), target: '_blank', rel: 'noopener noreferrer', 'aria-label': SOCIAL_LABEL[k] ?? k }, SOCIAL_LABEL[k] ?? k))) : null,
    h('p', { class: 'footer-copy' }, `© ${new Date().getFullYear()} KoreaLink`));
}
