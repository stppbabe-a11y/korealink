// app.js | 앱 시작점. 순서: 언어 -> 설정 확인 -> 로그인 확인 -> 겉틀 -> 화면 안내원(라우터)
import { h } from './core/dom.js';
import { initLang, t } from './core/i18n.js';
import { isConfigured } from './core/supabase.js';

const headerEl = document.getElementById('header');
const navEl = document.getElementById('bottom-nav');
const footerEl = document.getElementById('footer');
const viewEl = document.getElementById('view');

// config.js 를 아직 채우지 않은 경우: 친절한 안내 화면
function showSetup() {
  document.body.classList.add('no-nav');
  viewEl.replaceChildren(h('div', { class: 'auth-wrap' }, h('div', { class: 'card stack' },
    h('h1', null, t('setup.title')),
    h('p', null, t('setup.text')),
    h('ol', { class: 'steps' }, [1, 2, 3].map((n) => h('li', null, t(`setup.step${n}`)))),
    h('p', { class: 'muted small' }, t('setup.hint')))));
}

// 이메일 인증/비밀번호 재설정 링크로 돌아오면 주소에 남는 ?code=... 를 정리
function cleanAuthParams() {
  const u = new URL(location.href);
  if (u.searchParams.has('code') || u.searchParams.has('error_description')) {
    history.replaceState(null, '', u.pathname + (location.hash || '#/home'));
  }
}

async function main() {
  initLang();
  if (!isConfigured) return showSetup();

  try {
    const [{ initAuth }, { mountShell }, { startRouter }] = await Promise.all([
      import('./features/auth/auth.service.js'),
      import('./shell.js'),
      import('./core/router.js'),
    ]);
    await initAuth();
    cleanAuthParams();
    mountShell(headerEl, navEl, footerEl);
    startRouter(viewEl);
  } catch (e) {
    console.error('[app] failed to start', e);
    viewEl.replaceChildren(h('div', { class: 'empty empty-error' }, h('p', null, t('err.generic')),
      h('button', { class: 'btn btn-soft', onClick: () => location.reload() }, t('common.retry'))));
  }
}

// 시작 화면(스플래시): 앱이 준비되면 부드럽게 사라짐 (최소 0.6초는 보여 줌)
const splashStart = Date.now();
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 400); }, Math.max(0, 600 - (Date.now() - splashStart)));
}
main().finally(hideSplash);

// 설치형 앱(PWA)용 서비스 워커: 앱 파일을 폰에 저장해 두어 빨리 열림 (데이터 요청은 저장하지 않음)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[sw] register failed', e));
  });
}
