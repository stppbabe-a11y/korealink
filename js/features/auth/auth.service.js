// auth.service.js | 회원가입 / 로그인 / 로그아웃 / 세션 관리 (서버와 대화하는 부분만)
//
// 비밀번호는 이 앱 코드 어디에도 저장되지 않습니다.
// 입력된 비밀번호는 암호화된 연결(HTTPS)로 Supabase Auth 에 전달되고,
// 서버에서 bcrypt 로 "해시"(되돌릴 수 없는 형태)되어 저장됩니다.
import { sb } from '../../core/supabase.js';
import { state, emit, isLoggedIn } from '../../core/store.js';
import { getLang, setLang } from '../../core/i18n.js';
import { navigate } from '../../core/router.js';

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

// 현재 주소에서 앱 시작 주소만 만들기 (이메일 링크가 돌아올 곳)
const appUrl = () => location.origin + location.pathname;

export async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: appUrl() } });
  if (error) throw error;
}

export async function signInWithKakao() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: appUrl() } });
  if (error) throw error;
}

// 게스트로 입장: 이메일/비밀번호 없이 임시 계정이 만들어져 "채팅 글자 메시지"만 쓸 수 있습니다.
//   (Supabase 대시보드에서 Anonymous sign-ins 를 켜야 동작. 글/모임/사진 올리기는 서버 규칙이 막음)
export async function signInAsGuest() {
  const { error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  await loadMyProfile().catch(() => {});
  emit('auth');
}

export async function signOut() {
  await sb.auth.signOut();
}

export async function loadMyProfile() {
  const { data, error } = await sb.rpc('my_profile');          // 내 프로필 + 비공개 설정값(본인만 볼 수 있는 금고) 함께
  if (!error) {
    state.profile = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    if (state.profile) return state.profile;
  }
  // 안전장치: my_profile 을 못 쓰는 경우(006 미적용 등)에도 로그인/채팅이 막히지 않도록 공개 프로필만이라도 불러옴
  console.warn('[auth] my_profile failed, falling back', error);
  const uid = state.session?.user?.id;
  const { data: pub, error: e2 } = await sb.from('profiles').select('id,username,display_name,avatar_cfg,bio,country,language,role,is_banned,created_at').eq('id', uid).maybeSingle();
  if (e2) throw e2;
  state.profile = pub ?? null;
  return state.profile;
}

// ---- 앱 시작 시 한 번 호출: 로그인 상태를 계속 지켜봄 ---------------------------
export async function initAuth() {
  const { data } = await sb.auth.getSession();
  state.session = data.session;
  if (state.session) {
    try { await loadMyProfile(); } catch (e) { console.error('[auth] profile load failed', e); }
    if (state.profile?.language && isLoggedIn()) setLang(state.profile.language, { persist: true });
  }
  state.ready = true;

  sb.auth.onAuthStateChange((event, session) => {
    const wasUser = state.session?.user?.id;
    state.session = session;
    if (event === 'TOKEN_REFRESHED') return;           // 조용한 갱신 — 화면은 그대로
    // ※ 이 콜백 안에서 sb 를 직접 await 하면 교착(멈춤)될 수 있어 setTimeout 으로 한 박자 늦춥니다.
    setTimeout(async () => {
      if (!session) {
        state.profile = null;
      } else if (wasUser !== session.user.id || !state.profile) {
        try { await loadMyProfile(); } catch (e) { console.error('[auth] profile load failed', e); }
        if (state.profile?.language && isLoggedIn()) setLang(state.profile.language);
      }
      emit('auth');
    }, 0);
  });
}
