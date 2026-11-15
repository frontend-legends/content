// Проверки к 13.11: canary по хешу пользователя, флаг как аварийный выключатель, expand–contract,
// и rolling-выкладка через балансировщик, где старый экземпляр не знает новых чанков.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

// --- canary: пользователь стабильно попадает в одну группу ---
const bucket = (userId, salt = 'checkout-v2') => createHash('sha256').update(`${salt}:${userId}`).digest().readUInt32BE(0) % 100;
const inCanary = (userId, percent) => bucket(userId) < percent;
const users = Array.from({ length: 100_000 }, (_, i) => `user-${i}`);

const at5 = users.filter((u) => inCanary(u, 5));
assert.ok(Math.abs(at5.length - 5000) < 300, `${at5.length}`); // около 5%
assert.ok(users.slice(0, 1000).every((u) => inCanary(u, 5) === inCanary(u, 5))); // один и тот же ответ при каждом запросе
// расширение до 25% не выкидывает тех, кто уже был в canary
assert.ok(at5.every((u) => inCanary(u, 25)));

// случайный выбор на каждый запрос: пользователь прыгает между версиями
let flips = 0;
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
for (const u of users.slice(0, 1000)) { const a = rnd() < 0.5, b = rnd() < 0.5; if (a !== b) flips++; }
assert.ok(flips > 400, `${flips}`); // примерно половина увидит обе версии за два запроса

// --- флаг: выключить функцию без выкладки ---
const remote = { newCheckout: true };
const flags = { get: (name) => remote[name] ?? false };
const checkout = () => (flags.get('newCheckout') ? 'новое оформление' : 'старое оформление');
assert.equal(checkout(), 'новое оформление');
remote.newCheckout = false; // аварийный выключатель в панели флагов
assert.equal(checkout(), 'старое оформление');
assert.equal(flags.get('unknownFlag'), false); // неизвестный флаг — безопасное значение по умолчанию

// --- expand–contract: переименование поля price → amount ---
const oldClient = (p) => `${p.price} ₽`;
const newClient = (p) => `${p.amount} ₽`;
const v1 = { price: 1200 };
const expand = { price: 1200, amount: 1200 }; // шаг 1: оба поля
const contract = { amount: 1200 };            // шаг 3: старое удалено
assert.equal(oldClient(v1), '1200 ₽');
assert.equal(oldClient(expand), '1200 ₽');
assert.equal(newClient(expand), '1200 ₽');
assert.equal(oldClient(contract), 'undefined ₽'); // удалить сразу — старые вкладки сломаются
assert.equal(newClient(contract), '1200 ₽');

// --- rolling: балансировщик по кругу между v1 и v2, ассеты у каждого экземпляра свои ---
const instance = (version) => new Promise((resolve) => {
  const s = createServer((req, res) => {
    if (req.url === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(`<!doctype html><div id="app"></div><script type="module" src="/assets/index-${version}.js"></script>`); }
    if (req.url === `/assets/index-${version}.js`) { res.setHeader('content-type', 'text/javascript'); return res.end(`document.getElementById('app').textContent = 'магазин ${version}';`); }
    res.statusCode = 404; res.end();
  }).listen(0, () => resolve(s));
});
const a = await instance('v1');
const b = await instance('v2');
const pool = [b, a]; // первый запрос — на обновлённый экземпляр
let next = 0;
const lb = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const target = pool[next++ % pool.length];
    const p = request({ port: target.address().port, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    req.pipe(p);
  }).listen(0, () => resolve(s));
});
const open = () => withPage(async (page) => {
  const failed = [];
  page.on('response', (r) => r.status() === 404 && failed.push(new URL(r.url()).pathname));
  await page.goto(`http://localhost:${lb.address().port}/`);
  await page.waitForTimeout(200);
  return { text: await page.textContent('#app'), failed };
});
next = 0;
const mixed = await open();
assert.equal(mixed.text, '');                         // HTML от v2, скрипт пошёл на v1 — пустая страница
assert.deepEqual(mixed.failed, ['/assets/index-v2.js']);

// исправление: ассеты обеих версий доступны с любого экземпляра (общее хранилище или CDN)
pool.length = 0;
const shared = await new Promise((resolve) => {
  const s = createServer((req, res) => {
    const m = req.url.match(/^\/assets\/index-(v\d)\.js$/);
    if (req.url === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end('<!doctype html><div id="app"></div><script type="module" src="/assets/index-v2.js"></script>'); }
    if (m) { res.setHeader('content-type', 'text/javascript'); return res.end(`document.getElementById('app').textContent = 'магазин ${m[1]}';`); }
    res.statusCode = 404; res.end();
  }).listen(0, () => resolve(s));
});
pool.push(shared, shared);
next = 0;
const fixed = await open();
assert.equal(fixed.text, 'магазин v2');
assert.deepEqual(fixed.failed, []);
for (const s of [a, b, lb, shared]) s.close();

console.log('strategies ok');
