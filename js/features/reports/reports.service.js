// reports.service.js | 신고 접수 (서버 함수 report_content 를 통해서만 가능)
import { sb } from '../../core/supabase.js';

export const REASONS = ['spam', 'abuse', 'inappropriate', 'other'];

export async function reportContent(type, id, reason, note) {
  const { error } = await sb.rpc('report_content', {
    p_type: type, p_id: String(id), p_reason: reason, p_note: note || null,
  });
  if (error) throw error;
}
