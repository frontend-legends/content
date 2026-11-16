// Проверки к 4.07 в Chromium: fetch выполняется на 404 и 500 и отклоняется на сетевой ошибке и отмене;
// json() на HTML-странице ошибки; Content-Type, который fetch ставит сам для строки, URLSearchParams,
// FormData (с boundary) и Blob, и поломка при ручном multipart без boundary; redirect: follow, manual,
// error; прогресс скачивания по Content-Length врёт при сжатии; у XHR есть прогресс выгрузки;
// sendBeacon и keepalive с лимитом 64 КБ.
// Запуск: cd codes && node run.mjs 04.network-api/7.fetching
import assert from 'node:assert/strict';
import http from 'node:http';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const received = [];
const big = JSON.stringify(Array.from({ length: 4000 }, (_, i) => ({ id: i, title: `Чай ${i}`, price: 300 + (i % 50) })));
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let size = 0;
  const chunks = [];
  for await (const c of req) { size += c.length; chunks.push(c); }
  received.push({ path: url.pathname, method: req.method, ct: req.headers['content-type'], size, body: Buffer.concat(chunks) });
  if (url.pathname === '/missing') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"title":"Нет такого товара"}'); }
  if (url.pathname === '/crash') { res.writeHead(502, { 'content-type': 'text/html' }); return res.end('<!doctype html><h1>502 Bad Gateway</h1>'); }
  if (url.pathname === '/old') { res.writeHead(302, { location: '/new' }); return res.end(); }
  if (url.pathname === '/gz') {
    const gz = zlib.gzipSync(big);
    res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': gz.length });
    return res.end(gz);
  }
  if (url.pathname === '/slow') { setTimeout(() => res.end('ok'), 1000); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(url.pathname === '/' ? '<!doctype html><title>shop</title>' : 'ok');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);

  // --- что выполняется, а что отклоняется ---
  const outcomes = await page.evaluate(async (deadPort) => {
    const run = (p) => p.then((r) => `ok ${r.status} ${r.ok}`, (e) => `${e.name}: ${e.message}`);
    const controller = new AbortController();
    const aborted = run(fetch('/slow', { signal: controller.signal }));
    controller.abort();
    return {
      notFound: await run(fetch('/missing')),
      badGateway: await run(fetch('/crash')),
      refused: await run(fetch(`http://127.0.0.1:${deadPort}/`)),
      aborted: await aborted,
      jsonOnHtml: await fetch('/crash').then((r) => r.json()).then(() => 'ok', (e) => `${e.name}: ${e.message}`),
    };
  }, 1);
  assert.deepEqual(outcomes, {
    notFound: 'ok 404 false',
    badGateway: 'ok 502 false',
    refused: 'TypeError: Failed to fetch',
    aborted: 'AbortError: signal is aborted without reason',
    jsonOnHtml: `SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON`,
  });

  // --- тела запросов и Content-Type ---
  received.length = 0;
  await page.evaluate(async () => {
    await fetch('/body/string', { method: 'POST', body: '{"qty":2}' });
    await fetch('/body/json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ qty: 2 }) });
    await fetch('/body/params', { method: 'POST', body: new URLSearchParams({ q: 'улун', page: '2' }) });
    const form = new FormData();
    form.append('title', 'Улун');
    form.append('photo', new Blob(['png'], { type: 'image/png' }), 'tea.png');
    await fetch('/body/form', { method: 'POST', body: form });
    await fetch('/body/form-manual', { method: 'POST', headers: { 'content-type': 'multipart/form-data' }, body: form });
    await fetch('/body/blob', { method: 'POST', body: new Blob(['{}'], { type: 'application/json' }) });
  });
  const ct = Object.fromEntries(received.map((r) => [r.path.split('/')[2], r.ct]));
  assert.equal(ct.string, 'text/plain;charset=UTF-8');                                            // JSON-строка ушла как текст
  assert.equal(ct.json, 'application/json');
  assert.equal(ct.params, 'application/x-www-form-urlencoded;charset=UTF-8');
  assert.match(ct.form, /^multipart\/form-data; boundary=----WebKitFormBoundary/);
  assert.equal(ct['form-manual'], 'multipart/form-data');                                         // без boundary
  assert.equal(ct.blob, 'application/json');
  // сервер не может разобрать тело без boundary
  const manual = received.find((r) => r.path === '/body/form-manual');
  await assert.rejects(new Response(manual.body, { headers: { 'content-type': manual.ct } }).formData(), TypeError);
  const auto = received.find((r) => r.path === '/body/form');
  const parsed = await new Response(auto.body, { headers: { 'content-type': auto.ct } }).formData();
assert.equal(parsed.get('title'), 'Улун');
assert.equal(parsed.get('photo').name, 'tea.png');

  // --- редиректы ---
  const redirects = await page.evaluate(async () => {
    const follow = await fetch('/old');
    const manual = await fetch('/old', { redirect: 'manual' });
    const error = await fetch('/old', { redirect: 'error' }).then(() => 'ok', (e) => e.name);
    return { follow: [follow.redirected, new URL(follow.url).pathname], manual: [manual.type, manual.status], error };
  });
  assert.deepEqual(redirects, { follow: [true, '/new'], manual: ['opaqueredirect', 0], error: 'TypeError' });

  // --- прогресс скачивания при сжатии ---
  const progress = await page.evaluate(async () => {
    const res = await fetch('/gz');
    const total = Number(res.headers.get('content-length'));
    const reader = res.body.getReader();
    let loaded = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; loaded += value.length; }
    return { total, loaded, percent: Math.round((loaded / total) * 100) };
  });
  assert.equal(progress.loaded, Buffer.byteLength(big));                                          // байты уже распакованы
  assert.ok(progress.percent > 500, `прогресс ${progress.percent}%`);                             // а длина — сжатая

  // --- прогресс выгрузки есть у XHR ---
  const upload = await page.evaluate(() => new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const events = [];
    xhr.upload.onprogress = (e) => events.push([e.loaded, e.total]);
    xhr.onload = () => resolve({ events: events.length, last: events.at(-1) });
    xhr.open('POST', '/upload');
    xhr.send(new Blob([new Uint8Array(5 * 1024 * 1024)]));
  }));
  assert.ok(upload.events >= 1);
  assert.deepEqual(upload.last, [5 * 1024 * 1024, 5 * 1024 * 1024]);

  // --- sendBeacon и keepalive ---
  received.length = 0;
  const beacon = await page.evaluate(async () => {
    const sent = navigator.sendBeacon('/analytics', JSON.stringify({ event: 'leave', page: '/catalog' }));
    const tooBig = await fetch('/analytics-big', { method: 'POST', keepalive: true, body: 'x'.repeat(70 * 1024) }).then(() => 'ok', (e) => e.name);
    const small = await fetch('/analytics-small', { method: 'POST', keepalive: true, body: 'x'.repeat(1024) }).then((r) => r.status);
    return { sent, tooBig, small };
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(beacon, { sent: true, tooBig: 'TypeError', small: 200 });
  const hit = received.find((r) => r.path === '/analytics');
  assert.deepEqual([hit.method, hit.ct], ['POST', 'text/plain;charset=UTF-8']);
  assert.ok(!received.some((r) => r.path === '/analytics-big'));                                 // слишком большой не ушёл
} finally {
  await browser.close();
  server.close();
}
console.log('fetch ok');
