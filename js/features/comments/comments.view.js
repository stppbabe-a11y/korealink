// comments.view.js | 댓글 영역 (댓글 쓰기 / 대댓글 / 수정 / 삭제 / 좋아요 / 신고)
import { h, icon, clear } from '../../core/dom.js';
import { t, timeAgo } from '../../core/i18n.js';
import { isLoggedIn, userId, isAdmin } from '../../core/store.js';
import { avatar, displayName, nameWithFlag, confirmDialog, toast, spinner, errorBox } from '../../core/ui.js';
import { friendlyError } from '../../core/errors.js';
import { formError, runBusy } from '../../core/form.js';
import { navigate } from '../../core/router.js';
import { likeButton } from '../posts/likeButton.js';
import { openReportDialog } from '../reports/reportDialog.js';
import { listComments, addComment, editComment, deleteComment, setCommentLike } from './comments.service.js';

// commentSection(글 id, { onTotal: (개수) => ... })  ->  화면 조각
export function commentSection(postId, { onTotal } = {}) {
  const box = h('section', { class: 'comments', 'aria-labelledby': 'comments-title' });
  const heading = h('h2', { id: 'comments-title' });
  const listEl = h('div', { class: 'comment-list' });
  let total = 0;

  const setTotal = (n) => {
    total = n;
    heading.textContent = `${t('post.comments')} ${n}`;
    onTotal?.(n);
  };

  function composer({ parentId = null, placeholder, onDone, autofocus = false, initial = '', submitLabel }) {
    if (!isLoggedIn()) {
      return h('p', { class: 'muted login-hint' },
        h('a', { href: `#/login?next=${encodeURIComponent(location.hash)}` }, t('auth.login')), ' ', t('comment.loginToWrite'));
    }
    const ta = h('textarea', { rows: 2, maxlength: 1000, placeholder, required: true, 'aria-label': placeholder }, initial);
    const err = formError();
    const form = h('form', { class: 'composer' }, ta, err.el,
      h('div', { class: 'composer-actions' },
        h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, submitLabel ?? t('comment.post'))));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) return;
      err.set('');
      try {
        await runBusy(form, () => onDone(body));
        ta.value = '';
      } catch (ex) { err.set(friendlyError(ex)); }
    });
    if (autofocus) queueMicrotask(() => ta.focus());
    return form;
  }

  function node(c, isReply) {
    const mine = c.author_id === userId();
    const bodyEl = h('p', { class: 'comment-body' }, c.body);          // 글자로만 표시 (코드 실행 불가)
    const actions = h('div', { class: 'comment-actions' });
    const replyBox = h('div', { class: 'reply-box' });
    const repliesEl = h('div', { class: 'replies' }, c.replies.map((r) => node(r, true)));
    const meta = h('span', { class: 'muted small' }, timeAgo(c.created_at), c.updated_at !== c.created_at && ` · ${t('common.edited')}`);

    actions.append(likeButton({ liked: c.liked, count: c.like_count, size: 16, toggle: (v) => setCommentLike(c.id, v) }));

    if (!isReply) {
      actions.append(h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: () => {
        if (!isLoggedIn()) { toast(t('common.loginRequired')); return navigate(`#/login?next=${encodeURIComponent(location.hash)}`); }
        if (replyBox.childElementCount) return clear(replyBox);
        replyBox.append(composer({
          parentId: c.id, autofocus: true, placeholder: t('comment.replyPlaceholder'), submitLabel: t('comment.reply'),
          onDone: async (body) => {
            const created = await addComment(postId, body, c.id);
            c.replies.push(created);
            repliesEl.append(node(created, true));
            clear(replyBox);
            setTotal(total + 1);
          },
        }));
      } }, icon('reply', 16), t('comment.reply')));
    }
    if (mine) {
      actions.append(h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: () => startEdit() }, icon('edit', 16), t('common.edit')));
    } else if (isLoggedIn()) {
      actions.append(h('button', { class: 'btn btn-text btn-sm', type: 'button', onClick: () => openReportDialog('comment', c.id) }, icon('flag', 16), t('report.title')));
    }
    if (mine || isAdmin()) {
      actions.append(h('button', { class: 'btn btn-text btn-sm danger', type: 'button', onClick: remove }, icon('trash', 16), t('common.delete')));
    }

    const root = h('div', { class: `comment${isReply ? ' is-reply' : ''}`, id: `c-${c.id}` },
      h('a', { href: `#/u/${encodeURIComponent(c.author?.username ?? '')}`, 'aria-label': displayName(c.author) }, avatar(c.author, isReply ? 28 : 34)),
      h('div', { class: 'comment-main' },
        h('div', { class: 'comment-head' },
          h('a', { class: 'author-name', href: `#/u/${encodeURIComponent(c.author?.username ?? '')}` }, nameWithFlag(c.author)),
          c.is_hidden && h('span', { class: 'badge badge-warn' }, t('post.hidden')),
          meta),
        bodyEl, actions, replyBox, !isReply && repliesEl));

    function startEdit() {
      const form = composer({
        initial: c.body, autofocus: true, placeholder: t('comment.placeholder'), submitLabel: t('common.save'),
        onDone: async (body) => {
          if (body !== c.body) {                                  // 바뀐 게 있을 때만 서버에 저장
            const res = await editComment(c.id, body);
            c.body = body;
            c.updated_at = res.updated_at;
            toast(t('common.saved'), 'success');
          }
          bodyEl.textContent = c.body;
          meta.textContent = `${timeAgo(c.created_at)}${c.updated_at !== c.created_at ? ` · ${t('common.edited')}` : ''}`;
          bodyEl.hidden = false;
          form.remove();
        },
      });
      bodyEl.hidden = true;
      bodyEl.after(form);
    }

    async function remove() {
      const hasReplies = !isReply && c.replies.length > 0;
      if (!(await confirmDialog(hasReplies ? t('comment.deleteWithReplies') : t('comment.deleteConfirm'), { danger: true, confirmText: t('common.delete') }))) return;
      try {
        await deleteComment(c.id);
        root.remove();
        setTotal(Math.max(0, total - 1 - (isReply ? 0 : c.replies.length)));
        toast(t('common.deleted'), 'success');
      } catch (ex) { toast(friendlyError(ex), 'error'); }
    }
    return root;
  }

  async function load() {
    listEl.replaceChildren(spinner());
    try {
      const { roots, total: n } = await listComments(postId);
      clear(listEl);
      setTotal(n);
      if (roots.length === 0) listEl.append(h('p', { class: 'muted center pad' }, t('comment.empty')));
      for (const c of roots) listEl.append(node(c, false));
    } catch (ex) {
      listEl.replaceChildren(errorBox(friendlyError(ex), load));
    }
  }

  box.append(heading,
    composer({
      placeholder: t('comment.placeholder'),
      onDone: async (body) => {
        const created = await addComment(postId, body);
        const empty = listEl.querySelector('p.pad');
        if (empty) empty.remove();
        listEl.append(node(created, false));
        setTotal(total + 1);
      },
    }),
    listEl);
  load();
  return box;
}
