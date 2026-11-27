// koreaMap.js | 한국 약식 지도(SVG): 지역 점을 누르면 그 지역 모임으로 이동. 지도 파일/외부 서비스 없이 코드만으로 그림 (무료·가벼움)
//   윤곽선은 이해를 돕는 단순화 모양입니다(정확한 국경 아님). 점 크기 = 그 지역의 예정 모임 수.
import { t } from '../../core/i18n.js';
import { REGION_CENTERS, REGION_IDS } from '../../core/regions.js';

const NS = 'http://www.w3.org/2000/svg';
const K = 92, LAT0 = 38.75, LNG0 = 125.75, COS = Math.cos((36 * Math.PI) / 180), PAD = 10;
const px = (lat, lng) => [PAD + (lng - LNG0) * COS * K, PAD + (LAT0 - lat) * K];
const OUTLINE = [[37.95, 126.68], [37.7, 126.45], [37.45, 126.45], [37.1, 126.65], [36.9, 126.45], [36.7, 126.2], [36.35, 126.5], [36.0, 126.7], [35.8, 126.55],
  [35.55, 126.5], [35.1, 126.3], [34.7, 126.2], [34.35, 126.55], [34.3, 126.8], [34.55, 127.15], [34.7, 127.6], [34.75, 127.9], [34.95, 128.3], [34.8, 128.55],
  [35.05, 128.85], [35.05, 129.1], [35.35, 129.35], [35.9, 129.55], [36.4, 129.45], [36.95, 129.4], [37.5, 129.1], [37.9, 128.8], [38.35, 128.5], [38.6, 128.35],
  [38.3, 128.0], [38.3, 127.4], [38.1, 127.0]];
const LABELED = new Set(['seoul', 'busan', 'jeju', 'daegu']);

const el = (name, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  n.append(...kids);
  return n;
};

export function koreaMap(byRegion = {}) {
  const [w, hgt] = [PAD * 2 + 3.95 * COS * K, PAD * 2 + 5.75 * K];
  const svg = el('svg', { viewBox: `0 0 ${w.toFixed(0)} ${hgt.toFixed(0)}`, class: 'korea-map', role: 'group', 'aria-label': t('home.mapTitle') });
  svg.append(el('polygon', { class: 'km-land', points: OUTLINE.map(([a, b]) => px(a, b).map((v) => v.toFixed(1)).join(',')).join(' ') }));
  const [jx, jy] = px(33.38, 126.55);
  svg.append(el('ellipse', { class: 'km-land', cx: jx.toFixed(1), cy: jy.toFixed(1), rx: (0.45 * COS * K).toFixed(1), ry: (0.2 * K).toFixed(1) }));
  // 점이 겹치는 수도권/충청은 작은 점부터 그려서 큰 점이 위로 오게 정렬
  const ids = [...REGION_IDS].sort((a, b) => (byRegion[a] ?? 0) - (byRegion[b] ?? 0));
  for (const id of ids) {
    const [lat, lng] = REGION_CENTERS[id];
    const [x, y] = px(lat, lng);
    const n = byRegion[id] ?? 0;
    const name = t(`region.${id}`);
    const a = el('a', { href: `#/meetups?region=${id}`, class: `km-pin${n ? ' has' : ''}`, 'aria-label': `${name}${n ? ` · ${t('home.meetupsCount', { n })}` : ''}` });
    a.append(el('title', {}, n ? `${name} · ${t('home.meetupsCount', { n })}` : name),
      el('circle', { class: 'km-hit', cx: x.toFixed(1), cy: y.toFixed(1), r: 13 }),
      el('circle', { class: 'km-dot', cx: x.toFixed(1), cy: y.toFixed(1), r: (n ? 6 + Math.min(6, Math.sqrt(n) * 2) : 4.5).toFixed(1) }));
    if (LABELED.has(id) || n) a.append(el('text', { class: 'km-label', x: (x + (id === 'seoul' ? -10 : 11)).toFixed(1), y: (y + 4).toFixed(1), 'text-anchor': id === 'seoul' ? 'end' : 'start' }, name));
    svg.append(a);
  }
  return svg;
}
