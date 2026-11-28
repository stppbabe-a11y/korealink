// extLink.js | 바깥 사이트로 가는 링크: 누르면 바로 그 사이트가 새 탭에서 열립니다. (opener 차단으로 안전)
import { h } from './dom.js';

export const extLink = (attrs, ...kids) => h('a', { ...attrs, target: '_blank', rel: 'noopener noreferrer' }, ...kids);

// 주소를 "눌렀을 때" 알아내야 하는 링크 (예: 서버에서 행사 홈페이지를 조회).
//   폰에서는 빈 새 탭을 먼저 열어 두는 방식이 막히는 경우가 많아서, 주소를 먼저 알아낸 뒤(최대 6초) 이동합니다.
//   새 탭이 막히면 지금 탭에서 바로 그 사이트로 이동합니다. resolve() 가 빈 값이면 fallbackHref(구글 검색)로 갑니다.
export function lazyLink(attrs, resolve, ...kids) {
  const { href: fallbackHref } = attrs;
  const a = h('a', { ...attrs, target: '_blank', rel: 'noopener noreferrer' }, ...kids);
  let busy = false;
  a.addEventListener('click', async (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (busy) return;
    busy = true;
    a.classList.add('is-loading');
    let dest = '';
    try { dest = await Promise.race([resolve(), new Promise((r) => setTimeout(() => r(''), 6000))]); } catch { /* 실패하면 대체 주소 */ }
    a.classList.remove('is-loading');
    busy = false;
    const url = /^https?:\/\//i.test(dest || '') ? dest : fallbackHref;
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.assign(url);
  });
  return a;
}
