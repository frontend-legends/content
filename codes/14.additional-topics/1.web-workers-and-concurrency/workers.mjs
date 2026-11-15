// Проверки к 14.01 в Chromium: главный поток против воркера, что есть в воркере, structured clone,
// передача буфера, SharedArrayBuffer и Atomics при изоляции, OffscreenCanvas, Comlink.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codesDir } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

const comlink = readFileSync(join(codesDir, 'node_modules/comlink/dist/esm/comlink.mjs'), 'utf8');
const busy = 'function busy(ms) { const end = performance.now() + ms; let x = 0; while (performance.now() < end) x++; return x; }';
const files = {
  '/busy-worker.js': `${busy}\nonmessage = (e) => postMessage(busy(e.data));`,
  '/env-worker.js': `postMessage({ document: typeof document, window: typeof window, fetch: typeof fetch, indexedDB: typeof indexedDB, OffscreenCanvas: typeof OffscreenCanvas, self: self.constructor.name });`,
  '/echo-worker.js': `onmessage = (e) => { const d = e.data; postMessage({ same: d.list === undefined ? null : d.list.length, isDate: d.when instanceof Date, isMap: d.map instanceof Map, proto: Object.getPrototypeOf(d.item).constructor.name, first: d.list[0] }); };`,
  '/size-worker.js': `onmessage = (e) => postMessage(e.data.byteLength);`,
  '/counter-worker.js': `onmessage = (e) => { const { buf, atomic, n } = e.data; const a = new Int32Array(buf); for (let i = 0; i < n; i++) atomic ? Atomics.add(a, 0, 1) : a[0]++; postMessage('done'); };`,
  '/canvas-worker.js': `onmessage = (e) => { const ctx = e.data.canvas.getContext('2d'); ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 10, 10); postMessage(ctx.constructor.name); };`,
  '/comlink.mjs': comlink,
  '/api-worker.mjs': `import * as Comlink from '/comlink.mjs';\nComlink.expose({ total: (items) => items.reduce((s, i) => s + i.price * i.qty, 0) });`,
};
const server = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.has('isolated')) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    if (files[url.pathname]) { res.setHeader('content-type', 'text/javascript'); return res.end(files[url.pathname]); }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><canvas id="c" width="10" height="10"></canvas>');
  }).listen(0, () => resolve(s));
});
const base = `http://localhost:${server.address().port}`;
const msg = (page, fn) => page.evaluate(fn);

await withPage(async (page) => {
  await page.goto(`${base}/`);

  // --- главный поток занят 300 мс: таймер с интервалом 10 мс не срабатывает ни разу ---
  const main = await page.evaluate(`(() => { ${busy}
    let ticks = 0; const t = setInterval(() => ticks++, 10);
    busy(300);
    return new Promise((r) => setTimeout(() => { clearInterval(t); r(ticks); }, 0));
  })()`);
  assert.equal(main, 0);

  // --- та же работа в воркере: главный поток свободен, таймер тикает ---
  const inWorker = await page.evaluate(() => new Promise((resolve) => {
    let ticks = 0; const t = setInterval(() => ticks++, 10);
    const w = new Worker('/busy-worker.js');
    w.onmessage = () => { clearInterval(t); w.terminate(); resolve(ticks); };
    w.postMessage(300);
  }));
  assert.ok(inWorker >= 10, String(inWorker));

  // --- что доступно в воркере ---
  const env = await msg(page, () => new Promise((r) => { const w = new Worker('/env-worker.js'); w.onmessage = (e) => r(e.data); }));
  assert.deepEqual(env, { document: 'undefined', window: 'undefined', fetch: 'function', indexedDB: 'object', OffscreenCanvas: 'function', self: 'DedicatedWorkerGlobalScope' });

  // --- structured clone: копия, Date и Map сохраняются, прототип класса — нет, функции — ошибка ---
  const clone = await msg(page, () => new Promise((r) => {
    class Product { constructor(p) { this.price = p; } }
    const list = [1, 2, 3];
    const w = new Worker('/echo-worker.js');
    w.onmessage = (e) => r({ ...e.data, mainFirst: list[0] });
    w.postMessage({ list, when: new Date(), map: new Map([['a', 1]]), item: new Product(1200) });
    list[0] = 999; // меняем после отправки — воркер получил копию
  }));
  assert.deepEqual(clone, { same: 3, isDate: true, isMap: true, proto: 'Object', first: 1, mainFirst: 999 });
  const fnError = await msg(page, () => { try { new Worker('/echo-worker.js').postMessage({ cb: () => 1 }); return 'ok'; } catch (e) { return e.name; } });
  assert.equal(fnError, 'DataCloneError');

  // --- передача буфера: без копии, у отправителя он становится пустым ---
  const transfer = await msg(page, () => new Promise((r) => {
    const w = new Worker('/size-worker.js');
    const buf = new ArrayBuffer(64 * 1024 * 1024);
    w.onmessage = (e) => r({ inWorker: e.data, inMain: buf.byteLength, detached: buf.detached });
    w.postMessage(buf, [buf]);
  }));
  assert.deepEqual(transfer, { inWorker: 64 * 1024 * 1024, inMain: 0, detached: true });

  // --- без изоляции SharedArrayBuffer недоступен ---
  assert.deepEqual(await msg(page, () => [crossOriginIsolated, typeof SharedArrayBuffer]), [false, 'undefined']);

  // --- OffscreenCanvas: рисует воркер, а главный поток больше не может взять контекст этого canvas ---
  const off = await msg(page, () => new Promise((r) => {
    const canvas = document.getElementById('c');
    const offscreen = canvas.transferControlToOffscreen();
    const w = new Worker('/canvas-worker.js');
    w.onmessage = (e) => { let err; try { canvas.getContext('2d'); } catch (x) { err = x.name; } r({ ctx: e.data, getContext: err }); };
    w.postMessage({ canvas: offscreen }, [offscreen]);
  }));
  assert.deepEqual(off, { ctx: 'OffscreenCanvasRenderingContext2D', getContext: 'InvalidStateError' });

  // --- Comlink: методы воркера как асинхронные функции ---
  await page.addScriptTag({ type: 'module', content: `import * as Comlink from '/comlink.mjs'; window.Comlink = Comlink;` });
  await page.waitForFunction(() => window.Comlink);
  const total = await msg(page, async () => {
    const api = Comlink.wrap(new Worker('/api-worker.mjs', { type: 'module' }));
    return api.total([{ price: 1200, qty: 2 }, { price: 300, qty: 1 }]);
  });
  assert.equal(total, 2700);
});

// --- с COOP и COEP страница изолирована: общая память и Atomics ---
await withPage(async (page) => {
  await page.goto(`${base}/?isolated`);
  assert.deepEqual(await msg(page, () => [crossOriginIsolated, typeof SharedArrayBuffer]), [true, 'function']);
  const count = (atomic) => page.evaluate(async (atomic) => {
    const buf = new SharedArrayBuffer(4);
    const run = () => new Promise((r) => { const w = new Worker('/counter-worker.js?isolated'); w.onmessage = () => { w.terminate(); r(); }; w.postMessage({ buf, atomic, n: 1_000_000 }); });
    await Promise.all([run(), run()]);
    return new Int32Array(buf)[0];
  }, atomic);
  assert.equal(await count(true), 2_000_000);           // Atomics.add — ни одно увеличение не потеряно
  const plain = await count(false);
  assert.ok(plain <= 2_000_000);                          // обычное a[0]++ может терять увеличения
  console.log(`  без Atomics: ${plain} из 2000000`);
});

server.close();
console.log('workers ok');
