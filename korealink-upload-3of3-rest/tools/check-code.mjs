// check-code.mjs | 코드 점검: (1) 문법 오류  (2) import 한 이름이 실제로 존재하는지  (3) 위험한 코드 패턴
// 실행: npm run check:code   (Node.js 18 이상)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p);
  }
})(JS);
files.push(join(ROOT, 'sw.js'));

const rel = (p) => relative(ROOT, p);
const problems = [];
const isVendor = (f) => f.includes(`${join('js', 'vendor')}`);

// ---- (1) 문법 ----
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) problems.push(`문법 오류  ${rel(f)}\n${(r.stderr || '').split('\n').slice(0, 5).join('\n')}`);
}

// ---- (2) import / export 이름 일치 ----
function exportsOf(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const seg = part.trim().split(/\s+as\s+/);
      if (seg[0]) names.add((seg[1] ?? seg[0]).trim());
    }
  }
  if (/export\s+default\b/.test(src)) names.add('default');
  return names;
}
const exportCache = new Map();
for (const f of files) {
  if (isVendor(f)) continue;
  const src = readFileSync(f, 'utf8');
  const stat = [...src.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/g)];
  const dyn = [...src.matchAll(/import\(\s*['"](\.[^'"]+)['"]\s*\)/g)].map((m) => ({ spec: m[1], names: [] }));
  const all = [
    ...stat.map((m) => ({ spec: m[2], clause: m[1] })),
    ...dyn,
  ];
  for (const imp of all) {
    const target = resolve(dirname(f), imp.spec);
    if (!existsSync(target)) { problems.push(`없는 파일을 import  ${rel(f)} -> ${imp.spec}`); continue; }
    if (isVendor(target) || !imp.clause) continue;
    if (!exportCache.has(target)) exportCache.set(target, exportsOf(target));
    const have = exportCache.get(target);
    const clause = imp.clause.trim();
    const named = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
    for (const part of named.split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !have.has(name)) problems.push(`없는 이름을 import  ${rel(f)}: { ${name} } 가 ${imp.spec} 에 없음`);
    }
    if (/^[A-Za-z_$][\w$]*\s*(,|$)/.test(clause) && !have.has('default')) problems.push(`default 가 없음  ${rel(f)} -> ${imp.spec}`);
  }
}

// 라우터가 부르는 함수 이름이 실제로 있는지
const routesSrc = readFileSync(join(JS, 'routes.js'), 'utf8');
for (const m of routesSrc.matchAll(/import\('(\.[^']+)'\)\s*,\s*fn:\s*'([A-Za-z0-9_]+)'/g)) {
  const target = resolve(JS, m[1]);
  if (!existsSync(target)) { problems.push(`routes.js: 없는 파일 ${m[1]}`); continue; }
  if (!exportsOf(target).has(m[2])) problems.push(`routes.js: ${m[1]} 에 ${m[2]} 함수가 없음`);
}

// 이벤트 메뉴의 링크는 https:// 공식 주소만 허용 (오타·http·javascript: 방지)
{
  const evFile = join(JS, 'features', 'events', 'events.data.js');
  if (existsSync(evFile)) {
    for (const m of readFileSync(evFile, 'utf8').matchAll(/url:\s*'([^']*)'/g)) {
      if (!/^https:\/\/[A-Za-z0-9.-]+\.[a-z]{2,}(\/[^\s']*)?$/.test(m[1])) problems.push(`이벤트 링크 형식 오류(https:// 로 시작해야 함): ${m[1]}`);
    }
  }
}

// ---- (3) 위험 패턴 ----
const RISKY = [
  [/\.innerHTML\s*=(?!=)/, 'innerHTML 사용 (사용자 입력이면 XSS 위험)', (f) => f.endsWith('dom.js')],   // dom.js 의 아이콘만 허용
  [/\bouterHTML\s*=/, 'outerHTML 대입'],
  [/\binsertAdjacentHTML\b/, 'insertAdjacentHTML 사용'],
  [/document\.write\b/, 'document.write 사용'],
  [/\beval\s*\(/, 'eval 사용'],
  [/new\s+Function\s*\(/, 'new Function 사용'],
  [/service_role|sb_secret_/, 'service_role / secret 키 언급', (f) => f.endsWith('config.js') || f.includes('/locales/')],   // 안내 문구는 허용
  [/\.rpc\(\s*['"`]exec/i, '임의 SQL 실행 함수 호출'],
];
for (const f of files) {
  if (isVendor(f)) continue;
  const src = readFileSync(f, 'utf8');
  src.split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');                      // 주석 제외
    for (const [re, msg, allow] of RISKY) {
      if (re.test(code) && !(allow && allow(f))) problems.push(`위험 패턴  ${rel(f)}:${i + 1}  ${msg}`);
    }
  });
}

if (problems.length) {
  console.error(`\n❌ 코드 점검 실패 (${problems.length}건)\n`);
  problems.forEach((p) => console.error(' - ' + p));
  process.exit(1);
}
console.log(`✅ 코드 점검 통과  (파일 ${files.filter((f) => !isVendor(f)).length}개: 문법 / import 이름 / 라우터 연결 / 위험 패턴)`);
