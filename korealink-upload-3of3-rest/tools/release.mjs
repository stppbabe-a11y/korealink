// release.mjs | 새 버전을 만들 때마다 번호를 붙여 "되돌릴 수 있는 저장본"을 남깁니다.
//   사용법: node tools/release.mjs "이번 변경 한 줄 설명"         → 번호 +1, 점검, 빌드, zip 2개, git 기록
//           node tools/release.mjs --no-bump "기준 저장본 설명"    → 번호는 그대로 저장만
// 만들어지는 것 (모두 /home/claude/releases/ 안):
//   korealink-deploy-vNNN.zip  → Netlify 에 올리는 폴더 (되돌릴 때 이걸 다시 올리면 됨)
//   korealink-src-vNNN.zip     → 소스 전체 (코드 수정용 원본)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.RELEASE_DIR || resolve(ROOT, '..', 'releases');
const args = process.argv.slice(2);
const noBump = args.includes('--no-bump');
const note = args.filter((a) => !a.startsWith('--')).join(' ').trim() || '(설명 없음)';
const sh = (c, opts = {}) => execSync(c, { cwd: ROOT, stdio: opts.quiet ? 'pipe' : 'inherit', encoding: 'utf8' });

let n = Number(readFileSync(resolve(ROOT, 'VERSION.txt'), 'utf8').trim());
if (!noBump) n += 1;
const tag = `v${String(n).padStart(3, '0')}`;
writeFileSync(resolve(ROOT, 'VERSION.txt'), `${n}\n`);

// 서비스워커 캐시 이름도 같은 번호로 (옛 파일이 폰에 남지 않게)
const swPath = resolve(ROOT, 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*'/, `const VERSION = 'v${n}'`);
writeFileSync(swPath, sw);

const day = new Date().toISOString().slice(0, 10);
const logPath = resolve(ROOT, 'CHANGELOG.md');
if (!existsSync(logPath)) writeFileSync(logPath, '# 변경 기록 (최신이 아래)\n\n각 버전은 `releases/` 폴더에 zip 으로 남아 있어 언제든 되돌릴 수 있습니다. 되돌리는 법은 README 의 "롤백" 참고.\n\n');
appendFileSync(logPath, `- **${tag}** (${day}) ${note}\n`);

sh('npm run check');
sh('npm run build');
mkdirSync(OUT, { recursive: true });
const dep = resolve(OUT, `korealink-deploy-${tag}.zip`);
const src = resolve(OUT, `korealink-src-${tag}.zip`);
sh(`rm -f "${dep}" "${src}"`);
execSync(`zip -qr "${dep}" .`, { cwd: resolve(ROOT, 'deploy') });
sh(`zip -qr "${src}" . -x "node_modules/*" "deploy/*" ".git/*"`);

try {
  if (!existsSync(resolve(ROOT, '.git'))) sh('git init -q && git config user.email "dev@local" && git config user.name "dev"');
  sh('git add -A', { quiet: true });
  sh(`git commit -q -m "${tag}: ${note.replace(/"/g, "'")}" --allow-empty`, { quiet: true });
  sh(`git tag -f ${tag}`, { quiet: true });
} catch (e) { console.log('⚠️ git 기록은 건너뜀:', e.message.split('\n')[0]); }

console.log(`\n✅ ${tag} 저장 완료\n   ${dep}\n   ${src}`);
