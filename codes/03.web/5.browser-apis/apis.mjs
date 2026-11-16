// Проверки к 3.05 в Chromium на HTTP-сервере: IntersectionObserver (первый вызов сразу, rootMargin, threshold, root),
// ResizeObserver (первый вызов, размеры, ошибка цикла), MutationObserver (пакет одной микрозадачей, oldValue),
// scheduler.postTask с приоритетами, requestIdleCallback с timeout, тело fetch как поток (по частям, TransformStream,
// читается один раз, clone), BroadcastChannel и событие storage между вкладками, Permissions API.
// Запуск: cd codes && node run.mjs 03.web/5.browser-apis
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = createServer(async (req, res) => {
  if (req.url === '/orders.ndjson') {                                  // заказы приходят по одному в строке, с паузами
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    for (const id of [1, 2, 3]) { res.write(JSON.stringify({ id, tea: ['Улун', 'Пуэр', 'Сенча'][id - 1] }) + '\n'); await wait(300); }
    return res.end();
  }
  if (req.url === '/cart.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"items":2}'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><html lang="ru"><body></body></html>');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);

try {
  // --- IntersectionObserver: первый вызов сразу, rootMargin заранее, threshold по доле ---
  const io = await page.evaluate(() => new Promise((resolve) => {
    document.body.innerHTML = `<div style="height: 600px"></div>
      <img id="near" style="display:block;height:100px" alt=""><div style="height: 1000px"></div><img id="far" style="display:block;height:100px" alt="">`;
    const seen = [];
    const plain = new IntersectionObserver((entries) => { for (const e of entries) seen.push(['plain', e.target.id, e.isIntersecting]); });
    const ahead = new IntersectionObserver((entries) => { for (const e of entries) seen.push(['margin', e.target.id, e.isIntersecting]); }, { rootMargin: '200px' });
    for (const id of ['near', 'far']) { plain.observe(document.getElementById(id)); ahead.observe(document.getElementById(id)); }
    const sync = seen.length;                                            // колбэк асинхронный
    setTimeout(() => resolve({ sync, seen }), 200);
  }));
  assert.equal(io.sync, 0);
  assert.deepEqual(io.seen.filter((s) => s[0] === 'plain'), [['plain', 'near', false], ['plain', 'far', false]]); // первый вызов — текущее состояние
  assert.deepEqual(io.seen.filter((s) => s[0] === 'margin'), [['margin', 'near', true], ['margin', 'far', false]]); // за 200px до экрана — уже «видна»

  const half = await page.evaluate(() => new Promise((resolve) => {
    document.body.innerHTML = '<div id="box" style="position:absolute;top:550px;height:100px;width:100px"></div>';
    const ratios = [];
    new IntersectionObserver((entries) => { for (const e of entries) ratios.push(Math.round(e.intersectionRatio * 100) / 100); }, { threshold: [0, 0.5, 1] })
      .observe(document.getElementById('box'));
    setTimeout(() => { scrollTo(0, 0); resolve(ratios); }, 200);
  }));
  assert.deepEqual(half, [0.5]);                                         // видна наполовину: 50 из 100 пикселей

  // --- ResizeObserver: первый вызов с размером, затем на каждое изменение ---
  const ro = await page.evaluate(() => new Promise((resolve) => {
    document.body.innerHTML = '<div id="chart" style="width:300px;height:100px;padding:10px;border:2px solid;box-sizing:content-box"></div>';
    const sizes = [];
    const el = document.getElementById('chart');
    new ResizeObserver((entries) => { for (const e of entries) sizes.push([e.contentRect.width, e.borderBoxSize[0].inlineSize]); }).observe(el);
    setTimeout(() => { el.style.width = '500px'; setTimeout(() => resolve(sizes), 100); }, 100);
  }));
  assert.deepEqual(ro, [[300, 324], [500, 524]]);                       // содержимое и бокс с padding и border

  // --- MutationObserver: изменения копятся и приходят одной микрозадачей, раньше таймера ---
  const mo = await page.evaluate(() => new Promise((resolve) => {
    document.body.innerHTML = '<ul id="cart" data-count="0"></ul>';
    const log = [];
    const cart = document.getElementById('cart');
    new MutationObserver((records) => log.push(`мутации: ${records.length}, старое data-count: ${records.find((r) => r.type === 'attributes')?.oldValue}`))
      .observe(cart, { childList: true, attributes: true, attributeOldValue: true });
    cart.append(document.createElement('li'));
    cart.append(document.createElement('li'));
    cart.dataset.count = '2';
    log.push('конец скрипта');
    setTimeout(() => { log.push('таймер'); resolve(log); }, 0);
  }));
  assert.deepEqual(mo, ['конец скрипта', 'мутации: 3, старое data-count: 0', 'таймер']);

  // --- scheduler.postTask: приоритет важнее порядка постановки; requestIdleCallback с timeout ---
  const sched = await page.evaluate(async () => {
    const log = [];
    const tasks = [
      scheduler.postTask(() => log.push('background'), { priority: 'background' }),
      scheduler.postTask(() => log.push('user-visible'), { priority: 'user-visible' }),
      scheduler.postTask(() => log.push('user-blocking'), { priority: 'user-blocking' }),
    ];
    await Promise.all(tasks);
    const idle = await new Promise((r) => requestIdleCallback((d) => r({ didTimeout: d.didTimeout, hasTime: typeof d.timeRemaining() === 'number' }), { timeout: 1000 }));
    return { log, idle };
  });
  assert.deepEqual(sched.log, ['user-blocking', 'user-visible', 'background']);
  assert.equal(sched.idle.hasTime, true);

  // --- тело fetch — поток: читается по частям, пока сервер ещё отвечает ---
  const stream = await page.evaluate(async () => {
    const start = performance.now();
    const res = await fetch('/orders.ndjson');
    const lines = res.body.pipeThrough(new TextDecoderStream()).pipeThrough(new TransformStream({
      start() { this.buf = ''; },
      transform(chunk, ctrl) { this.buf += chunk; const parts = this.buf.split('\n'); this.buf = parts.pop(); for (const p of parts) if (p) ctrl.enqueue(JSON.parse(p)); },
      flush(ctrl) { if (this.buf) ctrl.enqueue(JSON.parse(this.buf)); },
    }));
    const got = [];
    for await (const order of lines) got.push([order.tea, Math.round(performance.now() - start)]);
    return got;
  });
  assert.deepEqual(stream.map((g) => g[0]), ['Улун', 'Пуэр', 'Сенча']);
  assert.ok(stream[0][1] < 250 && stream[2][1] >= 550, JSON.stringify(stream)); // первый заказ — до конца ответа

  // тело читается один раз; clone() — до чтения
  const once = await page.evaluate(async () => {
    const res = await fetch('/cart.json');
    const copy = res.clone();
    const a = await res.json();
    let second;
    try { await res.json(); } catch (e) { second = e.name; }
    return { a: a.items, second, used: res.bodyUsed, copy: (await copy.json()).items };
  });
  assert.deepEqual(once, { a: 2, second: 'TypeError', used: true, copy: 2 });

  // --- общение вкладок одного origin: BroadcastChannel и событие storage ---
  const other = await context.newPage();
  await other.goto(base);
  await other.evaluate(() => {
    window.__got = [];
    new BroadcastChannel('cart').onmessage = (e) => window.__got.push(['channel', e.data.type]);
    addEventListener('storage', (e) => window.__got.push(['storage', e.key, e.newValue]));
  });
  const self = await page.evaluate(() => {
    const got = [];
    const ch = new BroadcastChannel('cart');
    ch.onmessage = (e) => got.push(['channel-self', e.data.type]);       // своё сообщение отправителю не приходит
    addEventListener('storage', () => got.push(['storage-self']));        // и своё изменение storage тоже
    ch.postMessage({ type: 'item-added' });
    localStorage.setItem('cart-count', '3');
    return new Promise((r) => setTimeout(() => r(got), 200));
  });
  await other.waitForFunction(() => window.__got.length === 2);
  assert.deepEqual(self, []);
  assert.deepEqual(await other.evaluate(() => window.__got), [['channel', 'item-added'], ['storage', 'cart-count', '3']]);
  await other.close();

  // --- Permissions API: состояние разрешения без запроса ---
  const before = await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state);
  await context.grantPermissions(['geolocation'], { origin: base });
  const after = await page.evaluate(async () => (await navigator.permissions.query({ name: 'geolocation' })).state);
  assert.deepEqual([before, after], ['prompt', 'granted']);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}

// --- ResizeObserver, меняющий размер в своём колбэке, получает ошибку цикла ---
{
  const b = await chromium.launch({ executablePath: findChromium() });
  const p = await b.newPage();
  const reported = [];
  p.on('pageerror', (e) => reported.push(e.message));
  await p.goto(base);
  const onError = await p.evaluate(() => new Promise((resolve) => {
    const messages = [];
    addEventListener('error', (e) => messages.push(e.message));        // ошибка приходит событием error на window
    document.body.innerHTML = '<div id="box" style="width:100px"></div>';
    const box = document.getElementById('box');
    new ResizeObserver(() => { box.style.width = box.offsetWidth + 10 + 'px'; }).observe(box);
    setTimeout(() => resolve(messages), 300);
  }));
  await b.close();
  assert.ok(onError.some((m) => /ResizeObserver loop completed with undelivered notifications/.test(m)), JSON.stringify(onError));
}
server.close();

console.log('apis ok');
