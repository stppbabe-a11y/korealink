// build.mjs | 배포용 폴더(deploy/)를 만듭니다. 앱 실행에 꼭 필요한 파일만 복사하고,
// SQL(supabase/), 점검 도구(tools/), 설명서는 제외합니다. 만들기 전에 점검(check)을 먼저 통과해야 합니다.
// 실행: npm run build  ->  deploy 폴더 생성. (GitHub 연결 시 Cloudflare Pages 가 자동 실행: 빌드 명령 npm run build / 출력 폴더 deploy)
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'deploy');

const check = spawnSync(process.execPath, [join(ROOT, 'tools/check-all.mjs')], { stdio: 'inherit' });
if (check.status !== 0) { console.error('\n점검에 실패해서 배포 폴더를 만들지 않았어요. 위 오류를 먼저 해결하세요.'); process.exit(1); }

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const item of ['index.html', 'privacy.html', 'delete-account.html', 'manifest.webmanifest', 'sw.js', '_headers', 'vercel.json', 'css', 'js', 'icons']) {
  cpSync(join(ROOT, item), join(OUT, item), { recursive: true });
}
// Cloudflare Pages(GitHub 연결)가 빌드할 때는 "커밋 번호"를 서비스워커 버전으로 자동 사용합니다.
// → 배포할 때마다 폰에 남은 옛 파일이 자동으로 새 파일로 교체됩니다. (직접 숫자를 올릴 필요 없음)
if (process.env.CF_PAGES_COMMIT_SHA) {
  const swPath = join(OUT, 'sw.js');
  const tag = `cf-${process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)}`;
  writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*'/, `const VERSION = '${tag}'`));
  console.log(`   서비스워커 버전: ${tag}`);
}
let n = 0;
(function count(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? count(p) : n++; } })(OUT);
console.log(`\n✅ 배포 폴더 완성: ${OUT}  (파일 ${n}개)`);
{
  const left = ['privacy.html', 'delete-account.html'].filter((f) => /REPLACE_[A-Z_]+/.test(readFileSync(join(OUT, f), 'utf8')));
  if (left.length) console.log(`\n⚠️  ${left.join(', ')} 안의 REPLACE_OPERATOR_NAME / REPLACE_CONTACT_EMAIL / REPLACE_SUPABASE_REGION 을 내 정보로 바꾸세요. (구글 플레이 심사 전 필수)`);
}
console.log('   다음 단계: js/config.js 에 Supabase 주소/공개 키가 들어 있는지 확인 후, deploy 폴더를 호스팅에 올리세요.');
