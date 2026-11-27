// rating.js | 별점(1~5) 표시 / 입력. 별점은 "글쓴이가 직접" 주는 점수이고 선택 사항입니다.
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';

function star(filled, size) {
  const s = icon('star', size);
  s.setAttribute('fill', filled ? 'currentColor' : 'none');
  s.classList.add(filled ? 'star-on' : 'star-off');
  return s;
}

// 읽기 전용: ★★★★☆ (값이 없으면 아무것도 안 그림)
export function stars(value, { size = 16, showNumber = true } = {}) {
  if (!value) return null;
  const row = h('span', { class: 'stars', role: 'img', 'aria-label': t('post.ratingStar', { n: value }) });
  for (let i = 1; i <= 5; i += 1) row.append(star(i <= value, size));
  if (showNumber) row.append(h('span', { class: 'stars-num' }, t('post.ratingValue', { n: value })));
  return row;
}

// 입력용: 별 5개 버튼. 같은 별을 다시 누르면 점수를 지움. get() 으로 현재 값을 읽음.
export function ratingInput(initial = null) {
  let value = initial || null;
  const row = h('div', { class: 'stars stars-input', role: 'radiogroup', 'aria-label': t('post.rating') });
  function paint() {
    row.replaceChildren(...[1, 2, 3, 4, 5].map((n) => {
      const b = h('button', { type: 'button', class: 'star-btn', role: 'radio', 'aria-checked': String(value === n),
        'aria-label': t('post.ratingStar', { n }) }, star(value != null && n <= value, 30));
      b.addEventListener('click', () => { value = value === n ? null : n; paint(); });
      return b;
    }));
  }
  paint();
  return { el: row, get: () => value };
}
