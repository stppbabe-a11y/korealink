// home.view.js | 첫 화면(Discover): 히어로+검색 / 관심사 / 다가오는 모임 / 커뮤니티 / 한국 지도
//   숫자와 모임은 전부 실제 DB 에서 가져옵니다. 데이터가 없으면 "없음" 안내를 보여 줍니다. (가짜 가입자/모임 표시 없음)
import { h, icon } from '../../core/dom.js';
import { t, formatDateTime } from '../../core/i18n.js';
import { isLoggedIn } from '../../core/store.js';
import { emptyState, spinner, avatar } from '../../core/ui.js';
import { catArt } from '../meetups/categories.js';
import { imageUrl } from '../posts/posts.service.js';
import { meetupTile } from '../meetups/meetupCard.js';
import { homeData } from './home.service.js';
import { koreaMap } from './koreaMap.js';

// 관심사 카드 8개: 모임 종류(id) / 아이콘 / 색 / (있으면) 시안에서 가져온 그림
const INTERESTS = [
  { id: 'food', icon: 'utensils', tone: 'orange' },
  { id: 'language', icon: 'chat', tone: 'blue' },
  { id: 'sightseeing', icon: 'plane', tone: 'mint' },
  { id: 'nature', icon: 'mountain', tone: 'pink' },
  { id: 'nightlife', icon: 'cocktail', tone: 'purple' },
  { id: 'culture', icon: 'landmark', tone: 'yellow' },
  { id: 'sports', icon: 'activity', tone: 'teal' },
  { id: 'photo', icon: 'camera', tone: 'rose' },
];

function hero() {
  return h('section', { class: 'home-hero' },
    h('div', { class: 'hh-text' },
      h('h1', null, t('home.title')),
      h('p', null, t('home.sub')),
      h('div', { class: 'hh-actions' },
        h('a', { class: 'btn btn-primary', href: '#/explore' }, t('home.exploreKorea'), icon('arrow', 18)),
        h('a', { class: 'btn btn-outline', href: '#/meetups?cat=sightseeing' }, icon('users', 18), t('home.findBuddies')))),
    h('div', { class: 'hh-photo' }, h('img', { src: 'icons/art/v-hero.webp', alt: '', width: 1244, height: 784, fetchpriority: 'high', decoding: 'async' })));
}

// 바로가기: 태블릿/PC = 일러스트 카드 4장, 폰 = 2x2 아이콘 타일
function shortcuts() {
  const cards = [
    { img: 'card-meetups', label: 'home.cardMeetups', href: '#/meetups', w: 253, hgt: 92 },
    { img: 'card-spots', label: 'home.cardSpots', href: '#/map', w: 246, hgt: 92 },
    { img: 'card-buddy', label: 'home.cardBuddy', href: '#/meetups?cat=sightseeing', w: 243, hgt: 92 },
    { img: 'card-stories', label: 'home.cardStories', href: '#/explore', w: 225, hgt: 92 },
  ];
  const tiles = [
    { icon: 'calendar', label: t('nav.meetups'), href: '#/meetups', cls: '' },
    { icon: 'users', label: t('home.buddies'), href: '#/meetups?cat=sightseeing', cls: '' },
    { icon: 'pin', label: t('home.placesTile'), href: '#/map', cls: 'warm' },
    { icon: 'chat', label: t('nav.community'), href: '#/explore', cls: '' },
  ];
  return [
    h('div', { class: 'quick-tiles' }, tiles.map((x) => h('a', { class: `quick-tile ${x.cls}`, href: x.href }, icon(x.icon, 30), x.label))),
    h('div', { class: 'quick-cards' }, cards.map((c) => h('a', { class: 'quick-card', href: c.href },
      h('span', { class: 'qc-img' }, h('img', { src: `icons/art/${c.img}.webp`, alt: '', width: c.w, height: c.hgt, loading: 'lazy', decoding: 'async' })),
      h('span', { class: 'qc-body' }, h('strong', null, t(c.label)), h('span', { class: 'qc-go' }, icon('arrow', 18)))))),
  ];
}

// 추천 모임: 실제 DB 에서 가장 가까운 예정 모임 1개 (없으면 모임 만들기 안내)
function featured(data) {
  const m = data.meetups?.[0];
  if (!m) return null;
  const src = m.cover ? imageUrl(m.cover, { thumb: true }) : (catArt(m.category) || 'icons/art/featured.webp');
  return h('a', { class: 'featured', href: `#/meetups/${m.id}` },
    h('span', { class: 'ft-thumb' }, h('img', { src, alt: '', loading: 'lazy', decoding: 'async', onError: (e) => e.target.remove() })),
    h('span', { class: 'ft-info' },
      h('span', { class: 'ft-label' }, icon('calendar', 16), t('home.featured')),
      h('h3', null, m.title),
      h('span', { class: 'ft-meta' },
        h('span', null, icon('pin', 14), m.region ? t(`region.${m.region}`) : m.place_name),
        h('span', null, formatDateTime(m.starts_at)))),
    h('span', { class: 'ft-side' },
      h('span', { class: 'ft-count' }, avatar(m.host, 28), t('meet.spotsOf', { n: m.joined_count, max: m.capacity }))),
    h('span', { class: 'btn btn-coral' }, t('home.joinNow'), icon('arrow', 16)));
}

function interests(stats) {
  return h('section', { class: 'home-sec' },
    h('div', { class: 'interest-row', role: 'list' }, INTERESTS.map((it) => {
      const n = stats?.byCat?.[it.id]?.meetups;
      return h('a', { class: `interest tone-${it.tone}`, role: 'listitem', href: `#/meetups?cat=${it.id}` },
        h('span', { class: 'interest-tile' }, icon(it.icon, 34)),
        h('span', { class: 'interest-name' }, t(`meet.cat.${it.id}`)),
        n ? h('span', { class: 'interest-n' }, t('home.meetupsCount', { n })) : null);
    })));
}

function head(title, href, linkText) {
  return h('div', { class: 'sec-head' }, h('h2', null, title), href && h('a', { class: 'sec-link', href }, linkText, icon('arrow', 16)));
}

function upcoming(data) {
  const body = !data.meetups ? null
    : data.meetups.length
      ? h('div', { class: 'mt-grid' }, data.meetups.slice(0, 3).map(meetupTile))
      : emptyState({ iconName: 'users', title: t('meet.none'), text: t('meet.noneText'),
        action: h('a', { class: 'btn btn-primary', href: isLoggedIn() ? '#/meetups/new' : `#/login?next=${encodeURIComponent('#/meetups/new')}` }, icon('plus', 18), t('meet.host')) });
  return h('section', { class: 'home-sec' }, head(t('home.upcoming'), '#/meetups', t('home.viewAll')), body);
}

function communityTile({ img, title, stat, href }) {
  return h('a', { class: 'com-tile', href },
    h('img', { src: `icons/art/${img}.webp`, alt: '', width: 448, height: 244, loading: 'lazy', decoding: 'async' }),
    h('span', { class: 'com-shade' }),
    h('span', { class: 'com-info' }, h('strong', null, title), h('span', null, icon('users', 15), stat)));
}

function community(data) {
  const none = t('home.beFirst');
  const food = data.byCat?.food;
  const tiles = [
    { img: 'v-group', title: t('home.global'), href: '#/explore',
      stat: data.members != null ? t('home.members', { n: data.members.toLocaleString() }) : none },
    { img: 'v-palace', title: t('home.travelKorea'), href: '#/explore',
      stat: data.places ? t('home.places', { n: data.places.toLocaleString() }) : none },
    { img: 'v-street', title: t('home.kfood'), href: '#/meetups?cat=food',
      stat: food ? t('home.meetupsCount', { n: food.meetups }) : none },
  ];
  return h('section', { class: 'home-sec' }, head(t('home.communityTitle'), '#/explore', t('home.viewMore')),
    h('div', { class: 'com-grid' }, tiles.map(communityTile)));
}

function mapSection(data) {
  const total = data.totalMeetups;
  return h('section', { class: 'home-sec map-card' },
    h('div', { class: 'map-card-text' },
      h('h2', null, t('home.mapTitle')),
      h('p', null, t('home.mapText')),
      total != null && h('p', { class: 'map-card-stat' }, icon('pin', 16), t('home.meetupsCount', { n: total })),
      h('a', { class: 'btn btn-primary', href: '#/map' }, t('home.openMap'), icon('arrow', 16))),
    h('div', { class: 'map-card-art' }, koreaMap(data.byRegion)));
}

export function homeView({ root }) {
  const lower = h('div', { class: 'home-lower' }, spinner());
  root.append(hero(), ...shortcuts(), lower);
  let alive = true;
  homeData().then((data) => {
    if (!alive) return;
    lower.replaceChildren(...[featured(data), upcoming(data), interests(data), community(data), mapSection(data)].filter(Boolean));
  }).catch(() => {
    if (alive) lower.replaceChildren(interests(null), mapSection({ byRegion: {} }));
  });
  return () => { alive = false; };
}
