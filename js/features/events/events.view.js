// events.view.js | 이벤트 메뉴: 한국관광공사 정보 + 지역별 대표 행사 사이트 링크
//   - 서버(DB)를 쓰지 않는 "링크 모음" 화면이라 비용이 0원입니다.
//   - 모든 링크는 새 창 + noopener noreferrer 로 열립니다.
import { h, icon } from '../../core/dom.js';
import { t, getLang, formatDate } from '../../core/i18n.js';
import { googleMapsUrl } from '../map/maplib.js';
import { VISITKOREA, HOTLINE, REGIONS } from './events.data.js';
import { REGION_IDS } from '../../core/regions.js';
import { extLink, lazyLink } from '../../core/extLink.js';
import { state } from '../../core/store.js';
import { resolveHomepage, listEvents, refreshNow, isOngoing, ktoStatus } from './events.service.js';

const regionOf = (id) => (id === 'gyeongju' ? 'gyeongbuk' : id);      // 경주는 경북 소속
const ext = (href, ...kids) => extLink({ class: 'btn btn-soft btn-sm', href }, ...kids, icon('external', 14));

// 내가 "거주 지역"으로 정한 지역 (한국 밖이면 없음). 이 지역은 목록 맨 앞에 ★로 보여 줍니다.
const myRegion = () => { const r = state.profile?.residence_region; return REGION_IDS.includes(r) ? r : ''; };

// 행사 카드를 누르면 그 행사의 공식 홈페이지로 바로 이동. 한국관광공사에 홈페이지가 없는 행사만 "구글 검색"으로 대체합니다
const searchUrl = (title, lang) => `https://www.google.com/search?q=${encodeURIComponent(lang === 'ko' ? title : `${title} Korea`)}`;

// 공식 홈페이지 주소가 이미 있으면 바로 그 주소로, 없으면 누르는 순간 서버에 물어서 그 행사 페이지로 보냅니다 (끝내 없을 때만 구글 검색)
function eventLink(e, lang) {
  const kids = [e.title, icon('external', 14)];
  if (/^https?:\/\//i.test(e.homepage ?? '')) return extLink({ class: 'stretched', href: e.homepage }, ...kids);
  if (e.homepage === '') return extLink({ class: 'stretched', href: searchUrl(e.title, lang) }, ...kids);
  return lazyLink({ class: 'stretched', href: searchUrl(e.title, lang) }, () => resolveOnce(e, lang), ...kids);
}

// 행사 홈페이지 조회 (같은 행사는 한 번만 서버에 물어봄)
function resolveOnce(e, lang) {
  if (/^https?:\/\//i.test(e.homepage ?? '')) return Promise.resolve(e.homepage);
  e._pending ??= resolveHomepage(e.id, lang).then((u) => { if (u) e.homepage = u; return u; }).finally(() => { e._pending = null; });
  return e._pending;
}

// 목록이 뜬 뒤 미리 홈페이지를 찾아 둠 → 폰에서 눌렀을 때 기다림 없이 바로 이동 (한 번에 2개씩, 앞쪽 12개)
async function prefetchHomepages(rows, lang, isStale) {
  const todo = rows.filter((e) => e.homepage == null).slice(0, 12);
  const worker = async () => { while (todo.length && !isStale()) { try { await resolveOnce(todo.shift(), lang); } catch { /* 무시 */ } } };
  await Promise.all([worker(), worker()]);
}

function eventCard(e, lang) {
  const when = e.start_date === e.end_date ? formatDate(e.start_date) : `${formatDate(e.start_date)} – ${formatDate(e.end_date)}`;
  return h('article', { class: `card live-event${e.image ? ' has-photo' : ''}` },
    e.image && h('img', { class: 'live-photo', src: e.image, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', onError: (ev) => ev.target.remove() }),
    h('div', { class: 'live-top' },
      h('span', { class: `badge ${isOngoing(e) ? '' : 'badge-soft'}` }, t(isOngoing(e) ? 'events.ongoing' : 'events.upcoming')),
      e.region && h('span', { class: 'muted small' }, t(`region.${e.region}`))),
    h('h3', null, eventLink(e, lang)),
    h('p', { class: 'muted small' }, icon('calendar', 14), ' ', when),
    e.addr && h('p', { class: 'muted small' }, icon('pin', 14), ' ', e.addr),
    h('div', { class: 'event-links raised' },
      e.lat != null && e.lng != null && h('a', { class: 'btn btn-soft btn-sm', href: googleMapsUrl(e.lat, e.lng), target: '_blank', rel: 'noopener noreferrer' }, icon('map', 14), t('events.openMap')),
      e.tel && /^[0-9+\-\s()]{5,30}$/.test(e.tel) && h('a', { class: 'btn btn-soft btn-sm', href: `tel:${e.tel.replace(/[^0-9+]/g, '')}` }, icon('phone', 14), e.tel)));
}

function liveSection() {
  const lang = getLang();
  let region = myRegion();          // 처음에는 내가 프로필에 정한 거주 지역 ('' = 전국)
  const list = h('div', { class: 'live-list', 'aria-live': 'polite' });
  // 지역은 드롭다운이 아니라 "전국 + 17개 시·도"를 전부 펼쳐 놓고 하나씩 누르면 바뀝니다
  const chips = h('div', { class: 'chips-row region-chips', role: 'group', 'aria-label': t('region.label') });
  const mine = myRegion();
  // 내 거주 지역(★)이 맨 앞, 그다음 전국, 나머지 지역
  const chipList = () => [
    ...(mine ? [{ id: mine, label: `★ ${t(`region.${mine}`)}`, star: true }] : []),
    { id: '', label: t('region.all') },
    ...REGION_IDS.filter((id) => id !== mine).map((id) => ({ id, label: t(`region.${id}`) })),
  ];
  const paintChips = () => chips.replaceChildren(...chipList().map((r) =>
    h('button', { class: `chip${r.id === region ? ' active' : ''}${r.star ? ' chip-star' : ''}`, type: 'button', 'aria-pressed': r.id === region ? 'true' : 'false', onClick: () => { region = r.id; paintChips(); load(); } }, r.label)));
  paintChips();
  let seq = 0;

  async function load(retry = true) {
    const my = ++seq;
    list.replaceChildren(h('p', { class: 'muted' }, t('common.loading')));
    let res;
    try { res = await listEvents(lang, region || 'all'); } catch { res = { rows: [], lang: 'en' }; }
    if (my !== seq) return;
    if (!res.rows.length && retry && !region) {
      await refreshNow(lang);                       // 처음 방문: 서버에 한 번 갱신 요청 후 다시 읽기
      if (my !== seq) return;
      return load(false);
    }
    list.replaceChildren(...(res.rows.length
      ? res.rows.map((e) => eventCard(e, lang))
      : [h('p', { class: 'muted empty-note' }, t('events.live.empty')), ktoStatus.text && h('p', { class: 'muted small status-note' }, `Status: ${ktoStatus.text}`)]));
    prefetchHomepages(res.rows, lang, () => my !== seq);
  }

  load();
  return h('section', { class: 'live-section' },
    h('h2', { class: 'section-title' }, icon('calendar', 20), ' ', t('events.live.title')),
    h('p', { class: 'muted small' }, t('events.live.text')),
    chips, list);
}

export function eventsView({ root }) {
  const lang = getLang();
  const main = VISITKOREA.find((v) => v.lang === lang) ?? VISITKOREA[0];
  const others = VISITKOREA.filter((v) => v !== main);

  root.append(h('div', { class: 'events-page' },
    h('section', { class: 'hero' }, h('h1', null, t('events.title')), h('p', null, t('events.subtitle'))),

    liveSection(),

    h('section', { class: 'card event-card' },
      h('h2', null, icon('calendar', 20), ' ', t('events.kto.title')),
      h('p', null, t('events.kto.text')),
      h('div', { class: 'event-links' },
        extLink({ class: 'btn btn-primary btn-sm', href: main.url }, t('events.kto.open'), icon('external', 14))),
      h('div', { class: 'event-links' },
        h('span', { class: 'muted small' }, t('events.kto.other')),
        others.map((o) => ext(o.url, o.label)))),

    h('section', { class: 'card event-card' },
      h('h2', null, icon('phone', 20), ' ', t('events.hotline.title')),
      h('p', null, t('events.hotline.text')),
      h('div', { class: 'event-links' },
        h('a', { class: 'btn btn-soft btn-sm', href: HOTLINE.tel }, icon('phone', 14), `${t('events.hotline.domestic')} ${HOTLINE.display}`),
        h('a', { class: 'btn btn-soft btn-sm', href: HOTLINE.intlTel }, icon('phone', 14), `${t('events.hotline.abroad')} ${HOTLINE.intl}`))),

    h('h2', { class: 'section-title' }, t('events.regions')),
    h('div', { class: 'region-grid' },
      [...REGIONS].sort((a, b) => Number(regionOf(b.id) === myRegion() && !!myRegion()) - Number(regionOf(a.id) === myRegion() && !!myRegion())).map((r) => h('section', { class: `card event-card${myRegion() && regionOf(r.id) === myRegion() ? ' is-mine' : ''}` },
        h('h3', null, icon('pin', 18), ' ', myRegion() && regionOf(r.id) === myRegion() ? '★ ' : '', t(`events.region.${r.id}`)),
        h('p', null, t(`events.region.${r.id}.text`)),
        h('div', { class: 'link-rows' }, r.links.map((l) => extLink({ class: 'link-row', href: l.url }, h('span', null, t(l.label)), icon('external', 16))))))),

    h('p', { class: 'event-note' }, t('events.note'))));
}
