// check-all.mjs | 위 점검 3개를 한 번에 실행 (npm run check)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
let failed = false;
for (const f of ['check-code.mjs', 'check-i18n.mjs', 'check-secrets.mjs']) {
  const r = spawnSync(process.execPath, [join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
