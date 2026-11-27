// postCard.js | 게시글 목록에 쓰이는 카드 한 장
import { h, icon } from '../../core/dom.js';
import { t, timeAgo } from '../../core/i18n.js';
import { avatar, nameWithFlag } from '../../core/ui.js';
import { userId } from '../../core/store.js';
import { likeButton } from './likeButton.js';
import { setPostLike, imageUrl } from './posts.service.js';
import { stars } from './rating.js';

export function postCard(post, { liked = false } = {}) {
  const cover = post.images?.[0];
  const text = post.summary ?? post.body ?? '';
  const snippet = text.length > 120 ? text.slice(0, 120).trimEnd() + '…' : text;
  return h('article', { class: 'card post-card' },
    h('a', { class: 'post-link', href: `#/posts/${post.id}`, 'aria-label': post.title },
      cover
        ? h('div', { class: 'post-cover' }, h('img', { src: imageUrl(cover, { thumb: true }), alt: '', loading: 'lazy', decoding: 'async' }))
        : h('div', { class: 'post-cover post-cover-empty' }, icon('image', 28)),
      h('div', { class: 'post-main' },
        h('div', { class: 'chips-row' },
          h('span', { class: 'badge' }, t(`cat.${post.category}`)),
          post.region && h('span', { class: 'badge badge-soft' }, t(`region.${post.region}`)),
          (post.place_name || post.area) && h('span', { class: 'badge badge-soft' }, icon('pin', 12), post.place_name || post.area),
          post.is_hidden && h('span', { class: 'badge badge-warn' }, t('post.hidden'))),
        h('h3', { class: 'post-title' }, post.title),
        post.rating && h('div', { class: 'post-rating' }, stars(post.rating, { size: 14 })),
        h('p', { class: 'post-snippet' }, snippet))),
    h('div', { class: 'post-meta' },
      h('a', { class: 'author', href: `#/u/${encodeURIComponent(post.author?.username ?? '')}` },
        avatar(post.author, 24), h('span', null, nameWithFlag(post.author))),
      h('span', { class: 'muted small' }, timeAgo(post.created_at)),
      h('span', { class: 'spacer' }),
      post.author_id && post.author_id === userId() && h('a', { class: 'btn btn-text btn-sm card-edit', href: `#/posts/${post.id}/edit`, 'aria-label': t('common.edit') }, icon('edit', 14), t('common.edit')),
      h('span', { class: 'stat', title: t('post.comments') }, icon('chat', 16), String(post.comment_count)),
      likeButton({ liked, count: post.like_count, toggle: (v) => setPostLike(post.id, v) })));
}
