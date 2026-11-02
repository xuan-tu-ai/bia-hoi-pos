// Service worker của PWA chủ quán (FR-21).
// - Trang: lấy từ mạng; mất mạng thì hiện trang "Mất kết nối" thay vì lỗi trình duyệt.
// - Tệp tĩnh đã build (/assets/ gồm cả font, icon): lấy từ bộ nhớ đệm, tải lại ngầm.
// - API và Socket.IO: không bao giờ lưu đệm, số liệu luôn là số mới.
const VERSION = 'v4';
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')));
    return;
  }

  // Font đã đóng gói trong /assets/ cùng các tệp build
  const isStatic = url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'));
  if (!isStatic) return;

  event.respondWith(
    caches.open(STATIC).then(async (cache) => {
      const cached = await caches.match(req); // tìm trong mọi bộ nhớ đệm, kể cả tệp đã lưu sẵn lúc cài
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});

// FR-20: thông báo đẩy khi có hủy/giảm lớn. Bấm vào thông báo mở Nhật ký hủy/giảm.
self.addEventListener('push', (event) => {
  let data = { title: 'Bia Hơi Quầy', body: '', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url },
      lang: 'vi',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then(() => open.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
