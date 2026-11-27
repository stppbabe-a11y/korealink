// interests.js | 프로필 관심사 5가지 (항상 공개). id 는 DB 의 허용 목록(profiles_interests_chk)과 같아야 합니다.
import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';

export const INTERESTS = [
  { id: 'food', emoji: '🍜' },
  { id: 'kculture', emoji: '🎤' },
  { id: 'activity', emoji: '🏞️' },
  { id: 'arts', emoji: '🎨' },
  { id: 'nightlife', emoji: '🍻' },
];
export const MAX_INTERESTS = INTERESTS.length;
const label = (id) => `${INTERESTS.find((i) => i.id === id)?.emoji ?? ''} ${t(`interest.${id}`)}`;

// 보여 주기용 알약 목록 (없으면 아무것도 그리지 않음)
export function interestChips(ids) {
  const list = (ids ?? []).filter((id) => INTERESTS.some((i) => i.id === id));
  return list.length ? h('div', { class: 'interest-chips', 'aria-label': t('profile.interests') }, list.map((id) => h('span', { class: 'interest-pill' }, label(id)))) : null;
}

// 고르기용: 눌러서 켜고 끄는 버튼들
export function interestPicker(initial = []) {
  const on = new Set((initial ?? []).filter((id) => INTERESTS.some((i) => i.id === id)));
  const wrap = h('div', { class: 'interest-chips pick', role: 'group', 'aria-label': t('profile.interests') });
  const paint = () => wrap.replaceChildren(...INTERESTS.map((i) =>
    h('button', { class: `interest-pill${on.has(i.id) ? ' on' : ''}`, type: 'button', 'aria-pressed': String(on.has(i.id)),
      onClick: () => { if (on.has(i.id)) on.delete(i.id); else on.add(i.id); paint(); } }, label(i.id))));
  paint();
  return {
    root: h('div', { class: 'field' }, h('span', { class: 'label' }, t('profile.interests')), wrap, h('p', { class: 'hint' }, t('profile.interestsHint'))),
    value: () => INTERESTS.map((i) => i.id).filter((id) => on.has(id)),
  };
}
