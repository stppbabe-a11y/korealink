// geocode.js | 장소 이름 <-> 좌표 변환 (둘 다 무료 · API 키 없음, OpenStreetMap 데이터)
//   1순위 Photon (komoot): 오타에 강하고 영어/영문 이름 검색이 잘 됨, 글자 입력 중 미리보기(자동완성)용으로 만들어진 서버
//   2순위 Nominatim (OSM 공식): Photon 에 결과가 없을 때만, 검색 버튼/엔터를 눌렀을 때 보조로 사용 (1초에 1번 이하 규칙 준수)
const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const KOREA_BBOX = '124.5,33.0,132.0,38.8';      // 대한민국 전체 (minLon,minLat,maxLon,maxLat)
const KOREA = { lat: 36.35, lng: 127.8 };          // 한국 전체의 중심 (검색 결과는 한국 안에서만, 약한 우선순위)
const cache = new Map();
const lastCall = { photon: 0, nominatim: 0 };
let inflight = null;

const clip = (s, n = 100) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const photonLang = (lang) => (lang === 'ko' ? 'default' : lang === 'de' ? 'de' : lang === 'fr' ? 'fr' : 'en');

async function call(service, url, { gap, signal } = {}) {
  if (cache.has(url)) return cache.get(url);
  const wait = lastCall[service] + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall[service] = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`geocode_${res.status}`);
    const json = await res.json();
    cache.set(url, json);
    return json;
  } finally { clearTimeout(timer); }
}

function fromPhoton(f) {
  const p = f.properties ?? {};
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const name = clip(p.name || street || p.district || p.city);
  const parts = [street && street !== name ? street : null, p.district || p.locality, p.city, p.state].filter(Boolean);
  return { name, address: clip([...new Set(parts)].join(', '), 140), lat: Number(lat), lng: Number(lng), cc: p.countrycode };
}
const valid = (r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng);

// 글자 입력 중 미리보기용: Photon 만 사용 (이전 요청이 진행 중이면 취소)
export async function suggestPlaces(query, lang = 'en') {
  const q = clip(query, 80);
  if (q.length < 2) return [];
  inflight?.abort();
  inflight = new AbortController();
  const url = `${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=8&lang=${photonLang(lang)}&lat=${KOREA.lat}&lon=${KOREA.lng}&location_bias_scale=0.2&bbox=${KOREA_BBOX}`;
  const json = await call('photon', url, { gap: 500, signal: inflight.signal });
  return (json.features ?? []).map(fromPhoton).filter((r) => valid(r) && (!r.cc || r.cc === 'KR'));
}

// 검색 버튼/엔터: Photon -> 결과가 없으면 Nominatim
export async function searchPlaces(query, lang = 'en') {
  const q = clip(query, 80);
  if (q.length < 2) return [];
  let found = [];
  try { found = await suggestPlaces(q, lang); } catch { /* Photon 이 잠시 안 되면 아래 보조 검색으로 */ }
  if (found.length) return found;
  const url = `${NOMINATIM}/search?format=jsonv2&limit=8&countrycodes=kr&viewbox=128.75,35.40,129.40,34.85&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
  const data = await call('nominatim', url, { gap: 1100 });
  return data.map((r) => ({ name: clip(r.name || String(r.display_name).split(',')[0]), address: clip(r.display_name, 140), lat: Number(r.lat), lng: Number(r.lon) })).filter(valid);
}

// 지도에서 누른 곳의 이름 (Photon -> 실패 시 Nominatim)
export async function reversePlace(lat, lng, lang = 'en') {
  const la = Number(lat).toFixed(6);
  const lo = Number(lng).toFixed(6);
  try {
    const json = await call('photon', `${PHOTON}/reverse?lon=${lo}&lat=${la}&lang=${photonLang(lang)}`, { gap: 500 });
    const r = fromPhoton(json.features?.[0] ?? {});
    if (r.name) return r.name;
  } catch { /* 보조 서버로 */ }
  const data = await call('nominatim', `${NOMINATIM}/reverse?format=jsonv2&zoom=18&lat=${la}&lon=${lo}&accept-language=${encodeURIComponent(lang)}`, { gap: 1100 });
  if (!data || data.error) return '';
  const a = data.address ?? {};
  return clip(data.name || a.road || a.suburb || a.neighbourhood || String(data.display_name ?? '').split(',').slice(0, 2).join(','));
}
