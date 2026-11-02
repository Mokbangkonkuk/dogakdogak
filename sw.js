/* 도각도각 서비스 워커
   - 화면 파일(index.html, config.js)은 늘 인터넷에서 새로 받고, 끊겼을 때만 저장본을 써요 → 고친 내용이 바로 반영돼요.
   - 아이콘·글꼴·QR 라이브러리는 저장본을 먼저 써서 빨리 열려요.
   - 학습회 데이터(앱스 스크립트 서버)는 절대 저장하지 않아요. */
const VERSION = 'dogak-v5';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'logo.png', 'favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const NEVER = /(^|\.)script\.google(usercontent)?\.com$|(^|\.)googleusercontent\.com$/;
const STATIC_HOSTS = /^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (NEVER.test(url.hostname)) return;

  // 같은 사이트: 인터넷 먼저, 안 되면 저장본
  if (url.origin === self.location.origin) {
    const isPage = req.mode === 'navigate';
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(isPage ? 'index.html' : req, copy)); }
        return res;
      }).catch(() => caches.match(isPage ? 'index.html' : req, { ignoreSearch: isPage }).then(r => r || caches.match('./')))
    );
    return;
  }

  // 글꼴·라이브러리: 저장본을 먼저 보여 주고, 뒤에서 새로 받아 바꿔 둬요 (잘못 받은 게 있어도 다음엔 고쳐져요)
  if (STATIC_HOSTS.test(url.hostname)) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    })));
  }
});
