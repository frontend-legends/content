// Проверки к 5.03 в Chromium на HTTP-сервере: что закрывает head раньше времени, color-scheme в meta,
// стиль с непопадающим media не держит отрисовку, семантика script (defer у встроенного скрипта игнорируется,
// async у встроенного модуля работает, модуль выполняется один раз, currentScript в модуле — null,
// вставленные из JavaScript скрипты асинхронны, import map до модулей), base и якоря,
// noscript без JavaScript, CSP в meta действует только ниже и не знает frame-ancestors.
// Запуск: cd codes && node run.mjs 05.html/3.head-content
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = new Map();
const hits = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  hits.set(url.pathname, (hits.get(url.pathname) ?? 0) + 1);
  const delay = Number(url.searchParams.get('d') ?? 0);
  if (url.pathname.endsWith('.css')) { await wait(delay); res.writeHead(200, { 'content-type': 'text/css' }); return res.end('body { color: rgb(0, 0, 0); }'); }
  if (url.pathname.endsWith('.js')) {
    await wait(delay);
    res.writeHead(200, { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' });
    const name = url.searchParams.get('n') ?? url.pathname;
    if (url.pathname === '/price.js') return res.end('export const format = (n) => n.toLocaleString("ru-RU") + " ₽";');
    return res.end(`(window.__order ??= []).push(${JSON.stringify(name)}); window.__runs = (window.__runs ?? 0) + 1;`);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pages.get(url.pathname) ?? '');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
const open = async (path, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 }, ...opts });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(`${base}${path}`, { waitUntil: 'load' });
  return { page, logs, close: () => ctx.close() };
};

try {
  // --- элемент или текст, которым не место в head, закрывают его: дальше всё попадает в body ---
  pages.set('/early-body', `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Улун</title>
    <img src="/pixel.gif" alt="">
    <meta name="description" content="Улун с молочным вкусом"><link rel="canonical" href="https://shop.example/tea/oolong">
    </head><body><h1>Улун</h1></body></html>`);
  let p = await open('/early-body');
  const where = await p.page.evaluate(() => ({
    img: document.querySelector('img').parentElement.tagName,
    description: document.querySelector('meta[name=description]').parentElement.tagName,
    canonical: document.querySelector('link[rel=canonical]').parentElement.tagName,
    head: [...document.head.children].map((e) => e.tagName),
  }));
  assert.deepEqual(where, { img: 'BODY', description: 'BODY', canonical: 'BODY', head: ['META', 'TITLE'] });
  await p.close();

  // noscript с img в head: с JavaScript его содержимое — текст, без JavaScript img закрывает head
  pages.set('/noscript-head', `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Улун</title>
    <noscript><img src="/watch.gif" alt=""></noscript>
    <link rel="canonical" href="https://shop.example/tea/oolong">
    </head><body><h1>Улун</h1></body></html>`);
  for (const [js, parent] of [[true, 'HEAD'], [false, 'BODY']]) {
    const q = await open('/noscript-head', { javaScriptEnabled: js });
    const got = await q.page.$eval('link[rel=canonical]', (l) => l.parentElement.tagName);
    assert.equal(got, parent, `JavaScript ${js ? 'включён' : 'выключен'}`);
    await q.close();
  }

  // --- meta color-scheme: тёмная тема страницы без единой строки CSS ---
  pages.set('/scheme', '<!doctype html><html><head><meta name="color-scheme" content="light dark"></head><body>Каталог</body></html>');
  p = await open('/scheme', { colorScheme: 'dark' });
  assert.equal(await p.page.evaluate(() => getComputedStyle(document.body).color), 'rgb(255, 255, 255)'); // текст браузер сделал светлым
  await p.close();

  // --- стиль с непопадающим media скачивается, но не держит первую отрисовку ---
  const fcp = async (media) => {
    pages.set('/media', `<!doctype html><html><head><link rel="stylesheet" href="/print.css?d=900" ${media}></head><body><h1>Каталог</h1></body></html>`);
    hits.delete('/print.css');
    const q = await open('/media');
    const t = await q.page.evaluate(() => new Promise((r) => new PerformanceObserver((l) => r(Math.round(l.getEntries()[0].startTime))).observe({ type: 'paint', buffered: true })));
    await q.close();
    return { t, fetched: hits.get('/print.css') ?? 0 };
  };
  const all = await fcp('');
  const print = await fcp('media="print"');
  assert.ok(all.t >= 850, `обычный стиль: ${all.t} мс`);
  assert.ok(print.t < 600, `печатный стиль: ${print.t} мс`);
  assert.equal(print.fetched, 1);                                         // при этом файл всё равно скачан

  // --- script: defer у встроенного игнорируется, async у встроенного модуля работает ---
  pages.set('/scripts', `<!doctype html><html><head><script>window.__log = []</script></head><body>
    <script defer>__log.push('inline-defer')</script>
    <script>__log.push('inline')</script>
    <script defer src="/a.js?n=external-defer"></script>
    <script type="module">__log.push('module')</script>
    <script type="module" async>__log.push('module-async')</script>
    <script src="/blocker.js?n=blocker&d=300"></script>
    <script>__log.push('end-of-body')</script>
    </body></html>`);
  p = await open('/scripts');
  const order = await p.page.evaluate(() => [...window.__log, ...(window.__order ?? [])]);
  // встроенный defer выполнился сразу; async-модуль — пока разбор стоял на медленном скрипте; обычный модуль — после разбора
  assert.deepEqual(order.slice(0, 2), ['inline-defer', 'inline']);
  assert.ok(order.indexOf('module-async') < order.indexOf('end-of-body'));
  assert.ok(order.indexOf('module') > order.indexOf('end-of-body'));
  await p.close();

  // модуль с тем же адресом выполняется один раз, классический скрипт — дважды; currentScript в модуле — null
  pages.set('/once', `<!doctype html><html><body>
    <script src="/twice.js"></script><script src="/twice.js"></script>
    <script type="module" src="/mod.js"></script><script type="module" src="/mod.js"></script>
    <script>window.__classic = document.currentScript?.tagName</script>
    <script type="module">window.__module = document.currentScript</script>
    </body></html>`);
  p = await open('/once');
  const once = await p.page.evaluate(() => ({ order: window.__order, classic: window.__classic, module: window.__module }));
  assert.deepEqual(once, { order: ['/twice.js', '/twice.js', '/mod.js'], classic: 'SCRIPT', module: null });
  await p.close();

  // вставленные из JavaScript скрипты асинхронны: выполняются по мере загрузки; async = false возвращает порядок
  const dynamic = async (ordered) => {
    pages.set('/dynamic', `<!doctype html><html><body><script>
      for (const [n, d] of [['slow', 600], ['fast', 0]]) {
        const s = document.createElement('script');
        s.src = '/dyn.js?n=' + n + '&d=' + d;
        ${ordered ? 's.async = false;' : ''}
        document.body.append(s);
      }</script></body></html>`);
    const q = await open('/dynamic');
    await q.page.waitForFunction(() => window.__order?.length === 2);
    const o = await q.page.evaluate(() => window.__order);
    await q.close();
    return o;
  };
  assert.deepEqual(await dynamic(false), ['fast', 'slow']);
  assert.deepEqual(await dynamic(true), ['slow', 'fast']);

  // import map — до первого модуля; после модуля карта уже не действует
  const importmap = async (mapFirst) => {
    const map = `<script type="importmap">{ "imports": { "price": "/price.js" } }</script>`;
    const mod = `<script type="module">import { format } from 'price'; document.title = format(1990);</script>`;
    pages.set('/importmap', `<!doctype html><html><head>${mapFirst ? map + mod : mod + map}</head><body></body></html>`);
    const q = await open('/importmap');
    await q.page.waitForTimeout(300);
    const r = { title: (await q.page.title()).replace(/\s/g, ' '), errors: q.logs.filter((l) => /price|import map|specifier/i.test(l)).length > 0 };
    await q.close();
    return r;
  };
  assert.deepEqual(await importmap(true), { title: '1 990 ₽', errors: false });
  const late = await importmap(false);
  assert.equal(late.title, '');
  assert.equal(late.errors, true);

  // --- base меняет и адреса якорей ---
  pages.set('/base', `<!doctype html><html><head><base href="https://cdn.shop.example/static/"></head><body>
    <a id="rev" href="#reviews">Отзывы</a><a id="img" href="tea.png">фото</a><img id="pic" src="tea.png" alt=""></body></html>`);
  p = await open('/base');
  const urls = await p.page.evaluate(() => ({ rev: document.getElementById('rev').href, img: document.getElementById('img').href }));
  assert.deepEqual(urls, { rev: 'https://cdn.shop.example/static/#reviews', img: 'https://cdn.shop.example/static/tea.png' });
  await p.close();

  // --- noscript показывается только без JavaScript ---
  pages.set('/noscript', '<!doctype html><html><body><noscript><p id="ns">Включите JavaScript</p></noscript></body></html>');
  p = await open('/noscript');
  assert.equal(await p.page.$('#ns'), null);                              // с JavaScript содержимое — просто текст
  await p.close();
  p = await open('/noscript', { javaScriptEnabled: false });
  assert.equal(await p.page.locator('#ns').textContent(), 'Включите JavaScript');
  await p.close();

  // --- CSP в meta: действует только на то, что ниже, и не поддерживает frame-ancestors ---
  pages.set('/csp', `<!doctype html><html><head>
    <script>window.__before = true</script>
    <meta http-equiv="Content-Security-Policy" content="script-src 'self'; frame-ancestors 'none'">
    <script>window.__after = true</script>
    </head><body></body></html>`);
  p = await open('/csp');
  const csp = await p.page.evaluate(() => ({ before: window.__before === true, after: window.__after === true }));
  assert.deepEqual(csp, { before: true, after: false });
  assert.ok(p.logs.some((l) => /frame-ancestors.*ignored when delivered via a <meta> element/.test(l)));
  await p.close();
} finally {
  await browser.close();
  server.close();
}

console.log('head ok');
