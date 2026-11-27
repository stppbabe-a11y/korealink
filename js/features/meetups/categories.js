// categories.js | 모임 종류 (DB 의 meetups_category_chk 와 같은 값이어야 합니다)
// 새 종류를 추가하려면: 1) 여기  2) 007 SQL 의 meetups_category_chk  3) js/locales/*.js 의 'meet.cat.<값>'
export const MEETUP_CATEGORIES = [
  { id: 'food', emoji: '🍜' }, { id: 'cafe', emoji: '☕' }, { id: 'sightseeing', emoji: '🏯' },
  { id: 'nature', emoji: '🌊' }, { id: 'nightlife', emoji: '🍻' }, { id: 'culture', emoji: '🎎' },
  { id: 'shopping', emoji: '🛍️' }, { id: 'sports', emoji: '🥾' }, { id: 'language', emoji: '💬' },
  { id: 'photo', emoji: '📸' }, { id: 'other', emoji: '✨' },
];
export const catEmoji = (id) => MEETUP_CATEGORIES.find((c) => c.id === id)?.emoji ?? '✨';
export const MAX_LANGS = 4;

// 모임에 대표 사진이 없을 때 보여 줄 "분위기 사진" (icons/art). 실제 모임 사진이 아니라 종류별 기본 이미지입니다.
const ART = { food: 'v-street', cafe: 'v-street', nightlife: 'v-street', shopping: 'v-street', culture: 'v-palace', sightseeing: 'v-palace',
  nature: 'v-tower', sports: 'v-tower', photo: 'v-tower', language: 'v-group', other: 'v-group' };
export const catArt = (id) => (ART[id] ? `icons/art/${ART[id]}.webp` : '');
