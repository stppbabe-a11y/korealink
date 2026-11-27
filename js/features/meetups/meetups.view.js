// meetups.view.js | 모임 & 동행: 목록(둘러보기 / 내 모임)
import { regionChips, initialRegion } from '../../core/regionChips.js';
import { h, icon, clear } from '../../core/dom.js';
import { t, getLang, LANGS } from '../../core/i18n.js';
import { isLoggedIn } from '../../core/store.js';
import { spinner, emptyState, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { MEETUP_CATEGORIES } from './categories.js';
import { listMeetups, listMyMeetups } from './meetups.service.js';
import { meetupCard, isPast } from './meetupCard.js';

const WHEN = ['any', 'today', 'week'];

export function meetupsView({ root, query }) {
  let tab = query?.get?.('tab') === 'mine' && isLoggedIn() ? 'mine' : 'discover';
  const qc = query?.get?.('cat'), qr = query?.get?.('region'), qw = query?.get?.('when');     // 홈 화면 검색창에서 넘어온 조건
  const f = { category: MEETUP_CATEGORIES.some((c) => c.id === qc) ? qc : '', region: initialRegion(qr), when: WHEN.includes(qw) ? qw : 'any', mine: false };
  let page = 0;
  let seq = 0;

  const tabs = h('div', { class: 'segmented', role: 'tablist' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': t('meet.category') });
  const whenSel = h('select', { class: 'lang-select', 'aria-label': t('meet.when') },
    WHEN.map((w) => h('option', { value: w }, t(`meet.when.${w}`))));
  const langBtn = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' }, icon('globe', 14), ' ', t('meet.myLang', { lang: LANGS.find((l) => l.code === getLang())?.label ?? '' }));
  const regionBar = regionChips({ value: f.region, onChange: (v) => { f.region = v; load(true); } });
  whenSel.value = f.when;
  const filters = h('div', { class: 'stack-sm' }, regionBar.el, h('div', { class: 'filter-row' }, whenSel, langBtn));
  const list = h('div', { class: 'meetup-list', 'aria-live': 'polite' });
  const more = h('div', { class: 'center' });

  const paintTabs = () => tabs.replaceChildren(
    ...['discover', 'mine'].map((k) => h('button', {
      type: 'button', role: 'tab', class: `seg${tab === k ? ' active' : ''}`, 'aria-selected': String(tab === k),
      onClick: () => { if (k === 'mine' && !isLoggedIn()) { location.hash = `#/login?next=${encodeURIComponent('#/meetups?tab=mine')}`; return; } tab = k; paintTabs(); paintFilters(); load(true); },
    }, t(`meet.tab.${k}`))));
  const paintChips = () => chips.replaceChildren(
    h('button', { type: 'button', class: `chip${f.category ? '' : ' active'}`, 'aria-pressed': String(!f.category), onClick: () => { f.category = ''; paintChips(); load(true); } }, t('meet.all')),
    ...MEETUP_CATEGORIES.map((c) => h('button', {
      type: 'button', class: `chip${f.category === c.id ? ' active' : ''}`, 'aria-pressed': String(f.category === c.id),
      onClick: () => { f.category = c.id; paintChips(); load(true); },
    }, `${c.emoji} ${t(`meet.cat.${c.id}`)}`)));
  const paintFilters = () => { chips.hidden = filters.hidden = tab !== 'discover'; };

  whenSel.addEventListener('change', () => { f.when = whenSel.value; load(true); });
  langBtn.addEventListener('click', () => { f.mine = !f.mine; langBtn.classList.toggle('active', f.mine); langBtn.setAttribute('aria-pressed', String(f.mine)); load(true); });

  async function load(reset) {
    const my = ++seq;
    if (reset) { page = 0; list.replaceChildren(spinner()); more.replaceChildren(); }
    try {
      if (tab === 'mine') {
        const items = (await listMyMeetups()).sort((a, b) => {
          const pa = isPast(a) || a.is_cancelled, pb = isPast(b) || b.is_cancelled;
          if (pa !== pb) return pa ? 1 : -1;
          return pa ? new Date(b.starts_at) - new Date(a.starts_at) : new Date(a.starts_at) - new Date(b.starts_at);
        });
        if (my !== seq) return;
        list.replaceChildren(...(items.length ? items.map(meetupCard)
          : [emptyState({ iconName: 'users', title: t('meet.noMine'), text: t('meet.noMineText') })]));
        return;
      }
      const { items, hasMore } = await listMeetups({ category: f.category, region: f.region, when: f.when, lang: f.mine ? getLang() : '', page });
      if (my !== seq) return;
      if (reset) clear(list);
      if (reset && !items.length) {
        list.replaceChildren(emptyState({ iconName: 'users', title: t('meet.none'), text: t('meet.noneText'),
          action: isLoggedIn() ? h('a', { class: 'btn btn-primary', href: '#/meetups/new' }, icon('plus', 18), t('meet.host')) : undefined }));
        return;
      }
      list.append(...items.map(meetupCard));
      more.replaceChildren(hasMore ? h('button', { class: 'btn btn-soft', type: 'button', onClick: () => { page += 1; load(false); } }, t('common.loadMore')) : '');
    } catch (ex) {
      if (my === seq) list.replaceChildren(errorBox(friendlyError(ex), () => load(true)));
    }
  }

  root.append(
    h('section', { class: 'hero hero-meet' },
      h('h1', null, t('meet.title')), h('p', null, t('meet.subtitle')),
      h('a', { class: 'btn btn-sun hero-cta', href: isLoggedIn() ? '#/meetups/new' : `#/login?next=${encodeURIComponent('#/meetups/new')}` }, icon('plus', 18), t('meet.host'))),
    tabs, chips, filters, list, more,
    h('a', { class: 'fab', href: isLoggedIn() ? '#/meetups/new' : `#/login?next=${encodeURIComponent('#/meetups/new')}`, 'aria-label': t('meet.host') }, icon('plus', 26)));
  paintTabs(); paintChips(); paintFilters();
  load(true);
}
