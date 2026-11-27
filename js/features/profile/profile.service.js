// profile.service.js | 프로필 조회 / 수정 / 사진 / 탈퇴
//   수정할 때 "바뀐 칸만" 서버로 보냅니다. (소개글만 고치면 소개글 한 칸만 저장)
import { sb } from '../../core/supabase.js';
import { state, userId } from '../../core/store.js';
import { diff, isEmpty, escapeLike } from '../../core/utils.js';

// 다른 사람에게 보이는 프로필 칸. 값은 서버가 "공개로 정한 것만" 채워 두므로 비공개 칸은 비어 있습니다.
const PUBLIC_COLS = 'id,username,display_name,avatar_cfg,bio,country,residence_region,gender,birth_year,interests,created_at';

// 내 프로필 수정은 두 곳으로 나뉩니다 (바뀐 칸만 보냅니다)
//   profiles        : 닉네임, 언어 (항상 공개/내 설정)
//   profile_private : 이름, 소개, 국적, 거주 지역, 성별, 태어난 해 + 각 칸의 공개 여부 (본인 전용 금고)
const PROFILE_KEYS = ['username', 'language', 'interests'];      // 아바타는 포인트 규칙 때문에 saveAvatar() 로만 바뀝니다
export const PRIVATE_KEYS = ['display_name', 'bio', 'country', 'residence_region', 'gender', 'birth_year',
  'show_age'];

export async function getProfileByUsername(username) {
  const { data, error } = await sb.from('profiles').select(PUBLIC_COLS).ilike('username', escapeLike(username)).maybeSingle();
  if (error) throw error;
  return data;
}

// 바뀐 칸만 저장하고, 서버가 돌려준 최신 값을 state.profile 에 반영. 바뀐 게 없으면 false.
export async function updateMyProfile(next) {
  const pick = (keys) => Object.fromEntries(keys.filter((k) => k in next).map((k) => [k, next[k]]));
  const profileChanges = diff(state.profile, pick(PROFILE_KEYS));
  const privateChanges = diff(state.profile, pick(PRIVATE_KEYS));
  if (isEmpty(profileChanges) && isEmpty(privateChanges)) return false;
  if (!isEmpty(profileChanges)) {
    const { error } = await sb.from('profiles').update(profileChanges).eq('id', userId());
    if (error) throw error;
    state.profile = { ...state.profile, ...profileChanges };
  }
  if (!isEmpty(privateChanges)) {
    const { error } = await sb.from('profile_private').update(privateChanges).eq('user_id', userId());
    if (error) throw error;
    state.profile = { ...state.profile, ...privateChanges };
  }
  return true;
}

// 내가 올린 모든 파일 삭제 (회원 탈퇴 직전에 호출)
async function purgeMyFiles() {
  const uid = userId();
  for (const bucket of ['post-images', 'avatars']) {
    try {
      const { data } = await sb.storage.from(bucket).list(uid, { limit: 1000 });
      if (data?.length) await sb.storage.from(bucket).remove(data.map((f) => `${uid}/${f.name}`));
    } catch (e) { console.warn('[profile] file cleanup failed', bucket, e); }
  }
}

// 카카오 쪽 앱 연결 끊기 (선택 기능: unlink-social 함수가 없거나 실패해도 탈퇴는 계속 진행)
async function unlinkSocial() {
  try {
    await Promise.race([sb.functions.invoke('unlink-social', { body: {} }), new Promise((r) => setTimeout(r, 6000))]);
  } catch (e) { console.warn('[profile] unlink skipped', e); }
}

export async function deleteMyAccount() {
  await unlinkSocial();                       // 소셜 연결 정보는 계정 삭제 전에만 확인할 수 있어 가장 먼저
  await purgeMyFiles();
  const { error } = await sb.rpc('delete_my_account');
  if (error) throw error;
  await sb.auth.signOut({ scope: 'local' });
}

// ---- 포인트 / 출석체크 / 아바타 저장 (모두 서버 함수가 처리: 추첨과 차감은 앱에서 조작할 수 없습니다) ----
export async function getPoints() {
  const { data, error } = await sb.rpc('my_points');
  if (error) throw error;
  return data ?? { points: 0, checked_in_today: false, avatar_cost: 10 };
}
export async function checkIn() {
  const { data, error } = await sb.rpc('daily_checkin');
  if (error) throw error;
  return data;
}
export async function saveAvatar(cfg) {
  const { data, error } = await sb.rpc('save_avatar', { p_cfg: cfg });
  if (error) throw error;
  state.profile = { ...state.profile, avatar_cfg: cfg };
  return data;
}
