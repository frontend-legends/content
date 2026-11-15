// Проверки к 13.14 в Chromium: «Script error.» у скриптов с другого домена и crossorigin, глобальные обработчики,
// отправка через sendBeacon при закрытии страницы, сбор CLS библиотекой web-vitals, очистка личных данных.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codesDir } from '../../_lib/project.mjs';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

// здесь ошибки на страницах — намеренные, поэтому не withPage (он падает на любой ошибке страницы)
async function withPage(fn) {
  const browser = await chromium.launch({ executablePath: findChromium() });
  try { return await fn(await browser.newPage()); } finally { await browser.close(); }
}

// exports пакета не открывает dist напрямую — читаем файл по пути
const webVitals = readFileSync(join(codesDir, 'node_modules/web-vitals/dist/web-vitals.iife.js'), 'utf8');
const listen = (handler) => new Promise((resolve) => { const s = createServer(handler).listen(0, () => resolve(s)); });

// CDN на другом порту — другой источник; отдаёт скрипт с ошибкой, с CORS-заголовком или без
const cdn = await listen((req, res) => {
  res.setHeader('content-type', 'text/javascript');
  if (req.url.startsWith('/cors/')) res.setHeader('access-control-allow-origin', '*');
  res.end("function checkout() { throw new TypeError('price is not a number'); }\ncheckout();\n");
});
const beacons = [];
const site = await listen((req, res) => {
  if (req.method === 'POST' && req.url === '/rum') {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => { beacons.push(JSON.parse(body)); res.end(); });
    return;
  }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  const cdnUrl = `http://127.0.0.1:${cdn.address().port}`;
  const pages = {
    '/plain': `<script>window.errors = []; onerror = (msg, src, line) => { errors.push({ msg, src, line }); };</script><script src="${cdnUrl}/plain/app.js"></script>`,
    '/cors': `<script>window.errors = []; onerror = (msg, src, line) => { errors.push({ msg, src, line }); };</script><script crossorigin="anonymous" src="${cdnUrl}/cors/app.js"></script>`,
    '/cors-missing': `<script>window.errors = []; window.ran = false; onerror = (msg) => { errors.push(msg); };</script><script crossorigin="anonymous" src="${cdnUrl}/plain/app.js" onerror="window.blocked = true"></script>`,
    '/handlers': `<script>
      window.caught = [];
      addEventListener('error', (e) => caught.push('error: ' + e.message));
      addEventListener('unhandledrejection', (e) => caught.push('rejection: ' + e.reason.message));
      setTimeout(() => { null.price; }, 0);
      Promise.reject(new Error('API оплаты ответил 502'));
      fetch('/missing').catch(() => {}); // обработанная ошибка — не должна попасть
    </script>`,
    '/beacon': `<script>
      addEventListener('pagehide', () => navigator.sendBeacon('/rum', JSON.stringify({ type: 'pagehide', path: location.pathname })));
    </script><p>каталог</p>`,
    '/cls': `<script>${webVitals}</script><script>
      window.metrics = [];
      webVitals.onCLS((m) => metrics.push({ name: m.name, value: m.value, rating: m.rating }), { reportAllChanges: true });
    </script>
    <h1>Пуэр</h1><p id="text">Описание товара</p>
    <script>setTimeout(() => { const ad = document.createElement('div'); ad.style.height = '300px'; ad.textContent = 'баннер'; document.body.insertBefore(ad, document.querySelector('h1')); }, 300);</script>`,
  };
  res.end('<!doctype html><meta charset="utf-8">' + (pages[req.url] ?? ''));
});
const base = `http://localhost:${site.address().port}`;

await withPage(async (page) => {
  // --- скрипт с другого источника без CORS: подробности ошибки скрыты ---
  await page.goto(`${base}/plain`);
  const plain = await page.evaluate(() => errors);
  assert.deepEqual(plain, [{ msg: 'Script error.', src: '', line: 0 }]);

  // --- с crossorigin и Access-Control-Allow-Origin: полное сообщение, файл и строка ---
  await page.goto(`${base}/cors`);
  const cors = await page.evaluate(() => errors);
  assert.equal(cors.length, 1);
  assert.equal(cors[0].msg, 'Uncaught TypeError: price is not a number');
  assert.match(cors[0].src, /\/cors\/app\.js$/);
  assert.equal(cors[0].line, 1);

  // crossorigin без CORS-заголовка: скрипт не загружается вовсе
  await page.goto(`${base}/cors-missing`);
  assert.deepEqual(await page.evaluate(() => [window.blocked, errors]), [true, []]);

  // --- глобальные обработчики: синхронные ошибки и необработанные промисы — разные события ---
  await page.goto(`${base}/handlers`);
  await page.waitForTimeout(100);
  const caught = (await page.evaluate(() => caught)).sort();
  assert.deepEqual(caught, ["error: Uncaught TypeError: Cannot read properties of null (reading 'price')", 'rejection: API оплаты ответил 502']);

  // --- CLS: баннер сдвинул содержимое, web-vitals это посчитал ---
  await page.goto(`${base}/cls`);
  await page.waitForTimeout(700);
  const metrics = await page.evaluate(() => metrics);
  assert.ok(metrics.length >= 1);
  assert.equal(metrics.at(-1).name, 'CLS');
  assert.ok(metrics.at(-1).value > 0.1, String(metrics.at(-1).value));
  assert.notEqual(metrics.at(-1).rating, 'good');
});

// --- sendBeacon при уходе со страницы: запрос доходит, хотя страница уже закрыта ---
await withPage(async (page) => {
  await page.goto(`${base}/beacon`);
  await page.goto('about:blank'); // уход со страницы → pagehide
});
await new Promise((r) => setTimeout(r, 200));
assert.deepEqual(beacons, [{ type: 'pagehide', path: '/beacon' }]);

// --- очистка личных данных перед отправкой: то, что делают в beforeSend ---
const scrub = (event) => JSON.parse(JSON.stringify(event)
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
  .replace(/\b(?:\d[ -]?){13,19}\b/g, '[card]'));
assert.deepEqual(
  scrub({ message: 'Не удалось оплатить: anya@shop.example, карта 4111 1111 1111 1111', url: '/checkout?email=anya@shop.example' }),
  { message: 'Не удалось оплатить: [email], карта [card]', url: '/checkout?email=[email]' },
);

cdn.close(); site.close();
console.log('monitoring ok');
