// Проверки к 14.07: что нового в соседних областях. Бэкенд — транзакции, N+1 и индексы на node:sqlite;
// игры — фиксированный шаг симуляции; расширения — Manifest V3 в настоящем Chromium.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

process.removeAllListeners('warning'); // node:sqlite пока экспериментальный и пишет предупреждение
const { DatabaseSync } = await import('node:sqlite');

// --- бэкенд: транзакция — всё или ничего ---
const db = new DatabaseSync(':memory:');
db.exec(`
  create table products (id integer primary key, title text, stock integer check (stock >= 0));
  create table orders (id integer primary key, product_id integer, qty integer);
  insert into products (title, stock) values ('Пуэр', 3), ('Улун', 10);
`);
const placeOrder = (productId, qty) => {
  db.exec('begin');
  try {
    db.prepare('insert into orders (product_id, qty) values (?, ?)').run(productId, qty);
    db.prepare('update products set stock = stock - ? where id = ?').run(qty, productId); // упадёт на check
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    throw e;
  }
};
placeOrder(1, 2);
assert.throws(() => placeOrder(1, 5), /CHECK constraint failed/);
assert.equal(db.prepare('select stock from products where id = 1').get().stock, 1);
assert.equal(db.prepare('select count(*) as n from orders').get().n, 1); // неудачный заказ не остался «наполовину»

// --- бэкенд: N+1 запросов против одного JOIN ---
for (let i = 0; i < 50; i++) db.prepare('insert into orders (product_id, qty) values (?, 1)').run(1 + (i % 2));
let queries = 0;
const count = (stmt) => ({ all: (...a) => { queries++; return stmt.all(...a); }, get: (...a) => { queries++; return stmt.get(...a); } });
const allOrders = count(db.prepare('select * from orders'));
const productById = count(db.prepare('select title from products where id = ?'));
queries = 0;
const nPlusOne = allOrders.all().map((o) => ({ ...o, title: productById.get(o.product_id).title }));
assert.equal(queries, 1 + nPlusOne.length); // 52 запроса
const joined = count(db.prepare('select o.*, p.title from orders o join products p on p.id = o.product_id'));
queries = 0;
assert.equal(joined.all().length, nPlusOne.length);
assert.equal(queries, 1);

// --- бэкенд: индекс меняет план запроса ---
const plan = () => db.prepare('explain query plan select * from orders where product_id = 2').all().map((r) => r.detail).join(' ');
assert.match(plan(), /^SCAN orders/);
db.exec('create index orders_product on orders (product_id)');
assert.match(plan(), /SEARCH orders USING INDEX orders_product \(product_id=\?\)/);

// --- игры: переменный шаг зависит от частоты кадров, фиксированный — нет ---
function simulate(fps, { fixed }) {
  const g = -9.8;
  const stepUs = Math.round(1e6 / 120);  // физика 120 раз в секунду, время в микросекундах — без накопления ошибок float
  const frameUs = Math.round(1e6 / fps);
  let y = 100, v = 0, acc = 0;
  for (let i = 0; i < 2 * fps; i++) {     // две секунды кадров
    if (!fixed) { const dt = frameUs / 1e6; v += g * dt; y += v * dt; continue; } // шаг = время кадра
    acc += frameUs;
    while (acc >= stepUs) { const dt = stepUs / 1e6; v += g * dt; y += v * dt; acc -= stepUs; }
  }
  return Math.round(y * 1000) / 1000;
}
console.log(`  высота через 2 с: переменный шаг 30 fps ${simulate(30, { fixed: false })}, 144 fps ${simulate(144, { fixed: false })}; фиксированный ${simulate(30, { fixed: true })}`);
assert.notEqual(simulate(30, { fixed: false }), simulate(144, { fixed: false })); // на разных экранах — разная физика
assert.equal(simulate(30, { fixed: true }), simulate(60, { fixed: true }));
assert.equal(simulate(60, { fixed: true }), simulate(120, { fixed: true }));

// --- расширение Manifest V3 в настоящем Chromium (не headless shell) ---
function findFullChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const dir of [join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')]) {
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const b of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-linux64/chrome', 'chrome-linux/chrome']) {
        if (existsSync(join(dir, d, b))) return join(dir, d, b);
      }
    }
  }
}
const chrome = findFullChromium();
if (!chrome) {
  console.log('  расширение: пропущено — нет полного Chromium (npx playwright-core install chromium)');
} else {
  const ext = mkdtempSync(join(tmpdir(), 'fl-ext-'));
  writeFileSync(join(ext, 'manifest.json'), JSON.stringify({
    manifest_version: 3, name: 'Shop price helper', version: '1.0',
    content_scripts: [{ matches: ['http://localhost/*'], js: ['content.js'] }],
    background: { service_worker: 'background.js' },
  }));
  writeFileSync(join(ext, 'content.js'), `
    window.secretFromExtension = 'видно только расширению';
    const price = document.querySelector('#price');
    chrome.runtime.sendMessage({ type: 'price', value: price.textContent }, (reply) => {
      price.dataset.converted = reply.usd;
    });`);
  writeFileSync(join(ext, 'background.js'), `
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'price') sendResponse({ usd: (parseInt(msg.value, 10) / 90).toFixed(2) + ' $' });
    });`);
  const site = await new Promise((resolve) => { const s = createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end('<!doctype html><p id="price">1800 ₽</p><script>window.pageVar = 1;</script>'); }).listen(0, () => resolve(s)); });
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'fl-profile-')), {
    executablePath: chrome, headless: true,
    args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
  });
  try {
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    assert.match(worker.url(), /^chrome-extension:\/\/[a-p]{32}\/background\.js$/); // фон — Service Worker, а не страница
    const page = await context.newPage();
    await page.goto(`http://localhost:${site.address().port}/`);
    await page.waitForFunction(() => document.querySelector('#price').dataset.converted);
    const seen = await page.evaluate(() => ({ converted: document.querySelector('#price').dataset.converted, secret: typeof window.secretFromExtension, chrome: typeof chrome?.runtime?.sendMessage }));
    assert.deepEqual(seen, { converted: '20.00 $', secret: 'undefined', chrome: 'undefined' }); // DOM общий, переменные и API — нет
  } finally {
    await context.close();
    site.close();
  }
}

console.log('beyond ok');
