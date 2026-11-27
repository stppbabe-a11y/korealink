// kto-events | 한국관광공사(TourAPI) 행사 정보를 가져와 DB 에 저장해 두는 서버 함수 (Supabase Edge Function)
//
//  ★ 왜 서버 함수인가?  공공데이터 "인증키"를 앱 코드(F12 로 보이는 곳)에 두면 안 되기 때문입니다.
//     인증키는 Supabase 의 "Secrets"(비밀 보관함)에만 넣고, 이 함수만 읽습니다.
//  ★ 비용 절약: 앱이 열릴 때마다 호출해도, 마지막으로 가져온 지 6시간이 안 지났으면 한국관광공사에 다시 묻지 않습니다.
//     (공공데이터 무료 개발계정은 하루 1,000회 제한 -> 이 방식이면 하루 수십 회 수준)
//  ★ 필요한 비밀값(Secrets): KTO_API_KEY (공공데이터포털에서 발급받은 "일반 인증키(Decoding)")
//     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 함수에 자동으로 넣어 줍니다.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const BASE = 'https://apis.data.go.kr/B551011';
// 앱 언어 -> 한국관광공사 서비스 이름. (공공데이터포털에서 "활용신청"을 한 서비스만 작동. 안 한 언어는 영어로 대체됩니다)
const SERVICES: Record<string, string> = { en: 'EngService2', ko: 'KorService2' };   // 한국어 = 국문 서비스, 그 외 모든 언어 = 영문 서비스
const FRESH_MS = 6 * 3600 * 1000;       // 성공 후 6시간은 다시 안 가져옴
const RETRY_MS = 30 * 60 * 1000;        // 실패 후 30분은 다시 안 가져옴 (공공 서버에 부담 주지 않기)
const PAGE_SIZE = 100;
const DETAIL_PER_RUN = 30;              // 한 번 갱신할 때 홈페이지 주소를 새로 알아볼 행사 수 (하루 호출 한도 절약)
const MAX_PAGES = 4;                    // 최대 400건 (한 번 갱신에 호출 최대 4회)

// 시/도 코드 -> 지역 이름 (법정동 시도코드 / 예전 지역코드 둘 다 대응)
const LEGAL: Record<string, string> = { '11': 'seoul', '26': 'busan', '27': 'daegu', '28': 'incheon', '29': 'gwangju', '30': 'daejeon', '31': 'ulsan', '36': 'sejong', '41': 'gyeonggi', '42': 'gangwon', '51': 'gangwon', '43': 'chungbuk', '44': 'chungnam', '45': 'jeonbuk', '52': 'jeonbuk', '46': 'jeonnam', '47': 'gyeongbuk', '48': 'gyeongnam', '50': 'jeju' };
const AREA: Record<string, string> = { '1': 'seoul', '2': 'incheon', '3': 'daejeon', '4': 'daegu', '5': 'gwangju', '6': 'busan', '7': 'ulsan', '8': 'sejong', '31': 'gyeonggi', '32': 'gangwon', '33': 'chungbuk', '34': 'chungnam', '35': 'gyeongbuk', '36': 'gyeongnam', '37': 'jeonbuk', '38': 'jeonnam', '39': 'jeju' };
const regionOf = (it: any): string | null => {
  const l = String(it.lDongRegnCd ?? '').trim();
  const a = String(it.areacode ?? '').trim();
  if (LEGAL[l]) return LEGAL[l];
  if (AREA[a]) return AREA[a];
  const addr = String(it.addr1 ?? '');
  if (/busan|부산|釜山/i.test(addr)) return 'busan';
  if (/seoul|서울|ソウル|首尔|首爾/i.test(addr)) return 'seoul';
  if (/jeju|제주|済州|济州/i.test(addr)) return 'jeju';
  return null;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');
const toDate = (s: unknown) => (/^\d{8}$/.test(String(s ?? '')) ? `${String(s).slice(0, 4)}-${String(s).slice(4, 6)}-${String(s).slice(6, 8)}` : null);
// 사진은 한국관광공사 도메인의 https 주소만 허용 (http 는 https 로 바꿔 저장)
const photoOf = (it: any): string | null => {
  const raw = String(it.firstimage || it.firstimage2 || '').trim().replace(/^http:\/\//i, 'https://');
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && /(^|\.)visitkorea\.or\.kr$/i.test(u.hostname) && raw.length <= 400 ? raw : null;
  } catch { return null; }
};
// 한국관광공사 상세정보의 homepage 칸은 '<a href="http://...">' 같은 HTML 글자로 옵니다. 주소만 꺼내고, http/https 만 허용합니다.
const homepageOf = (raw: unknown): string => {
  const text = String(raw ?? '');
  const m = /href\s*=\s*["']([^"']+)["']/i.exec(text) ?? /(https?:\/\/[^\s<>"']+)/i.exec(text);
  const u = (m?.[1] ?? '').trim().replaceAll('&amp;', '&');
  return /^https?:\/\/[^\s<>"]+$/i.test(u) && u.length <= 300 ? u : '';
};
async function ktoItem(service: string, key: string, op: string, contentId: string, extra: Record<string, string> = {}): Promise<any | null> {
  const qs = new URLSearchParams({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'BusanTravelers', _type: 'json', contentId, ...extra });
  try {
    const res = await fetch(`${BASE}/${service}/${op}?${qs}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const body = JSON.parse(await res.text());
    if (body?.response?.header?.resultCode !== '0000') return null;
    const it = body?.response?.body?.items?.item;
    return (Array.isArray(it) ? it[0] : it) ?? {};
  } catch { return null; }
}
// 1순위: 행사 전용 홈페이지(detailIntro2.eventhomepage), 2순위: 일반 홈페이지(detailCommon2.homepage). null = 호출 실패(다음에 다시 시도), '' = 홈페이지 없음
async function fetchHomepage(service: string, key: string, contentId: string): Promise<string | null> {
  const intro = await ktoItem(service, key, 'detailIntro2', contentId, { contentTypeId: '15' });
  const ev = intro ? homepageOf(intro.eventhomepage) : '';
  if (ev) return ev;
  const common = await ktoItem(service, key, 'detailCommon2', contentId);
  if (common === null && intro === null) return null;
  return common ? homepageOf(common.homepage) : '';
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n !== 0 ? n : null; };

async function fetchPage(service: string, key: string, page: number, startDate: string) {
  const qs = new URLSearchParams({
    serviceKey: key, MobileOS: 'ETC', MobileApp: 'BusanTravelers', _type: 'json',
    numOfRows: String(PAGE_SIZE), pageNo: String(page), arrange: 'A', eventStartDate: startDate,
  });
  const res = await fetch(`${BASE}/${service}/searchFestival2?${qs}`, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  if (!res.ok) throw new Error(`http_${res.status}`);
  let body: any;
  try { body = JSON.parse(text); } catch { throw new Error('bad_response'); }      // 인증키 오류 등은 XML/문구로 오는 경우가 있음
  const header = body?.response?.header;
  if (header && header.resultCode !== '0000') throw new Error(`api_${header.resultCode}_${header.resultMsg ?? ''}`.slice(0, 120));
  const items = body?.response?.body?.items?.item ?? [];
  const total = Number(body?.response?.body?.totalCount ?? 0);
  return { items: Array.isArray(items) ? items : [items], total };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    let lang = url.searchParams.get('lang') ?? '';
    if (req.method === 'POST') { try { lang = (await req.json())?.lang ?? lang; } catch { /* body 없음 */ } }
    lang = lang === 'ko' ? 'ko' : 'en';          // 한국어는 국문, 그 외는 영문
    let detail = url.searchParams.get('detail') ?? '';
    if (req.method === 'POST') { try { detail = (await req.clone().json())?.detail ?? detail; } catch { /* 없음 */ } }

    let key = (Deno.env.get('KTO_API_KEY') ?? '').trim();
    if (key.includes('%')) { try { key = decodeURIComponent(key); } catch { /* 그대로 사용 */ } }   // Encoding 키를 넣어도 동작하게 보정
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    if (!key) return json({ status: 'not_configured' });

    // ---- 카드 클릭: 그 행사 하나의 공식 홈페이지 주소를 바로 알아봐서 돌려줍니다 (한 행사당 한국관광공사 호출은 최대 1번, 결과는 저장) ----
    if (detail) {
      const m = /^(en|ko):(\d{1,12})$/.exec(String(detail));
      if (!m) return json({ status: 'error', message: 'bad_id' }, 400);
      const { data: row } = await db.from('kto_events').select('id, homepage').eq('id', detail).maybeSingle();
      if (!row) return json({ status: 'unknown_event' }, 404);
      if (row.homepage !== null) return json({ status: 'ok', homepage: row.homepage });
      const hp = await fetchHomepage(SERVICES[m[1]], key, m[2]);
      if (hp === null) return json({ status: 'unavailable', homepage: '' });
      await db.from('kto_events').update({ homepage: hp }).eq('id', detail);
      return json({ status: 'ok', homepage: hp });
    }

    // 최근에 가져왔으면 그대로 사용 (한국관광공사 호출 절약)
    const { data: meta } = await db.from('kto_events_meta').select('fetched_at, ok, message').eq('lang', lang).maybeSingle();
    if (meta) {
      const age = Date.now() - new Date(meta.fetched_at).getTime();
      const { count } = await db.from('kto_events').select('id', { count: 'exact', head: true }).eq('lang', lang);
      // 저장된 행사가 실제로 있을 때만 "최근에 가져옴"으로 인정 (표가 비어 있으면 다시 가져옴)
      if (age < (meta.ok ? FRESH_MS : RETRY_MS) && (!meta.ok || ((count ?? 0) > 0 && String(meta.message ?? '').startsWith('v3')))) return json({ status: meta.ok ? 'fresh' : 'recent_error' });
    }

    const started = new Date();
    const since = new Date(Date.now() - 90 * 86400000);               // 최근 90일 안에 시작한 행사부터 (진행 중인 행사 포함)
    const today = ymd(started);
    const rows: any[] = [];
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { items, total } = await fetchPage(SERVICES[lang], key, page, ymd(since));
        for (const it of items) {
          const end = toDate(it.eventenddate);
          if (!it.contentid || !it.title || (end && end.replaceAll('-', '') < today)) continue;      // 이미 끝난 행사는 제외
          rows.push({
            id: `${lang}:${it.contentid}`, lang, title: String(it.title).slice(0, 200),
            addr: [it.addr1, it.addr2].filter(Boolean).join(' ').slice(0, 200) || null,
            start_date: toDate(it.eventstartdate), end_date: end,
            region: regionOf(it), lat: num(it.mapy), lng: num(it.mapx),
            tel: it.tel ? String(it.tel).slice(0, 60) : null, image: photoOf(it), fetched_at: started.toISOString(),
          });
        }
        if (page * PAGE_SIZE >= total) break;
      }
      if (rows.length) {
        const byId = new Map(rows.map((r) => [r.id, r]));                    // 같은 id 중복 제거
        let list = [...byId.values()];
        let { data: saved, error } = await db.from('kto_events').upsert(list, { onConflict: 'id' }).select('id');
        if (error && /image/i.test(error.message)) {                          // 007 SQL 을 아직 안 돌렸다면 사진 없이라도 저장
          list = list.map(({ image: _i, ...rest }) => rest);
          ({ data: saved, error } = await db.from('kto_events').upsert(list, { onConflict: 'id' }).select('id'));
        }
        if (error) throw new Error(`db_${error.message}`.slice(0, 120));
        if (!saved || saved.length === 0) throw new Error('db_nothing_saved');
        await db.from('kto_events').delete().eq('lang', lang).lt('fetched_at', new Date(started.getTime() - 60000).toISOString());   // 오래전에 가져온(종료/삭제된) 행사 정리
        rows.length = saved.length;
      }
      // 홈페이지 주소가 아직 없는 행사만 골라 알아봅니다 (013 SQL 을 안 돌렸으면 조용히 건너뜀)
      let detailed = 0;
      try {
        const { data: todo, error: terr } = await db.from('kto_events').select('id').eq('lang', lang).is('homepage', null).order('end_date', { ascending: true }).limit(DETAIL_PER_RUN);
        if (!terr && todo?.length) {
          for (let i = 0; i < todo.length; i += 5) {                        // 5개씩 동시에
            await Promise.all(todo.slice(i, i + 5).map(async (r: any) => {
              const hp = await fetchHomepage(SERVICES[lang], key, String(r.id).split(':')[1]);
              if (hp !== null) { await db.from('kto_events').update({ homepage: hp }).eq('id', r.id); detailed += 1; }
            }));
          }
        }
      } catch (_e) { /* 홈페이지 주소를 못 가져와도 행사 목록은 정상 */ }
      await db.from('kto_events_meta').upsert({ lang, fetched_at: started.toISOString(), ok: true, message: `v3 ${rows.length} events saved, ${detailed} homepages` });
      return json({ status: 'refreshed', count: rows.length });
    } catch (e) {
      await db.from('kto_events_meta').upsert({ lang, fetched_at: started.toISOString(), ok: false, message: String((e as Error).message ?? e).slice(0, 200) });
      return json({ status: 'error', message: String((e as Error).message ?? e).slice(0, 200) });
    }
  } catch (e) {
    return json({ status: 'error', message: String((e as Error).message ?? e).slice(0, 200) }, 500);
  }
});
