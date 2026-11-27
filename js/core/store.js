// store.js | 앱 전체가 공유하는 "현재 상태"(로그인 정보 등)와 간단한 이벤트 알림

export const state = {
  session: null,   // 로그인 세션 (없으면 null)
  profile: null,   // 내 프로필 (me() 함수 결과)
  ready: false,    // 첫 로그인 확인이 끝났는지
  nav: null,       // 현재 화면이 속한 메뉴 (하이라이트용)
};

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event)?.delete(fn);
}

export function emit(event, data) {
  for (const fn of [...(listeners.get(event) ?? [])]) {
    try { fn(data); } catch (e) { console.error(`[store] listener for "${event}" failed`, e); }
  }
}

export const userId = () => state.session?.user?.id ?? null;
// 게스트(익명) 세션은 "로그인한 회원"이 아닙니다 -> 글/모임/프로필 등은 막히고 채팅(글자)만 가능
export const hasSession = () => !!state.session;
export const isGuest = () => !!state.session?.user?.is_anonymous;
export const isLoggedIn = () => !!state.session && !isGuest();
// ※ 화면 표시용입니다. 진짜 관리자 확인은 항상 서버(DB 함수)가 다시 합니다.
export const isAdmin = () => state.profile?.role === 'admin';
