// Проверки к практике 4.10 в Chromium: saveCart и loadCart с JSON, версией ключа и защитой от мусора
// и переполнения; saveOrder без ожидания fetch внутри транзакции; openDb с миграциями по шагам,
// баннером при blocked и закрытием соединения при versionchange.
// Запуск: cd codes && node run.mjs 04.network-api/10.storage
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/price/')) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"price":450}'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><script>
    window.banners = [];
    const showBanner = (t) => banners.push(t);
    const reportStorageFull = () => banners.push('полно');
    const KEY = 'cart:v2';
    function saveCart(cart) {
      try { localStorage.setItem(KEY, JSON.stringify(cart)); }
      catch (e) { if (e.name === 'QuotaExceededError') reportStorageFull(); }
    }
    function loadCart() {
      try {
        const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
        return Array.isArray(parsed?.items) ? parsed : { items: [] };
      } catch { return { items: [] }; }
    }
    async function saveOrder(db, order) {
      const { price } = await fetch('/api/price/' + order.productId).then((r) => r.json());
      const tx = db.transaction('orders', 'readwrite');
      tx.objectStore('orders').put({ ...order, price });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    }
    function openDb(version = 2) {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('shop', version);
        request.onupgradeneeded = (e) => {
          const db = request.result;
          if (e.oldVersion < 1) db.createObjectStore('orders', { keyPath: 'id' });
          if (e.oldVersion < 2 && version >= 2) db.createObjectStore('reviews', { keyPath: 'id' });
        };
        request.onblocked = () => showBanner('Закройте другие вкладки магазина, чтобы завершить обновление');
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); showBanner('Вышла новая версия — перезагрузите страницу'); };
          resolve(db);
        };
        request.onerror = () => reject(request.error);
      });
    }
  </script>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);

  // корзина
  const cart = await page.evaluate(() => {
    const empty = loadCart();
    saveCart({ items: [{ id: 7, qty: 2 }] });
    const saved = loadCart();
    localStorage.setItem('cart:v2', '{битый');
    const broken = loadCart();
    localStorage.setItem('filler', 'x'.repeat(5_000_000));                          // место занято другим ключом
    saveCart({ items: Array.from({ length: 10_000 }, (_, i) => ({ id: i, title: 'длинное название товара' })) });
    return { empty, saved, broken, banners: [...banners] };
  });
  assert.deepEqual(cart, { empty: { items: [] }, saved: { items: [{ id: 7, qty: 2 }] }, broken: { items: [] }, banners: ['полно'] });

  // заказ и версия 1
  const stored = await page.evaluate(async () => {
    const db = await openDb(1);
    await saveOrder(db, { id: 1, productId: 7 });
    const order = await new Promise((r) => { const q = db.transaction('orders').objectStore('orders').get(1); q.onsuccess = () => r(q.result); });
    window.oldDb = db;
    return order;
  });
  assert.deepEqual(stored, { id: 1, productId: 7, price: 450 });

  // новая вкладка с версией 2: старая уступает, миграция сохраняет заказы
  const fresh = await context.newPage();
  await fresh.goto(base);
  const upgraded = await fresh.evaluate(async () => {
    const db = await openDb(2);
    const names = [...db.objectStoreNames].sort();
    const order = await new Promise((r) => { const q = db.transaction('orders').objectStore('orders').get(1); q.onsuccess = () => r(q.result); });
    return { version: db.version, names, price: order.price, banners: [...banners] };
  });
  assert.deepEqual(upgraded, { version: 2, names: ['orders', 'reviews'], price: 450, banners: [] });
  assert.deepEqual(await page.evaluate(() => banners.slice(-1)), ['Вышла новая версия — перезагрузите страницу']);
  await context.close();
} finally {
  await browser.close();
  server.close();
}
console.log('practice ok');
