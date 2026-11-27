// postDetail.view.js | 글 상세 (사진 갤러리 / 좋아요 / 수정·삭제 / 신고 / 댓글)
import { h, icon } from '../../core/dom.js';
import { t, timeAgo, formatDate } from '../../core/i18n.js';
import { userId, isAdmin, isLoggedIn } from '../../core/store.js';
import { avatar, nameWithFlag, confirmDialog, openDialog, toast, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';
import { likeButton } from './likeButton.js';
import { getPost, likedPostIds, setPostLike, deletePost, imageUrl } from './posts.service.js';
import { stars } from './rating.js';
import { mountPlaceMap } from '../map/mapPicker.js';
import { googleMapsUrl, osmUrl } from '../map/maplib.js';
import { commentSection } from '../comments/comments.view.js';
import { openReportDialog } from '../reports/reportDialog.js';

export async function postDetailView({ root, params }) {
  const post = await getPost(params.id);
  if (!post) {
    root.append(errorBox(t('post.notFound')));
    return;
  }
  const liked = isLoggedIn() ? (await likedPostIds([post.id])).has(post.id) : false;
  const mine = post.author_id === userId();

  const gallery = post.images.length > 0 && h('div', { class: `gallery g${Math.min(post.images.length, 3)}` },
    post.images.map((path, i) => {
      const src = imageUrl(path);
      const shown = i === 0 ? src : imageUrl(path, { thumb: true });   // 첫 사진만 크게, 나머지는 작은 사진(데이터 절약)
      return h('button', { class: 'gallery-item', type: 'button', 'aria-label': `${t('post.photos')} ${i + 1}`,
        onClick: () => openDialog(h('div', { class: 'lightbox' },
          h('img', { src, alt: post.title }),
          h('button', { class: 'btn btn-soft', onClick: (e) => e.target.closest('dialog').close('cancel') }, t('common.close')))) },
        h('img', { src: shown, alt: '', loading: i === 0 ? 'eager' : 'lazy', decoding: 'async' }));
    }));

  // 위치 (있을 때만): 지도 + 바깥 지도 앱으로 열기
  let stopMap = () => {};
  const placeBlock = post.lat != null && h('section', { class: 'place-card place-detail' },
    h('div', { class: 'place-head' }, icon('pin', 18), h('strong', null, post.place_name || t('map.unnamed'))),
    (() => {
      const box = h('div', { class: 'map-mini map-mini-lg' });
      mountPlaceMap(box, { lat: post.lat, lng: post.lng, interactive: true, zoom: 16 }).then((stop) => { stopMap = stop; });
      return box;
    })(),
    h('div', { class: 'place-links' },
      h('a', { class: 'btn btn-soft btn-sm', href: googleMapsUrl(post.lat, post.lng), target: '_blank', rel: 'noopener noreferrer' }, t('map.openGoogle')),
      h('a', { class: 'btn btn-soft btn-sm', href: osmUrl(post.lat, post.lng), target: '_blank', rel: 'noopener noreferrer' }, t('map.openOsm'))));

  const commentCount = h('span', null, String(post.comment_count));
  const actions = h('div', { class: 'post-actions' },
    likeButton({ liked, count: post.like_count, size: 20, toggle: (v) => setPostLike(post.id, v) }),
    h('span', { class: 'stat' }, icon('chat', 18), commentCount),
    h('span', { class: 'spacer' }),
    mine && h('a', { class: 'btn btn-soft btn-sm', href: `#/posts/${post.id}/edit` }, icon('edit', 16), t('common.edit')),
    (mine || isAdmin()) && h('button', { class: 'btn btn-soft btn-sm danger', type: 'button', onClick: remove }, icon('trash', 16), t('common.delete')),
    !mine && isLoggedIn() && h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: () => openReportDialog('post', post.id) }, icon('flag', 16), t('report.title')));

  async function remove() {
    if (!(await confirmDialog(t('post.deleteConfirm'), { danger: true, confirmText: t('common.delete') }))) return;
    try {
      await deletePost(post);
      toast(t('common.deleted'), 'success');
      navigate('#/explore');
    } catch (ex) { toast(friendlyError(ex), 'error'); }
  }

  root.append(
    h('a', { class: 'back-link', href: '#/explore' }, icon('back', 18), t('common.back')),
    h('article', { class: 'card post-detail' },
      gallery,
      h('div', { class: 'chips-row' },
        h('span', { class: 'badge' }, t(`cat.${post.category}`)),
        post.region && h('span', { class: 'badge badge-soft' }, t(`region.${post.region}`)),
        post.area && h('span', { class: 'badge badge-soft' }, icon('pin', 12), post.area),
        post.is_hidden && h('span', { class: 'badge badge-warn' }, t('post.hidden'))),
      h('h1', null, post.title),
      post.rating && h('div', { class: 'detail-rating' }, stars(post.rating, { size: 20 })),
      h('a', { class: 'author author-lg', href: `#/u/${encodeURIComponent(post.author?.username ?? '')}` },
        avatar(post.author, 40),
        h('span', { class: 'author-text' },
          h('strong', null, nameWithFlag(post.author)),
          h('span', { class: 'muted small' }, `${timeAgo(post.created_at)} · ${formatDate(post.created_at)}`))),
      h('p', { class: 'post-body' }, post.body),                  // 글자로만 표시. 줄바꿈은 CSS(white-space)로 처리
      placeBlock,
      actions),
    commentSection(post.id, { onTotal: (n) => { commentCount.textContent = String(n); } }));
  return () => stopMap();
}
