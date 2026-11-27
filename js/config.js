// =====================================================================
// config.js  |  앱 설정 — 여러분이 직접 채워야 하는 파일은 "이 파일 하나"뿐입니다.
//
// 아래 두 값은 Supabase 대시보드 > Project Settings > API 에서 복사합니다.
//
//   SUPABASE_URL              프로젝트 주소          (예: https://abcd1234.supabase.co)
//   SUPABASE_PUBLISHABLE_KEY  "공개용" 키            (anon / publishable 키)
//
// ★ 이 두 값은 "공개되어도 안전하게 설계된 값"입니다. (집 주소 같은 것이지, 열쇠가 아닙니다)
//   브라우저가 서버에 접속하려면 이 값이 꼭 필요하고, 누구나 F12 로 볼 수 있습니다.
//   실제 보호는 데이터베이스의 보안 규칙(RLS)이 합니다. (supabase/migrations/003_security.sql)
//
// ★ 절대로 여기에 넣으면 안 되는 것:
//   - service_role 키 / "secret" 키   (이 키가 있으면 모든 보안 규칙을 무시할 수 있습니다)
//   - 데이터베이스 비밀번호, 관리자 비밀번호
//   tools/check-secrets.mjs 가 이런 키가 파일에 들어가 있으면 경고해 줍니다.
// =====================================================================

export const SUPABASE_URL = 'https://uyfglqyabvrwbohkqsml.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_HGi5ycwyudVncOuVIKULjg_6J9DhuED';

// 선택 기능 (Supabase 대시보드에서 Google 로그인을 켠 경우에만 true — README 의 'Google 로그인 켜기' 참고)
export const FEATURES = {
  googleLogin: true,
  kakaoLogin: false,   // Supabase 에서 Kakao 를 켠 뒤 true 로 바꾸세요 (README '소셜 로그인')
};

// 푸터(화면 맨 아래)에 보일 연락처/SNS. 비워 두면(빈 글자 '') 그 항목은 화면에 나타나지 않습니다. (가짜 링크를 만들지 않기 위해)
//   CONTACT_EMAIL 예: 'hello@mydomain.com'      SOCIAL 예: { instagram: 'https://instagram.com/내계정' }
export const CONTACT_EMAIL = '';
export const SOCIAL = { instagram: '', youtube: '', x: '', facebook: '' };
