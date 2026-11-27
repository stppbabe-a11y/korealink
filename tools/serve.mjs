// serve.mjs | 내 컴퓨터에서 앱을 미리 보기 위한 간단한 서버 (외부 라이브러리 불필요)
// 실행:  npm run serve   ->  브라우저에서 http://localhost:8080 열기
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
// 배포 서버와 같은 보호 헤더 (미리보기에서도 같은 조건으로 확인하기 위함)
const HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-cache',
};
// 배포용 폴더에 들어가면 안 되는 것들은 서버가 아예 내주지 않음
const BLOCKED = /^\/(supabase|tools|node_modules|\.git|package\.json|README|SECURITY)/i;

createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep) || BLOCKED.test(path)) { res.writeHead(404, HEADERS).end('Not found'); return; }
    const s = await stat(file).catch(() => null);
    if (!s?.isFile()) { res.writeHead(404, HEADERS).end('Not found'); return; }
    res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(400, HEADERS).end('Bad request');
  }
}).listen(PORT, () => console.log(`미리보기 서버 실행 중 → http://localhost:${PORT}   (끄려면 Ctrl+C)`));
