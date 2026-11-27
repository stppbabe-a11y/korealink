// about.view.js | 서비스 소개 / 커뮤니티 규칙 (푸터에서 열리는 간단한 안내 화면)
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { CONTACT_EMAIL } from '../../config.js';

const GUIDE = [1, 2, 3, 4, 5];

function about() {
  return h('section', { class: 'card stack about-card', id: 'about' },
    h('h2', null, t('about.title')),
    h('p', null, t('about.p1')), h('p', null, t('about.p2')),
    /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(CONTACT_EMAIL ?? '')
      ? h('p', null, icon('mail', 16), ' ', h('a', { href: `mailto:${CONTACT_EMAIL}` }, CONTACT_EMAIL)) : null);
}

function guide() {
  return h('section', { class: 'card stack about-card', id: 'guidelines' },
    h('h2', null, t('guide.title')),
    h('ul', { class: 'guide-list' }, GUIDE.map((n) => h('li', null, icon('check', 16), h('span', null, t(`guide.${n}`))))));
}

export function aboutView({ root }) {
  root.append(h('a', { class: 'back-link', href: '#/home' }, icon('back', 18), t('common.back')), about(), guide());
}
export function guidelinesView({ root }) {
  root.append(h('a', { class: 'back-link', href: '#/home' }, icon('back', 18), t('common.back')), guide(), about());
}
