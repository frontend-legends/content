// Проверки к 3.09 с настоящим Service Worker в Chromium на localhost:
// состояния установки, первая загрузка без контроля, clients.claim, обновление: новая версия ждёт, перезагрузка её не включает,
// skipWaiting по сообщению и очистка старого кеша, max-age у sw.js не мешает обновлению, scope и SecurityError,
// офлайн: навигация из кеша и запасная страница, navigation preload, respondWith после await, разбор манифеста.
// Запуск: cd codes && node run.mjs 03.web/9.pwa
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const mainSw = (version) => `
const VERSION = 'v${version}';
const STATIC = 'static-' + VERSION;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(['/', '/offline.html', '/app.css'])));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== STATIC) await caches.delete(key);
    await self.registration.navigationPreload.enable();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname === '/__version') { e.respondWith(new Response(VERSION)); return; }
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        return (await e.preloadResponse) ?? (await fetch(e.request));
      } catch {
        return (await caches.match(e.request)) ?? caches.match('/offline.html');
      }
    })());
    return;
  }
  if (url.pathname === '/app.css') e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});`;
const claimSw = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { if (e.request.url.endsWith('/claim/ping')) e.respondWith(new Response('из SW')); });`;
const lateSw = `
self.errors = [];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', async (e) => {
  if (!e.request.url.endsWith('/late/data')) return;
  await caches.keys();                                                  // любой await до respondWith
  try { e.respondWith(new Response('из SW')); } catch (err) { self.errors.push(err.name + ': ' + err.message); }
});`;

const manifests = {
  good: { name: 'Магазин чая', short_name: 'Чай', start_url: '/', display: 'standalone', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] },
  foreign: { name: 'Магазин чая', start_url: 'https://other.example/', display: 'standalone' },
  scope: { name: 'Магазин чая', start_url: '/catalog/', scope: '/account/', display: 'standalone' },
  display: { name: 'Магазин чая', start_url: '/', display: 'window' },
  relative: { name: 'Магазин чая', start_url: '?source=pwa', display: 'standalone' },
};

let swVersion = 1;
let down = false;                                                      // «нет сети»: сервер рвёт соединения
const preloadHeaders = [];
const page = (title, extra = '') => `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${title}</title>${extra}</head><body><h1>${title}</h1></body></html>`;
const server = createServer((req, res) => {
  if (down) return req.socket.destroy();
  const url = new URL(req.url, 'http://x');
  const send = (type, body, headers = {}) => { res.writeHead(200, { 'content-type': type, ...headers }); res.end(body); };
  if (url.pathname === '/sw.js') return send('text/javascript', mainSw(swVersion), { 'cache-control': 'max-age=3600' });
  if (url.pathname === '/claim/sw.js') return send('text/javascript', claimSw);
  if (url.pathname === '/late/sw.js') return send('text/javascript', lateSw);
  if (url.pathname === '/scoped/sw.js') return send('text/javascript', '');
  if (url.pathname === '/broken/sw.js') return send('text/javascript', "self.addEventListener('install', (e) => e.waitUntil(caches.open('broken').then((c) => c.addAll(['/app.css', '/missing.png']))));");
  if (url.pathname === '/missing.png') { res.writeHead(404); return res.end(); }
  if (url.pathname === '/app.css') return send('text/css', 'h1 { color: green }');
  if (url.pathname === '/late/data') return send('text/plain; charset=utf-8', 'из сети');
  if (url.pathname === '/claim/ping') return send('text/plain; charset=utf-8', 'из сети');
  if (url.pathname === '/offline.html') return send('text/html; charset=utf-8', page('Нет сети'));
  const m = url.pathname.match(/^\/static\/(\w+)\.webmanifest$/);
  if (m) return send('application/manifest+json', JSON.stringify(manifests[m[1]]));
  if (url.pathname.startsWith('/manifest-test/')) return send('text/html; charset=utf-8', page('Манифест', `<link rel="manifest" href="/static/${url.pathname.split('/').pop()}.webmanifest">`));
  if (req.headers['service-worker-navigation-preload']) preloadHeaders.push(url.pathname);
  if (url.pathname === '/catalog') return send('text/html; charset=utf-8', page('Каталог'));
  send('text/html; charset=utf-8', page(`Главная, версия страницы ${swVersion}`));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const context = await browser.newContext();
  const tab = await context.newPage();
  await tab.goto(base);

  // --- регистрация: состояния и первая загрузка без контроля ---
  const first = await tab.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sw = reg.installing;
    const states = [sw.state];
    await new Promise((r) => sw.addEventListener('statechange', () => { states.push(sw.state); if (sw.state === 'activated') r(); }));
    return { states, scope: reg.scope, controlled: navigator.serviceWorker.controller !== null };
  });
  assert.deepEqual(first.states, ['installing', 'installed', 'activating', 'activated']);
  assert.equal(first.scope, `${base}/`);
  assert.equal(first.controlled, false);                               // страница, которая зарегистрировала, — без контроля
  await tab.reload();
  assert.equal(await tab.evaluate(() => navigator.serviceWorker.controller !== null), true);
  assert.equal(await tab.evaluate(() => fetch('/__version').then((r) => r.text())), 'v1');
  assert.deepEqual(preloadHeaders, ['/']);                              // навигация пришла с заголовком navigation preload

  // --- clients.claim: контроль без перезагрузки ---
  const claimTab = await context.newPage();
  await claimTab.goto(`${base}/claim/`);
  const claimed = await claimTab.evaluate(async () => {
    const changed = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
    await navigator.serviceWorker.register('/claim/sw.js');
    await changed;
    return fetch('/claim/ping').then((r) => r.text());
  });
  assert.equal(claimed, 'из SW');
  await claimTab.close();

  // --- обновление: новая версия ставится и ждёт; перезагрузка её не включает; skipWaiting по сообщению ---
  swVersion = 2;                                                        // sw.js отдаётся с max-age=3600, но проверка обновления идёт мимо HTTP-кеша
  const waiting = await tab.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg.update();
    const sw = reg.installing ?? reg.waiting;
    if (sw.state !== 'installed') await new Promise((r) => sw.addEventListener('statechange', () => sw.state === 'installed' && r()));
    return { waiting: reg.waiting !== null, active: await fetch('/__version').then((r) => r.text()) };
  });
  assert.deepEqual(waiting, { waiting: true, active: 'v1' });
  await tab.reload();
  assert.deepEqual(await tab.evaluate(async () => ({
    waiting: (await navigator.serviceWorker.getRegistration()).waiting !== null,
    active: await fetch('/__version').then((r) => r.text()),
  })), { waiting: true, active: 'v1' });                               // F5 не применяет обновление
  const updated = await tab.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const changed = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
    reg.waiting.postMessage('skipWaiting');
    await changed;
    const active = reg.active;
    if (active.state !== 'activated') await new Promise((r) => active.addEventListener('statechange', () => active.state === 'activated' && r()));
    return { active: await fetch('/__version').then((r) => r.text()), caches: await caches.keys() };
  });
  assert.deepEqual(updated, { active: 'v2', caches: ['static-v2'] });  // старый кеш удалён в activate

  // --- scope: по умолчанию папка скрипта; шире — SecurityError без заголовка Service-Worker-Allowed ---
  const scope = await tab.evaluate(async () => {
    const own = await navigator.serviceWorker.register('/scoped/sw.js');
    let wider;
    try { await navigator.serviceWorker.register('/scoped/sw.js', { scope: '/' }); } catch (e) { wider = e.name; }
    await own.unregister();
    return { scope: own.scope, wider };
  });
  assert.deepEqual(scope, { scope: `${base}/scoped/`, wider: 'SecurityError' });

  // --- addAll атомарен: один ответ 404 — установка не удалась, воркер выброшен ---
  const broken = await tab.evaluate(async () => {
    const reg = await navigator.serviceWorker.register('/broken/sw.js');
    const sw = reg.installing;
    const states = [sw.state];
    await new Promise((r) => sw.addEventListener('statechange', () => { states.push(sw.state); if (sw.state === 'redundant') r(); }));
    return { states, cached: await caches.has('broken') && (await (await caches.open('broken')).keys()).length };
  });
  assert.deepEqual(broken, { states: ['installing', 'redundant'], cached: 0 }); // и app.css в кеш не попал

  // --- офлайн: навигация из кеша, незнакомая страница — запасная ---
  down = true;
  await tab.goto(base);
  assert.equal(await tab.textContent('h1'), 'Главная, версия страницы 2'); // из кеша, положенного при установке v2
  await tab.goto(`${base}/catalog`);
  assert.equal(await tab.textContent('h1'), 'Нет сети');
  assert.equal(await tab.evaluate(() => getComputedStyle(document.querySelector('h1')).color), 'rgb(0, 0, 0)'); // запасная страница без стилей
  down = false;

  // --- respondWith после await: событие уже обработано, запрос уходит в сеть ---
  const lateTab = await context.newPage();
  await lateTab.goto(`${base}/late/`);
  const late = await lateTab.evaluate(async () => {
    const changed = new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r));
    await navigator.serviceWorker.register('/late/sw.js');
    await changed;
    return fetch('/late/data').then((r) => r.text());
  });
  assert.equal(late, 'из сети');
  const lateWorker = context.serviceWorkers().find((w) => w.url().endsWith('/late/sw.js'));
  assert.deepEqual(await lateWorker.evaluate(() => self.errors), [
    "InvalidStateError: Failed to execute 'respondWith' on 'FetchEvent': The event handler is already finished.",
  ]);
  await context.close();
} finally {
  await browser.close();
}

// --- манифест: как браузер его разбирает (то же видно в Application → Manifest) ---
{
  const b = await chromium.launch({ executablePath: findChromium() });
  try {
    const p = await b.newPage();
    const cdp = await p.context().newCDPSession(p);
    const read = async (name) => {
      await p.goto(`${base}/manifest-test/${name}`);
      const { errors, manifest: m } = await cdp.send('Page.getAppManifest');
      return { errors: errors.map((e) => e.message), id: m.id.replace(base, ''), start: m.startUrl.replace(base, ''), scope: m.scope.replace(base, ''), display: m.display };
    };
    // правильный: id по умолчанию — start_url, scope — папка start_url
    assert.deepEqual(await read('good'), { errors: [], id: '/', start: '/', scope: '/', display: 'kStandalone' });
    // start_url с другого origin игнорируется — берётся адрес страницы
    assert.deepEqual(await read('foreign'), { errors: ["property 'start_url' ignored, should be same origin as document."], id: '/manifest-test/foreign', start: '/manifest-test/foreign', scope: '/manifest-test/', display: 'kStandalone' });
    // scope, который не содержит start_url, игнорируется
    assert.deepEqual(await read('scope'), { errors: ["property 'scope' ignored. Start url should be within scope of scope URL."], id: '/catalog/', start: '/catalog/', scope: '/catalog/', display: 'kStandalone' });
    // неизвестное значение display игнорируется
    assert.deepEqual((await read('display')).errors, ["unknown 'display' value ignored."]);
    // относительный start_url разрешается от адреса манифеста, а не страницы
    assert.deepEqual(await read('relative'), { errors: [], id: '/static/relative.webmanifest?source=pwa', start: '/static/relative.webmanifest?source=pwa', scope: '/static/', display: 'kStandalone' });
  } finally {
    await b.close();
  }
}
server.close();

console.log('sw ok');
