// Проверки к 5.02 в Chromium на настоящем HTTP-сервере, который отдаёт HTML частями:
// неявные узлы и текстовые узлы из переносов строк, типы узлов, отрисовка до конца HTML,
// стиль в head против стиля в body, сканер предзагрузки (картинка ниже синхронного скрипта
// качается сразу, созданная скриптом — нет), readyState и события, стиль перед скриптом задерживает DOMContentLoaded.
// Запуск: cd codes && node run.mjs 05.html/2.structure
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { PNG } from 'pngjs';
import { withPage } from '../../_lib/browser.mjs';

const img = (() => { const p = new PNG({ width: 4, height: 4 }); p.data.fill(200); return PNG.sync.write(p); })();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const delay = Number(url.searchParams.get('d') ?? 0);
  if (url.pathname.endsWith('.css')) { await wait(delay); res.writeHead(200, { 'content-type': 'text/css' }); return res.end('main { color: rgb(0, 0, 0); }'); }
  if (url.pathname.endsWith('.js')) { await wait(delay); res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end('window.__slow = performance.now();'); }
  if (url.pathname.endsWith('.png')) { await wait(delay); res.writeHead(200, { 'content-type': 'image/png' }); return res.end(img); }
  const parts = pages.get(url.pathname);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  for (const part of parts) {                                   // строки — куски HTML, числа — паузы
    if (typeof part === 'number') await wait(part); else res.write(part);
  }
  res.end();
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const head = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Каталог</title>';

const timings = async (page) => { const t = await page.evaluate(async () => {
  const nav = performance.getEntriesByType('navigation')[0];
  // первая отрисовка может случиться чуть позже события load — ждём её запись
  const fcp = await new Promise((r) => new PerformanceObserver((l) => r(l.getEntries()[0])).observe({ type: 'paint', buffered: true }));
  const res = Object.fromEntries(performance.getEntriesByType('resource').map((r) => [new URL(r.name).pathname, Math.round(r.startTime)]));
  return { fcp: fcp && Math.round(fcp.startTime), dcl: Math.round(nav.domContentLoadedEventStart), load: Math.round(nav.loadEventStart), res };
}); return t; };

try {
  await withPage(async (page) => {
    // --- узлы: переносы строк между тегами — текстовые узлы ---
    await page.setContent(`<!doctype html><ul id="cart">
  <li>Улун</li>
  <!-- акция -->
  <li>Пуэр</li>
</ul>`);
    const nodes = await page.$eval('#cart', (ul) => ({
      childNodes: [...ul.childNodes].map((n) => n.nodeType),
      children: ul.children.length,
      first: ul.firstChild.nodeName,
      firstEl: ul.firstElementChild.textContent,
      docTypes: [document.nodeType, document.doctype.nodeType, document.documentElement.nodeType],
    }));
    assert.deepEqual(nodes.childNodes, [3, 1, 3, 8, 3, 1, 3]);   // текст, li, текст, комментарий, текст, li, текст
    assert.equal(nodes.children, 2);
    assert.equal(nodes.first, '#text');
    assert.equal(nodes.firstEl, 'Улун');
    assert.deepEqual(nodes.docTypes, [9, 10, 1]);

    // --- потоковая отрисовка: шапка видна до того, как пришёл остальной HTML ---
    pages.set('/stream', [`${head}</head><body><header>Магазин чая</header>`, 900, '<main>Каталог</main></body></html>']);
    await page.goto(`${base}/stream`);
    const stream = await timings(page);
    assert.ok(stream.fcp < 600, `первая отрисовка ${stream.fcp} мс`);   // нарисовано, пока сервер ещё «думал»
    assert.ok(stream.dcl >= 850);                                       // а документ разобран только после конца HTML

    // --- стиль в head задерживает первую отрисовку целиком, в body — только то, что ниже ---
    pages.set('/css-head', [`${head}<link rel="stylesheet" href="/slow.css?d=900"></head><body><header>Магазин чая</header><main>Каталог</main></body></html>`]);
    await page.goto(`${base}/css-head`);
    assert.ok((await timings(page)).fcp >= 850);
    pages.set('/css-body', [`${head}</head><body><header>Магазин чая</header><link rel="stylesheet" href="/slow.css?d=900"><main>Каталог</main></body></html>`]);
    await page.goto(`${base}/css-body`);
    const cssBody = await timings(page);
    assert.ok(cssBody.fcp < 600, `первая отрисовка ${cssBody.fcp} мс`);         // шапка выше стиля нарисована сразу
    assert.ok(cssBody.dcl >= 850);                                                // а разбор того, что ниже, Chromium приостановил до загрузки стиля

    // --- сканер предзагрузки: пока синхронный скрипт держит разбор, картинка ниже уже качается ---
    pages.set('/scanner', [`${head}</head><body><header>Магазин чая</header>
      <script src="/slow.js?d=900"></script>
      <img src="/below.png" alt="">
      <script>const i = new Image(); i.src = '/by-script.png'; document.body.append(i);</script>
      </body></html>`]);
    await page.goto(`${base}/scanner`);
    const scan = await timings(page);
    assert.ok(scan.res['/below.png'] < 300, `картинка из разметки запрошена на ${scan.res['/below.png']} мс`);
    assert.ok(scan.res['/by-script.png'] >= 850, `картинка из скрипта запрошена на ${scan.res['/by-script.png']} мс`);

    // --- жизненный цикл: readyState и события; картинки задерживают load, но не DOMContentLoaded ---
    pages.set('/life', [`${head}<script>
        window.__log = [document.readyState];
        document.addEventListener('readystatechange', () => __log.push(document.readyState));
        document.addEventListener('DOMContentLoaded', () => __log.push('DOMContentLoaded'));
        addEventListener('load', () => __log.push('load'));
      </script><script defer src="/slow.js?d=0"></script></head><body>
      <script>__log.push('inline')</script>
      <script type="module">__log.push('module')</script>
      <img src="/slow.png?d=900" alt=""></body></html>`]);
    await page.goto(`${base}/life`, { waitUntil: 'load' });
    const life = await page.evaluate(() => window.__log);
    assert.deepEqual(life, ['loading', 'inline', 'interactive', 'module', 'DOMContentLoaded', 'complete', 'load']);
    const lt = await timings(page);
    assert.ok(lt.dcl < 600 && lt.load >= 850);

    // --- стиль перед синхронным скриптом задерживает DOMContentLoaded: скрипт ждёт CSSOM ---
    pages.set('/css-script', [`${head}<link rel="stylesheet" href="/slow.css?d=900"><script>window.__x = 1</script></head><body>Каталог</body></html>`]);
    await page.goto(`${base}/css-script`);
    assert.ok((await timings(page)).dcl >= 850);
    pages.set('/css-noscript', [`${head}<link rel="stylesheet" href="/slow.css?d=900"></head><body>Каталог</body></html>`]);
    await page.goto(`${base}/css-noscript`, { waitUntil: 'domcontentloaded' });
    assert.ok((await timings(page)).dcl < 600);                       // без скрипта после стиля — не ждёт
  });
} finally {
  server.close();
}

console.log('document ok');
