// regions.js | 한국 17개 시·도 목록 + 지도 좌표로 "대략 어느 지역인지" 추천
//   - 글/모임/이벤트의 지역 필터에 같이 씁니다. 코드는 DB(region 칸)와 한국관광공사 함수(kto-events)와 동일합니다.
import { h } from './dom.js';
import { t } from './i18n.js';

export const REGION_IDS = ['seoul', 'busan', 'incheon', 'daegu', 'daejeon', 'gwangju', 'ulsan', 'sejong', 'gyeonggi', 'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam', 'jeju'];
export const isRegion = (v) => REGION_IDS.includes(v);

// 각 지역 대표 좌표(시청/도청 부근, 대략). 가장 가까운 곳을 "추천"할 뿐이고 이용자가 바꿀 수 있습니다.
export const REGION_CENTERS = {
  seoul: [37.5665, 126.978], busan: [35.1796, 129.0756], incheon: [37.4563, 126.7052], daegu: [35.8714, 128.6014],
  daejeon: [36.3504, 127.3845], gwangju: [35.1595, 126.8526], ulsan: [35.5384, 129.3114], sejong: [36.48, 127.289],
  gyeonggi: [37.4138, 127.5183], gangwon: [37.8228, 128.1555], chungbuk: [36.6357, 127.4917], chungnam: [36.5184, 126.8],
  jeonbuk: [35.7175, 127.153], jeonnam: [34.8161, 126.4629], gyeongbuk: [36.4919, 128.8889], gyeongnam: [35.4606, 128.2132],
  jeju: [33.4996, 126.5312],
};

export function guessRegion(lat, lng) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return '';
  let best = '', bestD = Infinity;
  for (const [id, [a, b]] of Object.entries(REGION_CENTERS)) {
    const dLat = la - a, dLng = (ln - b) * Math.cos((la * Math.PI) / 180);
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) { bestD = d; best = id; }
  }
  return bestD < 1.2 * 1.2 ? best : '';    // 약 130km 안에 아무 지역 중심도 없으면 추천하지 않음
}

// <option> 목록: includeAll=true 면 맨 앞에 "전국"
export function regionOptions({ includeAll = false, includeEmpty = false } = {}) {
  const opts = [];
  if (includeAll) opts.push(h('option', { value: '' }, t('region.all')));
  else if (includeEmpty) opts.push(h('option', { value: '' }, t('region.select')));
  for (const id of REGION_IDS) opts.push(h('option', { value: id }, t(`region.${id}`)));
  return opts;
}
