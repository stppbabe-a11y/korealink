// home.service.js | 홈 화면에 필요한 "진짜 숫자"를 DB 에서 가져옵니다. (샘플/가짜 숫자 없음)
//   - 모두 읽기 전용이고 공개 데이터만 씁니다. 하나가 실패해도 나머지는 보여 주도록 각각 따로 처리합니다.
import { sb } from '../../core/supabase.js';
import { listMeetups } from '../meetups/meetups.service.js';

async function count(table, apply) {
  try {
    let q = sb.from(table).select('id', { count: 'exact', head: true });
    if (apply) q = apply(q);
    const { count: n, error } = await q;
    return error ? null : n;
  } catch { return null; }
}

export async function homeData() {
  const [meetups, members, places, upcoming] = await Promise.all([
    listMeetups({ page: 0 }).then((r) => r.items.slice(0, 4)).catch(() => null),
    count('profiles'),
    count('posts', (q) => q.eq('is_hidden', false)),
    sb.from('meetups').select('category,region,joined_count').eq('is_cancelled', false).gt('starts_at', new Date().toISOString()).limit(500)
      .then((r) => (r.error ? null : r.data)).catch(() => null),
  ]);
  const byCat = {}, byRegion = {};
  for (const m of upcoming ?? []) {
    const c = (byCat[m.category] ??= { meetups: 0, people: 0 });
    c.meetups += 1; c.people += m.joined_count ?? 0;
    if (m.region) byRegion[m.region] = (byRegion[m.region] ?? 0) + 1;
  }
  return { meetups, members, places, byCat, byRegion, totalMeetups: upcoming ? upcoming.length : null };
}
