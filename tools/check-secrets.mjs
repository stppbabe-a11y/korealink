// check-secrets.mjs | 비밀키 노출 점검: 배포할 파일에 "절대 있으면 안 되는 값"이 들어 있지 않은지 검사
// 실행: npm run check:secrets   (배포 직전에 꼭 한 번 실행하세요)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'tools', 'supabase']);   // 배포되지 않는 폴더
const SKIP_FILES = new Set(['package-lock.json']);
const TEXT = /\.(js|mjs|html|css|json|webmanifest|md|txt|toml|env)$|^_headers$|^\.env/i;

function b64urlJson(part) {
  try { return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch { return null; }
}

const problems = [];
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(n)) walk(p); }
    else if (!SKIP_FILES.has(n) && (TEXT.test(n) || n.startsWith('.env'))) files.push(p);
  }
})(ROOT);

for (const f of files) {
  const name = relative(ROOT, f);
  if (/(^|\/)\.env/.test(name)) { problems.push(`${name}: .env 파일이 배포 폴더 안에 있어요. 지우거나 폴더 밖으로 옮기세요.`); continue; }
  const src = readFileSync(f, 'utf8');
  const isVendor = name.startsWith('js/vendor/');

  // 1) 새 형식 secret 키 / PEM 개인키 / DB 접속 주소(비밀번호 포함)
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(src)) problems.push(`${name}: Supabase "secret" 키가 들어 있어요!`);
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(src)) problems.push(`${name}: 개인키(PRIVATE KEY)가 들어 있어요!`);
  if (/postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/.test(src)) problems.push(`${name}: 비밀번호가 들어간 데이터베이스 주소가 있어요!`);
  if (/AKIA[0-9A-Z]{16}/.test(src)) problems.push(`${name}: AWS 액세스 키로 보이는 값이 있어요!`);
  if (isVendor) continue;

  // 2) JWT 형태의 키: role 이 service_role 이면 즉시 실패, anon 이면 경고 없이 통과
  for (const m of src.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.([A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g)) {
    const payload = b64urlJson(m[1]);
    if (payload?.role === 'service_role') problems.push(`${name}: service_role 키(만능 열쇠)가 들어 있어요! 즉시 Supabase 에서 키를 재발급하세요.`);
    else if (payload && !['anon', 'authenticated'].includes(payload.role)) problems.push(`${name}: 알 수 없는 역할(${payload.role})의 JWT 키가 있어요. 확인해 주세요.`);
  }
  // 3) 이름이 수상한 변수에 값을 직접 넣은 경우
  const sus = src.matchAll(/\b(password|passwd|secret|private_?key|service_?role|api_?secret)\w*\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi);
  for (const m of sus) {
    if (/^(YOUR-|<|\{|\$)/i.test(m[2]) || /^(password|current-password|new-password)$/i.test(m[2])) continue;
    problems.push(`${name}: "${m[1]}" 라는 이름에 값이 직접 적혀 있어요 → ${m[2].slice(0, 6)}…`);
  }
}

// 4) config.js 가 공개 키만 쓰는지
const cfg = readFileSync(join(ROOT, 'js/config.js'), 'utf8');
const key = cfg.match(/SUPABASE_PUBLISHABLE_KEY\s*=\s*'([^']*)'/)?.[1] ?? '';
if (key.startsWith('sb_secret_')) problems.push('js/config.js: 공개용이 아닌 secret 키가 들어 있어요!');
if (key && !key.startsWith('YOUR-') && !key.startsWith('sb_publishable_') && !key.startsWith('eyJ')) problems.push('js/config.js: SUPABASE_PUBLISHABLE_KEY 형식이 이상해요. (sb_publishable_… 또는 anon 키여야 해요)');

if (problems.length) {
  console.error(`\n❌ 비밀키 점검 실패 (${problems.length}건)\n`);
  problems.forEach((p) => console.error(' - ' + p));
  process.exit(1);
}
console.log(`✅ 비밀키 점검 통과  (배포 파일 ${files.length}개 검사: secret/service_role 키, 개인키, DB 비밀번호, 하드코딩된 비밀번호 없음)`);
