// Проверки к 17.10 в Chromium на настоящем HTTP-сервере: синхронный скрипт блокирует разбор HTML,
// defer сохраняет порядок исходника и видит весь DOM, async порядок не гарантирует; блокирующий CSS
// откладывает первую отрисовку, критический инлайн — нет. Сжатие (gzip/brotli) — настоящими node:zlib.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { withPage } from '../../_lib/browser.mjs';

const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/slow.css') return setTimeout(() => { res.setHeader('content-type', 'text/css'); res.end('h1{color:#334}'); }, 250);
  if (u.pathname.endsWith('.js')) {
    const name = u.pathname.slice(1, -3);
    const d = +(u.searchParams.get('d') || 0);
    return setTimeout(() => { res.setHeader('content-type', 'text/javascript'); res.end(`window.__log.push(${JSON.stringify(name)});`); }, d);
  }
  const inline = u.searchParams.has('inline');
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html lang=ru><head><meta charset=utf-8><script>window.__log=[]</script>
  ${inline ? '<style>h1{color:#334}</style>' : '<link rel=stylesheet href="/slow.css">'}
  <script defer src="/d1.js?d=40"></script>
  <script defer src="/d2.js?d=0"></script>
  <script async src="/a1.js?d=5"></script>
  </head><body>
  <h1>Каталог</h1>
  <p class=item>1</p><p class=item>2</p>
  <script>window.__itemsAtSync = document.querySelectorAll('.item').length; window.__lateAtSync = document.getElementById('late');</script>
  <p class=item>3</p><p id=late>поздний</p>
  <script>window.__log.push('inline-sync')</script>
  </body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const read = (page) => page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 450));
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  return { log: window.__log, itemsAtSync: window.__itemsAtSync, lateAtSync: window.__lateAtSync, fcp: Math.round(fcp.startTime) };
});

await withPage(async (page) => {
  // --- блокирующий CSS: первая отрисовка ждёт стиль; критический инлайн — нет ---
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const blocking = await read(page);
  await page.goto(`${base}/?inline`, { waitUntil: 'load' });
  const inline = await read(page);
  assert.ok(inline.fcp < 120, `инлайн-стиль: отрисовка за ${inline.fcp} мс`);
  assert.ok(blocking.fcp > inline.fcp + 150, `блокирующий CSS отодвинул FCP с ${inline.fcp} до ${blocking.fcp} мс`);

  // --- синхронный скрипт посреди body блокирует разбор: видит только то, что выше него ---
  assert.equal(inline.itemsAtSync, 2);        // две карточки до скрипта, третья ещё не разобрана
  assert.equal(inline.lateAtSync, null);      // элемента ниже скрипта ещё нет

  // --- defer: исходный порядок, несмотря на скорость загрузки; после парс-блокирующего инлайна ---
  for (const r of [blocking, inline]) {
    const defers = r.log.filter((n) => n[0] === 'd');
    assert.deepEqual(defers, ['d1', 'd2']);   // d2 грузится мгновенно, d1 — с задержкой, но порядок сохранён
    assert.ok(r.log.indexOf('inline-sync') < r.log.indexOf('d1')); // defer ждёт конца разбора
    assert.ok(r.log.includes('a1'));          // async выполнился, но его позиция порядком не задана
  }
});
server.close();

// --- сжатие: поверх минификации сервер отдаёт gzip/brotli; вес для пользователя — brotli ---
const asset = Array.from({ length: 400 }, (_, i) => `.btn-${i}{padding:8px 16px;border-radius:6px;color:#334455;background:#f0f0f0}`).join('\n');
const raw = Buffer.byteLength(asset);
const gz = gzipSync(asset).length;
const br = brotliCompressSync(asset).length;
assert.ok(gz < raw / 5, `gzip ${gz} против ${raw}`);        // повторяющийся CSS жмётся в разы
assert.ok(br < gz, `brotli ${br} жмёт сильнее gzip ${gz}`); // brotli — ощутимо сильнее
assert.ok(br < raw / 6);

// --- resource hints и приоритеты как данные: что браузер делает по подсказке ---
const hints = {
  preload: 'грузить критичный ресурс сейчас с высоким приоритетом',
  preconnect: 'заранее установить соединение (DNS + TCP + TLS)',
  'dns-prefetch': 'заранее разрешить только DNS',
  prefetch: 'загрузить ресурс для вероятной следующей навигации, низкий приоритет',
  modulepreload: 'предзагрузить ES-модуль с разбором',
};
assert.equal(Object.keys(hints).length, 5);
assert.ok(hints.preload.includes('высоким приоритетом'));

console.log('loading ok');
