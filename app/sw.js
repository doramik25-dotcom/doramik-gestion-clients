// Service worker : l'application fonctionne hors connexion (fichiers mis en cache à l'installation).
const CACHE = 'doramik-1795040791920';
const FILES = ["./","assets/fonts/cairo-arabic-400-normal.woff2","assets/fonts/cairo-arabic-600-normal.woff2","assets/fonts/cairo-arabic-700-normal.woff2","assets/fonts/cairo-latin-400-normal.woff2","assets/fonts/cairo-latin-600-normal.woff2","assets/fonts/cairo-latin-700-normal.woff2","assets/fonts/inter-latin-400-normal.woff2","assets/fonts/inter-latin-600-normal.woff2","assets/fonts/inter-latin-700-normal.woff2","assets/logo.png","css/app.css","engine.js","icons/icon-192.png","icons/icon-512.png","index.html","js/app.js","js/components.js","js/core.js","js/doc-import.js","js/gdrive-ui.js","js/i18n.js","js/icons.js","js/receipt.js","js/reports.js","js/views/backup.js","js/views/ca.js","js/views/calendar.js","js/views/client.js","js/views/clients.js","js/views/dashboard.js","js/views/dues.js","js/views/forms.js","js/views/history.js","js/views/honoraires.js","js/views/payments.js","js/views/reports-view.js","js/views/settings.js","manifest.webmanifest","mobile.js","start.js","vendor/sql-wasm.wasm"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('doramik-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Google : jamais mis en cache
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
