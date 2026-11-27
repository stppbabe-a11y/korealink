// comments.service.js | 댓글 / 대댓글 서버 통신
//   댓글 수정은 내용(body) 한 칸만, 좋아요는 기록 1줄만 바뀝니다. (전체 재저장 없음)
import { sb } from '../../core/supabase.js';
import { userId } from '../../core/store.js';
import { likedIds } from '../posts/posts.service.js';

const AUTHOR = 'author:profiles!comments_author_id_fkey(id,username,display_name,avatar_cfg,country)';
const COLS = `id,post_id,parent_id,author_id,body,like_count,is_hidden,created_at,updated_at,${AUTHOR}`;

// 한 글의 댓글을 모두 불러와 "댓글 + 대댓글 묶음" 구조로 만들어 줌
export async function listComments(postId) {
  const { data, error } = await sb.from('comments').select(COLS)
    .eq('post_id', postId).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  const liked = await likedIds('comment_likes', 'comment_id', data.map((c) => c.id));
  const roots = [];
  const byId = new Map();
  for (const c of data) {
    const node = { ...c, liked: liked.has(c.id), replies: [] };
    byId.set(c.id, node);
  }
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) byId.get(node.parent_id).replies.push(node);
    else if (!node.parent_id) roots.push(node);
  }
  return { roots, total: data.length };
}

export async function addComment(postId, body, parentId = null) {
  const { data, error } = await sb.from('comments')
    .insert({ post_id: postId, parent_id: parentId, body })
    .select(COLS).single();
  if (error) throw error;
  return { ...data, liked: false, replies: [] };
}

export async function editComment(id, body) {
  const { data, error } = await sb.from('comments').update({ body }).eq('id', id).select('updated_at').single();
  if (error) throw error;
  return data;
}

export async function deleteComment(id) {
  const { error } = await sb.from('comments').delete().eq('id', id);
  if (error) throw error;
}

export async function setCommentLike(commentId, liked) {
  if (liked) {
    const { error } = await sb.from('comment_likes').insert({ comment_id: commentId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await sb.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId());
    if (error) throw error;
  }
}
