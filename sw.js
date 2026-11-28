// sw.js | 서비스 워커: 앱 파일(화면 코드/디자인/아이콘)만 폰에 저장해 두고 빠르게 엽니다.
//   - 로그인 정보, 글, 채팅 등 "데이터"는 절대 저장하지 않습니다. (다른 주소 = Supabase 요청은 가로채지 않음)
//   - 앱을 수정해서 다시 배포할 때는 아래 VERSION 숫자만 올리면 사용자 폰의 옛 파일이 새 파일로 교체됩니다.
const VERSION = 'v27';
const CACHE = `korealink-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', 'index.html', 'manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;   // 같은 사이트의 파일만 처리

  // 화면(HTML)은 "인터넷 먼저, 안 되면 저장본" -> 항상 최신 버전, 오프라인이어도 열림
  if (req.mode === 'navigate') {
    if (url.pathname !== '/' && url.pathname !== '/index.html') return;   // 개인정보처리방침 등 별도 정적 페이지는 서비스워커가 건드리지 않음
    event.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html')));
    return;
  }
  // 코드/디자인/아이콘도 "인터넷 먼저, 안 되면 저장본" -> 새로 배포하면 바로 새 버전이 보이고, 오프라인에서도 열림
  event.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});
