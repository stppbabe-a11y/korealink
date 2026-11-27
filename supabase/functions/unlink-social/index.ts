// unlink-social | 회원 탈퇴 직전에 호출: 카카오 쪽 "앱 연결"을 끊어 줍니다 (Supabase Edge Function)
//
//  ★ 이 함수는 "선택"입니다. 배포하지 않아도 탈퇴는 정상 동작합니다 (우리 서비스의 계정·소셜 연동 기록은 삭제됨).
//    배포하면 추가로 카카오 계정의 "연결된 서비스" 목록에서도 이 앱이 사라집니다.
//  ★ 필요한 비밀값(Secrets): KAKAO_ADMIN_KEY  (카카오 디벨로퍼스 > 앱 > 앱 키 > 어드민 키)  ← 앱 파일에 절대 넣지 마세요.
//     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동으로 넣어 줍니다.
//  ★ 로그인한 본인의 요청만 처리합니다 (토큰으로 본인 확인). 본인의 카카오 연결만 끊을 수 있습니다.
//  ※ 구글은 서버에서 연결을 끊는 공식 방법이 없어(사용자 본인이 구글 계정 설정에서 해제) 여기서 다루지 않습니다.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ status: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ status: 'server_not_ready' }, 500);

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ status: 'unauthorized' }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: who, error: whoErr } = await admin.auth.getUser(token);        // 토큰으로 "누구인지" 서버가 직접 확인
  if (whoErr || !who?.user) return json({ status: 'unauthorized' }, 401);

  const adminKey = Deno.env.get('KAKAO_ADMIN_KEY');
  if (!adminKey) return json({ status: 'not_configured' });                    // 설정 안 했으면 조용히 통과

  const ids = (who.user.identities ?? []).filter((i: any) => i.provider === 'kakao');
  if (!ids.length) return json({ status: 'no_kakao' });

  const results: string[] = [];
  for (const i of ids) {
    const kakaoId = String(i.identity_data?.provider_id ?? i.identity_data?.sub ?? i.id ?? '').trim();
    if (!/^[0-9]{3,20}$/.test(kakaoId)) { results.push('skipped'); continue; }
    try {
      const r = await fetch('https://kapi.kakao.com/v1/user/unlink', {
        method: 'POST',
        headers: { Authorization: `KakaoAK ${adminKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ target_id_type: 'user_id', target_id: kakaoId }),
      });
      results.push(r.ok ? 'unlinked' : `failed_${r.status}`);
    } catch { results.push('failed_network'); }
  }
  return json({ status: 'done', results });                                    // 결과와 상관없이 탈퇴 진행은 앱이 계속함
});
