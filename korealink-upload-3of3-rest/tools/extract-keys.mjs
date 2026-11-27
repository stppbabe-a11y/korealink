// extract-keys.mjs | 코드에서 사용하는 번역 키를 모두 찾아 출력 (check-i18n.mjs 와 같은 규칙)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../js', import.meta.url).pathname;
const SKIP = new Set(['vendor', 'locales']);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!SKIP.has(n)) walk(p); } else if (n.endsWith('.js')) files.push(p);
  }
})(ROOT);

// 동적 키(템플릿 문자열)는 여기에 가능한 값을 직접 나열
const DYNAMIC = [
  ...['sightseeing', 'food', 'nature', 'nightlife', 'culture', 'shopping', 'transport', 'other'].map((c) => `cat.${c}`),
  ...['spam', 'abuse', 'inappropriate', 'other'].map((r) => `report.${r}`),
  ...['reports', 'users', 'rooms'].map((k) => `admin.tab.${k}`),
  ...['open', 'resolved', 'dismissed'].map((s) => `admin.status.${s}`),
  ...['post', 'comment', 'message'].map((k) => `admin.type.${k}`),
  ...['general', 'tips', 'meetups'].flatMap((s) => [`room.${s}.name`, `room.${s}.desc`]),
  ...[1, 2, 3].map((n) => `setup.step${n}`),
  'admin.hidden', 'admin.unbanned', 'admin.dismissed',   // act(fn, 'key') / t(cond ? a : b) 형태로 쓰임
];

export function usedKeys() {
  const keys = new Set(DYNAMIC);
  const re = /\bt\(\s*(['"`])([A-Za-z0-9_.]+)\1/g;
  const labelRe = /(?:label|placeholder)\s*:\s*'([a-z]+\.[A-Za-z0-9_.]+)'/g;   // routes/nav 의 label: 'nav.explore' 형태
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) if (m[2] !== 'key') keys.add(m[2]);   // 'key' 는 주석 속 예시
    for (const m of src.matchAll(labelRe)) keys.add(m[1]);
  }
  return [...keys].sort();
}

if (process.argv[1] === new URL(import.meta.url).pathname) console.log(usedKeys().join('\n'));
