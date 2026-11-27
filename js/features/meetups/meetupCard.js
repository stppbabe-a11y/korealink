// meetupCard.js | 모임 카드 (목록/내 모임 공통)
import { h, icon } from '../../core/dom.js';
import { t, formatDateTime, formatDate, formatWeekday } from '../../core/i18n.js';
import { nameWithFlag, avatar } from '../../core/ui.js';
import { imageUrl } from '../posts/posts.service.js';
import { catEmoji, catArt } from './categories.js';

export const isPast = (m) => new Date(m.starts_at).getTime() <= Date.now();
export const isFull = (m) => m.joined_count >= m.capacity;

export function dateBadge(iso) {
  const d = new Date(iso);
  return h('span', { class: 'date-badge', 'aria-hidden': 'true' },
    h('b', null, d.getDate()), h('span', null, formatDate(d, { month: 'short' })));
}

export function spotsBar(m) {
  const pct = Math.min(100, Math.round((m.joined_count / m.capacity) * 100));
  const bar = h('span', { class: 'spots-bar', role: 'img', 'aria-label': t('meet.spotsOf', { n: m.joined_count, max: m.capacity }) }, h('i'));
  bar.firstChild.style.width = `${pct}%`;
  return h('span', { class: 'spots' }, icon('users', 14), h('span', null, t('meet.spotsOf', { n: m.joined_count, max: m.capacity })), bar);
}

export function statusBadges(m) {
  return [
    m.is_cancelled && h('span', { class: 'badge badge-bad' }, t('meet.cancelled')),
    !m.is_cancelled && isPast(m) && h('span', { class: 'badge badge-soft' }, t('meet.ended')),
    !m.is_cancelled && !isPast(m) && isFull(m) && h('span', { class: 'badge badge-warn' }, t('meet.full')),
    m.approval && h('span', { class: 'badge badge-soft' }, icon('lock', 12), t('meet.approvalBadge')),
    m.my_status === 'pending' && h('span', { class: 'badge badge-warn' }, t('meet.pending')),
    m.my_status === 'joined' && h('span', { class: 'badge' }, icon('check', 12), t('meet.going')),
  ].filter(Boolean);
}

export function meetupCard(m) {
  const art = catArt(m.category);
  const cover = m.cover
    ? h('img', { class: 'mc-img', src: imageUrl(m.cover, { thumb: true }), alt: '', loading: 'lazy', decoding: 'async', onError: (e) => e.target.remove() })
    : art ? h('img', { class: 'mc-img mc-art', src: art, alt: '', loading: 'lazy', decoding: 'async' }) : null;
  return h('a', { class: `card meetup-card${m.is_cancelled || isPast(m) ? ' is-over' : ''}`, href: `#/meetups/${m.id}` },
    h('span', { class: 'mc-media' }, (!m.cover && art) ? null : h('span', { class: 'mc-emoji', 'aria-hidden': 'true' }, catEmoji(m.category)), cover),
    h('span', { class: 'mc-body' },
      h('span', { class: 'mc-when' }, dateBadge(m.starts_at), h('span', null, formatDateTime(m.starts_at))),
      h('strong', { class: 'mc-title' }, m.title),
      h('span', { class: 'mc-place muted' }, icon('pin', 14), m.region ? `${t(`region.${m.region}`)} · ${m.place_name}` : m.place_name),
      h('span', { class: 'mc-meta' },
        h('span', { class: 'mc-host muted' }, t('meet.hostedBy'), ' ', nameWithFlag(m.host)),
        spotsBar(m)),
      h('span', { class: 'mc-badges' }, statusBadges(m),
        (m.languages ?? []).map((l) => h('span', { class: 'badge badge-soft lang-badge' }, l.toUpperCase())),
        m.cost_note && h('span', { class: 'badge badge-soft' }, m.cost_note))));
}

// 홈 화면용 사진 카드: 큰 사진 + 날짜/지역 라벨 + 참여 인원 + 참가 버튼 (누르면 모임 상세로 이동)
export function meetupTile(m) {
  const art = catArt(m.category);
  const src = m.cover ? imageUrl(m.cover, { thumb: true }) : art;
  const over = isPast(m) || m.is_cancelled;
  const full = isFull(m);
  return h('a', { class: `mt-card${over ? ' is-over' : ''}`, href: `#/meetups/${m.id}` },
    h('span', { class: 'mt-media' },
      src ? h('img', { src, alt: '', loading: 'lazy', decoding: 'async', onError: (e) => e.target.remove() }) : h('span', { class: 'mc-emoji' }, catEmoji(m.category)),
      h('span', { class: 'mt-date' }, formatDateTime(m.starts_at)),
      h('span', { class: 'mt-place' }, icon('pin', 13), m.region ? t(`region.${m.region}`) : m.place_name)),
    h('span', { class: 'mt-body' },
      h('strong', { class: 'mt-title' }, m.title),
      h('span', { class: 'mt-sub muted' }, m.place_name),
      h('span', { class: 'mt-foot' },
        h('span', { class: 'mt-people' }, avatar(m.host, 28), h('span', { class: 'small muted' }, icon('users', 14), ' ', t('meet.spotsOf', { n: m.joined_count, max: m.capacity }))),
        h('span', { class: `btn btn-sm ${full ? 'btn-outline' : 'btn-primary'}` }, full ? t('meet.full') : t('home.join')))));
}
