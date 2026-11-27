// likeButton.js | 하트(좋아요) 버튼. 글과 댓글에서 함께 씁니다.
// 누르는 즉시 화면이 바뀌고(낙관적 갱신), 서버 요청이 실패하면 원래대로 되돌립니다.
import { h, icon } from '../../core/dom.js';
import { t } from '../../core/i18n.js';
import { isLoggedIn } from '../../core/store.js';
import { toast } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { navigate } from '../../core/router.js';

export function likeButton({ liked, count, toggle, size = 18 }) {
  let isLiked = !!liked;
  let total = count ?? 0;
  let busy = false;

  const num = h('span', { class: 'like-count' });
  const btn = h('button', { class: 'like-btn', type: 'button', 'aria-label': t('post.like') }, icon('heart', size), num);
  const paint = () => {
    btn.classList.toggle('liked', isLiked);
    btn.setAttribute('aria-pressed', String(isLiked));
    num.textContent = String(total);
  };
  paint();

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn()) {
      toast(t('common.loginRequired'));
      navigate(`#/login?next=${encodeURIComponent(location.hash)}`);
      return;
    }
    if (busy) return;
    busy = true;
    const before = { isLiked, total };
    isLiked = !isLiked;
    total = Math.max(0, total + (isLiked ? 1 : -1));
    paint();
    try {
      await toggle(isLiked);
    } catch (ex) {
      ({ isLiked, total } = before);
      paint();
      toast(friendlyError(ex), 'error');
    } finally {
      busy = false;
    }
  });
  return btn;
}
