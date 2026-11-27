// categories.js | 게시글 카테고리 목록 (DB 의 posts_category_chk 와 같은 값이어야 합니다)
// 새 카테고리를 추가하려면: 1) 여기에 추가  2) 001_schema.sql 의 posts_category_chk 에 추가
//                          3) js/locales/*.js 에 'cat.<값>' 문구 추가
export const CATEGORIES = ['sightseeing', 'food', 'nature', 'nightlife', 'culture', 'shopping', 'transport', 'other'];
export const isCategory = (v) => CATEGORIES.includes(v);
