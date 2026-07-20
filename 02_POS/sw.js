/* GMT PWA — عامل الخدمة | التطبيق: نقطة البيع | الإصدار: v9 (إصلاحات الفحص العميق 2026-07-12)
   ⚠️ سياسة التحديث: مع كل تسليم يلمس ملفات هذه الصفحة، أسلّمك sw.js بإصدار
   مرفوع بنفس المجلد — ارفعه معها والتحديث يصل للأجهزة تلقائياً بالفتح التالي.
   البيانات (supabase) لا تُلمس أبداً — دائماً من الشبكة. */
const CACHE = 'gmt-pos--v20260713';
const PRECACHE = ["./index-final.html", "./gmt-tour.js", "./gmt-welcome.js", "./gmt-sandbox.js", "./gmt-bugcatcher.js", "./gmt-inspector.js", "./gmt-scenarios.js", "./gmt-config.js", "./gmt-theme.css", "./logo.jpg", "./manifest.json", "./gmt-icon-192.png", "./gmt-icon-512.png", "./gmt-ui.js", "./gmt-guide.js", "./gmt-health-panel.js", "./gmt-guide-pos.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('gmt-pos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('supabase.co')) return; // البيانات دائماً حية من الشبكة

  if (url.origin === location.origin) {
    // ملفات الصفحة: من الكاش فوراً + تحديث بالخلفية (فتح فوري + طزاجة تلقائية)
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req);
      const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      return cached || (await net) || Response.error();
    }));
  } else {
    // خطوط/مكتبات CDN: كاش أولاً ثم شبكة
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req);
      if (cached) return cached;
      try { const res = await fetch(req); if (res) c.put(req, res.clone()); return res; }
      catch (_) { return Response.error(); }
    }));
  }
});
