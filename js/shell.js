// shell.js | 앱의 겉틀: 상단바(로고/메뉴/언어/로그인) + 모바일 하단 메뉴 + 푸터
import { h, icon } from './core/dom.js';
import { t, LANGS, getLang, setLang } from './core/i18n.js';
import { state, on, isLoggedIn, isAdmin } from './core/store.js';
import { avatar } from './core/ui.js';
import { updateMyProfile } from './features/profile/profile.service.js';
import { siteFooter } from './features/home/footer.js';

// 컴퓨터 화면 위쪽 메뉴
const TOP = [
  { key: 'home', href: '#/home', icon: 'compass', label: 'nav.discover' },
  { key: 'explore', href: '#/explore', icon: 'users', label: 'nav.community' },
  { key: 'meetups', href: '#/meetups', icon: 'calendar', label: 'nav.meetups' },
  { key: 'map', href: '#/map', icon: 'map', label: 'nav.map' },
  { key: 'events', href: '#/events', icon: 'globe', label: 'nav.tips' },
  { key: 'chat', href: '#/chat', icon: 'chat', label: 'nav.chat' },
];
// 폰 아래쪽 고정 메뉴: Home / Explore / Meetups / Travel Tips / Chat / Profile
const BOTTOM = [
  { key: 'home', href: '#/home', icon: 'home', label: 'nav.home' },
  { key: 'explore', href: '#/explore', icon: 'compass', label: 'nav.explore' },
  { key: 'meetups', href: '#/meetups', icon: 'calendar', label: 'nav.meetups' },
  { key: 'events', href: '#/events', icon: 'globe', label: 'nav.tips' },
  { key: 'chat', href: '#/chat', icon: 'chat', label: 'nav.chat' },
  { key: 'profile', href: '#/profile', icon: 'user', label: 'nav.profile' },
];

function langSelect() {
  const sel = h('select', { class: 'lang-select', 'aria-label': t('profile.language') },
    LANGS.map((l) => h('option', { value: l.code, selected: l.code === getLang() }, l.label)));
  sel.addEventListener('change', async () => {
    setLang(sel.value);
    if (isLoggedIn()) {                                         // 로그인 상태면 선택한 언어를 계정에도 기억 (한 칸만 저장)
      try { await updateMyProfile({ language: sel.value }); } catch (e) { console.warn('[shell] language save failed', e); }
    }
  });
  return sel;
}

export function mountShell(headerEl, navEl, footerEl) {
  const link = (it, size, active) => h('a', { class: `nav-link${active === it.key ? ' active' : ''}`, href: it.href, 'aria-current': active === it.key ? 'page' : null },
    icon(it.icon, size), h('span', null, t(it.label)));

  function paint() {
    const active = state.nav;
    const top = TOP.map((it) => link(it, 20, active));
    if (isAdmin()) top.push(link({ key: 'admin', href: '#/admin', icon: 'shield', label: 'nav.admin' }, 20, active));

    headerEl.replaceChildren(
      h('div', { class: 'header-inner' },
        h('a', { class: 'brand', href: '#/home', 'aria-label': t('app.name') },
          h('img', { class: 'brand-mark', src: 'icons/art/logo-mark.png', alt: '', width: 48, height: 29 }),
          h('span', null, 'KoreaLink')),
        h('nav', { class: 'top-nav', 'aria-label': 'Main' }, ...top),
        h('div', { class: 'header-right' },
          isAdmin() && h('a', { class: 'header-icon only-mobile', href: '#/admin', 'aria-label': t('nav.admin') }, icon('shield', 20)),
          langSelect(),
          isLoggedIn()
            ? h('a', { class: 'header-avatar', href: '#/profile', 'aria-label': t('nav.mypage') }, avatar(state.profile, 36))
            : h('a', { class: 'btn btn-primary btn-sm signin-btn', href: '#/login' }, icon('user', 16), t('auth.login')))));

    navEl.replaceChildren(...BOTTOM.map((it) => link(it, 22, active)));
    navEl.setAttribute('aria-label', 'Main');
    footerEl?.replaceChildren(siteFooter());
  }
  paint();
  on('route', paint);
  on('auth', paint);
  on('lang', paint);
}
