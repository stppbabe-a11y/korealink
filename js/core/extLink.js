// extLink.js | 바깥 사이트로 가는 링크: 누르면 바로 그 사이트가 새 탭에서 열립니다. (opener 차단으로 안전)
import { h } from './dom.js';

export const extLink = (attrs, ...kids) => h('a', { ...attrs, target: '_blank', rel: 'noopener noreferrer' }, ...kids);

// 주소를 "눌렀을 때" 알아내야 하는 링크 (예: 서버에서 행사 홈페이지를 조회).
//   브라우저 팝업 차단을 피하려고 새 탭을 먼저 열어 두고, 주소가 정해지면 그 탭을 이동시킵니다.
//   resolve() 가 빈 값을 돌려주면 fallbackHref 로 이동합니다.
export function lazyLink(attrs, resolve, ...kids) {
  const { href: fallbackHref } = attrs;
  const a = h('a', { ...attrs, target: '_blank', rel: 'noopener noreferrer' }, ...kids);
  a.addEventListener('click', async (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const tab = window.open('about:blank', '_blank');
    if (!tab) { window.location.assign(fallbackHref); return; }
    try { tab.opener = null; } catch { /* 무시 */ }
    let dest = '';
    try { dest = await resolve(); } catch { /* 실패하면 대체 주소 */ }
    tab.location.href = /^https?:\/\//i.test(dest || '') ? dest : fallbackHref;
  });
  return a;
}
