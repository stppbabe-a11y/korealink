// mapExplore.view.js | 위치가 있는 글을 한 지도에 모아 보기 (핀을 누르면 글로 이동)
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { spinner, emptyState, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { loadMapLib, createMap, addPin } from './maplib.js';
import { listMapPosts } from '../posts/posts.service.js';
import { stars } from '../posts/rating.js';

export async function mapExploreView({ root }) {
  root.append(h('a', { class: 'back-link', href: '#/explore' }, icon('back', 18), t('common.back')),
    h('h1', null, t('map.exploreTitle')));
  const holder = h('div', null, spinner());
  root.append(holder);
  let map = null;
  let alive = true;
  try {
    const [ml, posts] = await Promise.all([loadMapLib(), listMapPosts()]);
    if (!alive) return () => {};
    if (posts.length === 0) {
      holder.replaceChildren(emptyState({ iconName: 'pin', title: t('map.exploreEmpty') }));
      return () => {};
    }
    const box = h('div', { class: 'map-box map-box-lg' });
    holder.replaceChildren(box);
    map = createMap(ml, box, { zoom: 7 });
    const bounds = new ml.LngLatBounds();
    for (const p of posts) {
      const popup = h('div', { class: 'map-popup' },
        h('a', { href: `#/posts/${p.id}` }, h('strong', null, p.title)),
        p.place_name && h('div', { class: 'small muted' }, p.place_name),
        p.rating && stars(p.rating, { size: 14, showNumber: false }));
      addPin(ml, map, p, { popup });
      bounds.extend([p.lng, p.lat]);
    }
    map.once('load', () => map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 0 }));
    setTimeout(() => map?.resize(), 50);
  } catch (ex) {
    holder.replaceChildren(errorBox(ex?.name === 'TypeError' ? t('map.loadFail') : friendlyError(ex)));
  }
  return () => { alive = false; map?.remove(); };
}
