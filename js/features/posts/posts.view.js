// posts.view.js | "여행하기 좋은 장소" 게시판 목록 화면 (카테고리/검색/정렬/더 보기)
import { h, icon, clear } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { isLoggedIn } from '../../core/store.js';
import { debounce } from '../../core/utils.js';
import { spinner, emptyState, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { CATEGORIES, isCategory } from './categories.js';
import { regionChips, initialRegion } from '../../core/regionChips.js';
import { listPosts, likedPostIds } from './posts.service.js';
import { postCard } from './postCard.js';

export function postListView({ root, query }) {
  const filters = {
    category: isCategory(query.get('cat')) ? query.get('cat') : '',
    region: initialRegion(query.get('region')),
    q: (query.get('q') ?? '').slice(0, 60),
    sort: query.get('sort') === 'popular' ? 'popular' : 'latest',
  };
  let page = 0;
  let loadId = 0;
  const seen = new Set();

  const list = h('div', { class: 'post-grid' });
  const more = h('div', { class: 'center more-wrap' });
  const status = h('div');

  const search = h('input', { type: 'search', class: 'search-input', placeholder: t('post.search'), value: filters.q, maxlength: 60, 'aria-label': t('post.search') });
  const chips = h('div', { class: 'chips', role: 'tablist' });
  const sortSel = h('select', { class: 'select-sm', 'aria-label': t('post.sort') },
    h('option', { value: 'latest', selected: filters.sort === 'latest' }, t('post.sortLatest')),
    h('option', { value: 'popular', selected: filters.sort === 'popular' }, t('post.sortPopular')));

  const regionBar = regionChips({ value: filters.region, onChange: (v) => { filters.region = v; sync(); reload(); } });

  function renderChips() {
    clear(chips);
    for (const value of ['', ...CATEGORIES]) {
      chips.append(h('button', {
        class: `chip${filters.category === value ? ' active' : ''}`, type: 'button', role: 'tab',
        'aria-selected': String(filters.category === value),
        onClick: () => { filters.category = value; sync(); renderChips(); reload(); },
      }, value ? t(`cat.${value}`) : t('post.all')));
    }
  }

  // 주소창에도 현재 필터를 기록 (뒤로 가기/공유 시 유지). 화면은 다시 그리지 않음.
  function sync() {
    const p = new URLSearchParams();
    if (filters.category) p.set('cat', filters.category);
    p.set('region', filters.region || 'all');
    if (filters.q) p.set('q', filters.q);
    if (filters.sort !== 'latest') p.set('sort', filters.sort);
    const qs = p.toString();
    history.replaceState(null, '', `#/explore${qs ? `?${qs}` : ''}`);
  }

  async function fetchPage(reset) {
    const my = ++loadId;
    more.replaceChildren(spinner());
    try {
      const { posts, hasMore } = await listPosts({ ...filters, page });
      if (my !== loadId) return;                               // 그 사이 필터가 바뀌었으면 버림
      const liked = await likedPostIds(posts.map((p) => p.id));
      if (my !== loadId) return;
      clear(status);
      if (reset) { clear(list); seen.clear(); }
      for (const p of posts) {
        if (seen.has(p.id)) continue;                          // 새 글이 올라와 밀린 중복 방지
        seen.add(p.id);
        list.append(postCard(p, { liked: liked.has(p.id) }));
      }
      if (seen.size === 0) {
        status.replaceChildren(emptyState({
          title: filters.q || filters.category || filters.region ? t('post.noResults') : t('post.empty'),
          text: filters.q || filters.category || filters.region ? t('post.noResultsText') : t('post.emptyText'),
          action: isLoggedIn() ? h('a', { class: 'btn btn-primary', href: '#/posts/new' }, t('post.write')) : null,
        }));
      }
      more.replaceChildren(hasMore
        ? h('button', { class: 'btn btn-soft', onClick: () => { page += 1; fetchPage(false); } }, t('common.loadMore'))
        : '');
    } catch (ex) {
      if (my !== loadId) return;
      more.replaceChildren();
      if (seen.size === 0) clear(list);
      status.replaceChildren(errorBox(friendlyError(ex), () => fetchPage(reset)));
    }
  }

  function reload() { page = 0; fetchPage(true); }

  search.addEventListener('input', debounce(() => { filters.q = search.value.trim(); sync(); reload(); }, 400));
  sortSel.addEventListener('change', () => { filters.sort = sortSel.value; sync(); reload(); });

  root.append(
    h('section', { class: 'hero' },
      h('h1', null, t('post.heroTitle')),
      h('p', null, t('post.heroText'))),
    h('div', { class: 'toolbar' },
      h('div', { class: 'search-wrap' }, icon('search', 18), search),
      sortSel,
      h('a', { class: 'btn btn-soft btn-sm', href: '#/map' }, icon('map', 16), t('map.explore'))),
    regionBar.el, chips, status, list, more,
    isLoggedIn() && h('a', { class: 'fab', href: '#/posts/new', 'aria-label': t('post.write') }, icon('plus', 26)));

  renderChips();
  reload();
  return () => { loadId += 1; };
}
