// Проверки к 4.10 в Chromium: localStorage хранит строки и ограничен ~5 млн символов (QuotaExceededError),
// его нет в воркере; sessionStorage свой у вкладки, копируется в окно из window.open и переживает
// перезагрузку; IndexedDB хранит структурированные клоны, держит уникальный индекс, транзакция
// закрывается после await fetch (TransactionInactiveError), обновление схемы ждёт закрытия старых
// соединений (versionchange и blocked); StorageManager считает занятое; Cache API и OPFS;
// хранилище фрейма с другого сайта разделено по сайту страницы.
// Запуск: cd codes && node run.mjs 04.network-api/10.storage
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/price') { setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"price":450}'); }, 30); return; }
  if (url.pathname === '/frame') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(`<!doctype html><script>
      const before = localStorage.getItem('visited');
      localStorage.setItem('visited', ${JSON.stringify(url.searchParams.get('mark') ?? '')} || before || '');
      parent.postMessage({ before }, '*');
    </script>`);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>shop</title>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const at = (host, path = '/') => `http://${host}:${port}${path}`;

// Playwright по умолчанию отключает разделение хранилищ (ThirdPartyStoragePartitioning) —
// убираем это из его списка отключённых возможностей, остальное оставляем как есть
const require = createRequire(import.meta.url);
let partitionArgs = { ignoreDefaultArgs: [], args: [] };
try {
  const { chromiumSwitches } = require(join(dirname(require.resolve('playwright-core/package.json')), 'lib/server/chromium/chromiumSwitches.js'));
  const disabled = chromiumSwitches(false).find((a) => a.startsWith('--disable-features='));
  const kept = disabled.slice('--disable-features='.length).split(',').filter((f) => f !== 'ThirdPartyStoragePartitioning');
  partitionArgs = { ignoreDefaultArgs: [disabled], args: [`--disable-features=${kept.join(',')}`] };
} catch { partitionArgs = null; }

const browser = await chromium.launch({
  executablePath: findChromium(),
  ...(partitionArgs && { ignoreDefaultArgs: partitionArgs.ignoreDefaultArgs }),
  args: ['--host-resolver-rules=MAP shop.test 127.0.0.1, MAP other.test 127.0.0.1, MAP widget.test 127.0.0.1', ...(partitionArgs?.args ?? [])],
});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(at('127.0.0.1'));

  // --- localStorage ---
  const local = await page.evaluate(async () => {
    localStorage.setItem('qty', 5);
    localStorage.setItem('cart', { items: [1] });
    const fits = (n) => { try { localStorage.clear(); localStorage.setItem('k', 'ж'.repeat(n)); return true; } catch (e) { return e.name; } };
    const quota = [fits(5_242_879), fits(5_242_880)];
    localStorage.clear();
    const inWorker = await new Promise((r) => {
      const w = new Worker(URL.createObjectURL(new Blob(['postMessage(typeof localStorage)'], { type: 'text/javascript' })));
      w.onmessage = (e) => r(e.data);
    });
    localStorage.setItem('qty', 5);
    localStorage.setItem('cart', { items: [1] });
    return { qty: localStorage.getItem('qty'), cart: localStorage.getItem('cart'), quota, inWorker };
  });
  assert.deepEqual(local, { qty: '5', cart: '[object Object]', quota: [true, 'QuotaExceededError'], inWorker: 'undefined' });

  // --- sessionStorage: своя у вкладки ---
  await page.evaluate(() => sessionStorage.setItem('step', 'адрес'));
  await page.reload();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('step')), 'адрес');            // пережила перезагрузку
  const [popup] = await Promise.all([context.waitForEvent('page'), page.evaluate(() => { window.open('/'); })]);
  await popup.waitForLoadState();
  assert.equal(await popup.evaluate(() => sessionStorage.getItem('step')), 'адрес');           // копия при window.open
  await popup.evaluate(() => sessionStorage.setItem('step', 'оплата'));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('step')), 'адрес');            // но копия независима
  const fresh = await context.newPage();
  await fresh.goto(at('127.0.0.1'));
  assert.equal(await fresh.evaluate(() => sessionStorage.getItem('step')), null);              // новая вкладка — пусто
  assert.equal(await fresh.evaluate(() => localStorage.getItem('qty')), '5');                  // localStorage общий
  await popup.close();

  // --- IndexedDB ---
  const idb = await page.evaluate(async () => {
    const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const open = indexedDB.open('shop', 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore('orders', { keyPath: 'id' });
      store.createIndex('byNumber', 'number', { unique: true });
    };
    const db = await req(open);
    const put = db.transaction('orders', 'readwrite').objectStore('orders');
    await req(put.put({ id: 1, number: 'A-100', created: new Date(Date.UTC(2026, 10, 16)), items: new Map([['улун', 2]]), receipt: new Blob(['чек'], { type: 'text/plain' }) }));
    const got = await req(db.transaction('orders').objectStore('orders').get(1));
    const dup = await req(db.transaction('orders', 'readwrite').objectStore('orders').put({ id: 2, number: 'A-100' })).then(() => 'ok', (e) => e.name);
    // транзакция закрывается, если ждать что-то вне IndexedDB
    const tx = db.transaction('orders', 'readwrite');
    const store = tx.objectStore('orders');
    await fetch('/api/price').then((r) => r.json());
    let inactive;
    try { store.put({ id: 3, number: 'A-101' }); } catch (e) { inactive = e.name; }
    db.close();
    return {
      dateKept: got.created instanceof Date, mapKept: got.items instanceof Map && got.items.get('улун') === 2,
      blob: await got.receipt.text(), dup, inactive,
    };
  });
  assert.deepEqual(idb, { dateKept: true, mapKept: true, blob: 'чек', dup: 'ConstraintError', inactive: 'TransactionInactiveError' });

  // --- обновление схемы при открытой второй вкладке ---
  const oldTab = await context.newPage();
  await oldTab.goto(at('127.0.0.1'));
  await oldTab.evaluate(() => new Promise((r) => {
    const o = indexedDB.open('shop', 1);
    o.onsuccess = () => { window.db = o.result; window.events = []; o.result.onversionchange = (e) => window.events.push(`versionchange ${e.oldVersion}→${e.newVersion}`); r(); };
  }));
  const upgrade = await page.evaluate(() => new Promise((resolve) => {
    const log = [];
    const o = indexedDB.open('shop', 2);
    o.onblocked = () => log.push('blocked');
    o.onupgradeneeded = () => { o.result.createObjectStore('reviews'); log.push('upgrade'); };
    o.onsuccess = () => { log.push('success'); o.result.close(); resolve(log); };
    setTimeout(() => resolve(log), 500);
  }));
  assert.deepEqual(upgrade, ['blocked']);                                                       // старая вкладка держит соединение
  assert.deepEqual(await oldTab.evaluate(() => window.events), ['versionchange 1→2']);
  await oldTab.evaluate(() => window.db.close());                                               // старая вкладка уступила
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => new Promise((r) => { const o = indexedDB.open('shop'); o.onsuccess = () => { r(o.result.version); o.result.close(); }; })), 2);

  // --- StorageManager, Cache API, OPFS ---
  const misc = await page.evaluate(async () => {
    const before = (await navigator.storage.estimate()).usage;
    const cache = await caches.open('assets-v1');
    await cache.put('/logo.png', new Response(new Uint8Array(3 * 1024 * 1024), { headers: { 'content-type': 'image/png' } }));
    const matched = await cache.match('/logo.png');
    const after = (await navigator.storage.estimate()).usage;
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('draft.txt', { create: true });
    const writable = await handle.createWritable();
    await writable.write('черновик отзыва');
    await writable.close();
    return {
      cached: matched.headers.get('content-type'),
      grew: after - before > 3_000_000,
      quotaGB: Math.round((await navigator.storage.estimate()).quota / 1e9) > 0,
      persisted: await navigator.storage.persisted(),
      opfs: await (await handle.getFile()).text(),
    };
  });
  assert.deepEqual(misc, { cached: 'image/png', grew: true, quotaGB: true, persisted: false, opfs: 'черновик отзыва' });

  // --- разделение хранилища фреймов по сайту страницы ---
  const frameVisit = async (top, mark) => {
    const p = await context.newPage();
    await p.goto(at(top));
    const before = await p.evaluate((src) => new Promise((r) => {
      addEventListener('message', (e) => r(e.data.before), { once: true });
      document.body.append(Object.assign(document.createElement('iframe'), { src }));
    }), at('widget.test', `/frame?mark=${mark}`));
    await p.close();
    return before;
  };
  if (partitionArgs) {
    assert.equal(await frameVisit('shop.test', 'shop'), null);
    assert.equal(await frameVisit('shop.test', ''), 'shop');                                    // тот же сайт — та же копия
    assert.equal(await frameVisit('other.test', ''), null);                                     // другой сайт — другая копия
    const direct = await context.newPage();
    await direct.goto(at('widget.test'));
    assert.equal(await direct.evaluate(() => localStorage.getItem('visited')), null);           // и не та, что у самого виджета
  } else {
    console.log('не удалось включить разделение хранилищ — проверка фреймов пропущена');
  }
  await context.close();
} finally {
  await browser.close();
  server.close();
}
console.log('storage ok');
