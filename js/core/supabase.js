// supabase.js | 서버(Supabase) 연결 — 앱 전체에서 이 파일의 `sb` 하나만 사용합니다.
import { createClient } from '../vendor/supabase.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config.js';

// config.js 를 아직 채우지 않았으면 false (이 경우 안내 화면을 보여줍니다)
export const isConfigured =
  /^https:\/\/[^\s/]+/i.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('YOUR-PROJECT-REF') &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !SUPABASE_PUBLISHABLE_KEY.includes('YOUR-');

export const sb = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: 'pkce',          // 로그인 코드 탈취에 더 강한 방식
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// 저장소(Storage)에 올린 사진의 공개 주소 만들기
export function publicUrl(bucket, path) {
  if (!sb || !path) return '';
  return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
