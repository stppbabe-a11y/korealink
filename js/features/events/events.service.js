// events.service.js | 한국관광공사(KTO) 행사 정보 읽기
//   브라우저는 우리 DB(kto_events)만 읽습니다. DB는 Edge Function(kto-events)이 6시간마다 채웁니다.
//   → 방문자가 아무리 많아도 공공데이터 호출 횟수는 하루 몇 번뿐이라 무료 한도 안에서 운영됩니다.
//   Edge Function 이 아직 준비되지 않았으면 빈 목록을 돌려주고, 화면은 "링크 모음"만 보여 줍니다.
import { sb } from '../../core/supabase.js';

// 한국어 사용자는 국문 관광정보, 그 외 모든 언어는 영문 관광정보를 보여 줍니다.
export const ktoLang = (lang) => (lang === 'ko' ? 'ko' : 'en');
export const ktoStatus = { text: '' };      // 연동이 안 될 때 원인을 화면에 보여 주기 위한 기록(비밀 정보 없음)

const STALE_MS = 12 * 3600 * 1000;
const asked = new Set();                      // 한 번 접속에서 같은 언어는 한 번만 갱신 요청

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function refreshIfStale(lang) {
  if (asked.has(lang)) return;
  asked.add(lang);
  try {
    const { data } = await sb.from('kto_events_meta').select('fetched_at,ok,message').eq('lang', lang).maybeSingle();
    if (data && data.ok && Date.now() - new Date(data.fetched_at).getTime() < STALE_MS) { ktoStatus.text = ''; return; }
    const { data: res, error } = await sb.functions.invoke('kto-events', { body: { lang } });   // 실패해도 화면은 기존 데이터를 그대로 보여 줌
    if (error) ktoStatus.text = `function: ${String(error.context?.status ?? error.message ?? error).slice(0, 80)}`;
    else if (res?.status === 'not_configured') ktoStatus.text = 'KTO_API_KEY secret is not set';
    else if (res?.status === 'error') ktoStatus.text = String(res.message ?? 'error').slice(0, 160);
    else if (res?.status === 'recent_error') ktoStatus.text = `last error: ${String(data?.message ?? '').slice(0, 160)}`;
    else if (res?.status === 'refreshed' && !res.count) ktoStatus.text = 'connected, but the API returned 0 events';
    else ktoStatus.text = '';
  } catch (e) { ktoStatus.text = `function: ${String(e?.message ?? e).slice(0, 80)}`; }
}

async function query(lang, region) {
  const run = async (cols) => {
    let q = sb.from('kto_events').select(cols).eq('lang', lang)
      .order('start_date', { ascending: true, nullsFirst: false }).limit(200);
    if (region && region !== 'all') q = q.eq('region', region);
    return q;
  };
  const base = 'id,title,addr,start_date,end_date,region,lat,lng,tel,image';
  let { data, error } = await run(`${base},homepage`);
  if (error && /homepage/i.test(error.message ?? '')) ({ data, error } = await run(base));      // 013 SQL 을 아직 안 돌린 경우
  if (error) throw error;
  const t0 = today();
  return (data ?? []).filter((e) => !e.end_date || e.end_date >= t0).slice(0, 60);   // 끝난 행사 제외 (종료일이 없는 행사는 유지)
}

// 언어 행사 목록. 그 언어 데이터가 없으면 영어 데이터로 대체.
export async function listEvents(lang, region = 'all') {
  if (!sb) return { rows: [], lang: 'en' };
  const want = ktoLang(lang);
  let rows = await query(want, region);
  let used = want;
  if (!rows.length && want !== 'en') { rows = await query('en', region); used = 'en'; }
  refreshIfStale(want).catch(() => {});
  return { rows, lang: used };
}

// 갱신을 기다렸다가 다시 읽고 싶을 때 (처음 방문이라 DB가 비어 있는 경우)
export async function refreshNow(lang) {
  asked.delete(ktoLang(lang));
  await refreshIfStale(ktoLang(lang));
}

export const isOngoing = (e) => e.start_date <= today();

// 카드를 눌렀을 때: 서버 함수가 그 행사의 공식 홈페이지 주소를 바로 알아봐 줍니다. (못 찾으면 '')
export async function resolveHomepage(id, lang) {
  if (!sb) return '';
  try {
    const { data, error } = await sb.functions.invoke('kto-events', { body: { lang: ktoLang(lang), detail: id } });
    if (error) return '';
    const u = String(data?.homepage ?? '');
    return /^https?:\/\/\S+$/i.test(u) ? u : '';
  } catch { return ''; }
}
