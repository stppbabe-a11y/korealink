// postFeed.js | 특정 회원의 글 목록 (프로필 화면에서 사용). "더 보기" 방식.
import { h } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { spinner, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { listPosts, likedPostIds } from './posts.service.js';
import { postCard } from './postCard.js';

export function postFeed({ authorId, emptyText }) {
  const list = h('div', { class: 'post-grid' });
  const foot = h('div', { class: 'center more-wrap' });
  const el = h('div', null, list, foot);
  let page = 0;
  let count = 0;
  let alive = true;

  async function load() {
    foot.replaceChildren(spinner());
    try {
      const { posts, hasMore } = await listPosts({ authorId, page });
      if (!alive) return;
      const liked = await likedPostIds(posts.map((p) => p.id));
      posts.forEach((p) => list.append(postCard(p, { liked: liked.has(p.id) })));
      count += posts.length;
      foot.replaceChildren(
        count === 0 ? h('p', { class: 'muted pad' }, emptyText ?? t('post.empty')) : '',
        hasMore ? h('button', { class: 'btn btn-soft', onClick: () => { page += 1; load(); } }, t('common.loadMore')) : '');
    } catch (ex) {
      if (alive) foot.replaceChildren(errorBox(friendlyError(ex), load));
    }
  }
  load();
  return { el, destroy: () => { alive = false; } };
}
