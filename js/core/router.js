// router.js | 주소(#/...)가 바뀌면 알맞은 화면을 불러와 보여주는 "안내원"
import { ROUTES } from '../routes.js';
import { state, on, emit, isLoggedIn, isAdmin } from './store.js';
import { t } from './i18n.js';
import { toast, spinner, errorBox, emptyState } from './ui.js';
import { friendlyError } from './errors.js';
import { safeNext } from './utils.js';
import { h } from './dom.js';

const compiled = ROUTES.map((r) => ({
  ...r,
  regex: new RegExp('^' + r.path.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'),
}));

let view = null;        // 화면이 그려질 영역
let token = 0;          // "가장 최근 이동"만 유효하게 하는 번호표
let activeCleanup = null;
let lastPath = null;

export function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const i = raw.indexOf('?');
  const path = (i < 0 ? raw : raw.slice(0, i)).replace(/\/+$/, '') || '/';
  return { path, query: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)) };
}

function find(path) {
  for (const r of compiled) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      for (const [k, v] of Object.entries(m.groups ?? {})) {
        try { params[k] = decodeURIComponent(v); } catch { return null; }
      }
      return { route: r, params };
    }
  }
  return null;
}

export function navigate(hash, { replace = false } = {}) {
  const target = safeNext(hash, '#/home');
  if (replace) location.replace(target);
  else location.hash = target;
}

export const refreshRoute = () => run();

function stop() {
  try { activeCleanup?.(); } catch (e) { console.error('[router] cleanup failed', e); }
  activeCleanup = null;
}

async function run() {
  const my = ++token;
  stop();
  const { path, query } = parseHash();
  const found = find(path);

  if (!found) {
    state.nav = null;
    emit('route');
    view.replaceChildren(emptyState({ title: t('common.notFound'), text: t('common.notFoundText'),
      action: h('a', { class: 'btn btn-primary', href: '#/home' }, t('nav.home')) }));
    return;
  }

  const { route, params } = found;
  if (route.redirect) return navigate(route.redirect, { replace: true });

  // ---- 접근 권한 확인 (화면 이동용. 진짜 보안은 서버 규칙이 담당) ----
  if (route.access === 'user' && !isLoggedIn()) {
    return navigate(`#/login?next=${encodeURIComponent(location.hash)}`, { replace: true });
  }
  if (route.access === 'guest' && isLoggedIn()) {
    return navigate(safeNext(query.get('next')), { replace: true });
  }
  if (route.access === 'admin') {
    if (!isLoggedIn()) return navigate(`#/login?next=${encodeURIComponent(location.hash)}`, { replace: true });
    if (!isAdmin()) {
      toast(t('err.forbidden'), 'error');
      return navigate('#/home', { replace: true });
    }
  }

  state.nav = route.nav ?? null;
  emit('route');
  view.replaceChildren(spinner());

  try {
    const mod = await route.load();
    if (my !== token) return;                       // 그 사이 다른 곳으로 이동했으면 중단
    view.replaceChildren();
    const cleanup = await mod[route.fn]({ root: view, params, query });
    if (my !== token) { cleanup?.(); return; }
    activeCleanup = cleanup ?? null;
    if (lastPath !== path) window.scrollTo(0, 0);
    lastPath = path;
  } catch (err) {
    if (my !== token) return;
    view.replaceChildren(errorBox(friendlyError(err), run));
  }
}

export function startRouter(viewEl) {
  view = viewEl;
  window.addEventListener('hashchange', run);
  on('auth', run);    // 로그인/로그아웃 하면 현재 화면을 다시 판단
  on('lang', run);    // 언어를 바꾸면 현재 화면을 새 언어로 다시 그림
  run();
}
