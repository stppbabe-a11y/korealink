// regionChips.js | "전국 + 17개 시·도"를 칩으로 모두 펼쳐 보여 줍니다. 내 거주 지역은 ★ 와 함께 맨 앞에 나옵니다.
import { h } from './dom.js';
import { t } from './i18n.js';
import { state } from './store.js';
import { REGION_IDS } from './regions.js';

export const myRegion = () => { const r = state.profile?.residence_region; return REGION_IDS.includes(r) ? r : ''; };

// 처음 열 때 선택할 지역: 주소에 지역이 있으면 그 지역, 'all' 이면 전국, 아무것도 없으면 "내가 프로필에 설정한 거주 지역"
export function initialRegion(raw) {
  if (raw === 'all') return '';
  if (REGION_IDS.includes(raw)) return raw;
  return myRegion();
}

export function regionChips({ value = '', onChange } = {}) {
  let cur = value;
  const el = h('div', { class: 'chips-row region-chips', role: 'group', 'aria-label': t('region.label') });
  const paint = () => {
    const mine = myRegion();
    const list = [
      ...(mine ? [{ id: mine, label: `★ ${t(`region.${mine}`)}`, star: true }] : []),
      { id: '', label: t('region.all') },
      ...REGION_IDS.filter((id) => id !== mine).map((id) => ({ id, label: t(`region.${id}`) })),
    ];
    el.replaceChildren(...list.map((r) => h('button', {
      class: `chip${r.id === cur ? ' active' : ''}${r.star ? ' chip-star' : ''}`, type: 'button', 'aria-pressed': r.id === cur ? 'true' : 'false',
      onClick: () => { cur = r.id; paint(); onChange?.(cur); },
    }, r.label)));
  };
  paint();
  return { el, get: () => cur };
}
