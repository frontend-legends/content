// Проверки к 4.12: пагинация по смещению теряет и повторяет записи, если список меняется между страницами,
// а курсорная (keyset) — нет; OFFSET читает пропущенные строки, keyset идёт по индексу; ключ идемпотентности —
// повтор возвращает тот же ответ и не создаёт второй заказ, тот же ключ с другим телом — 422; лимит частоты —
// 429 и Retry-After, клиентский «ведро токенов»; долгая операция — 202, Location и опрос статуса;
// пакетная загрузка N запросов одним.
// Запуск: cd codes && node run.mjs 04.network-api/12.api-patterns
import assert from 'node:assert/strict';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';

// --- пагинация ---
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT, created INTEGER)');
const insert = db.prepare('INSERT INTO products (title, created) VALUES (?, ?)');
for (let i = 1; i <= 30; i++) insert.run(`Чай ${i}`, i);
const newest = 'ORDER BY created DESC, id DESC';
const byOffset = (page, size = 10) => db.prepare(`SELECT id FROM products ${newest} LIMIT ? OFFSET ?`).all(size, page * size).map((r) => r.id);
const byCursor = (cursor, size = 10) => (cursor
  ? db.prepare(`SELECT id, created FROM products WHERE (created, id) < (?, ?) ${newest} LIMIT ?`).all(cursor.created, cursor.id, size)
  : db.prepare(`SELECT id, created FROM products ${newest} LIMIT ?`).all(size));

// смещение: пока читали первую страницу, добавили 3 товара — вторая страница повторила 3 записи
const page1 = byOffset(0);
for (let i = 31; i <= 33; i++) insert.run(`Чай ${i}`, i);
const page2 = byOffset(1);
assert.deepEqual(page1.filter((id) => page2.includes(id)), [23, 22, 21]);
// а если товары удалили — запись пропускается
db.exec('DELETE FROM products WHERE id > 30');
const before = byOffset(0);
db.exec(`DELETE FROM products WHERE id IN (${before.slice(0, 3).join(',')})`);
const after = byOffset(1);
assert.ok(!after.includes(20) && !before.includes(20));                                        // запись 20 не увидел никто
// курсор: те же изменения не мешают
db.exec('DELETE FROM products');
for (let i = 1; i <= 30; i++) insert.run(`Чай ${i}`, i);
const c1 = byCursor(null);
for (let i = 31; i <= 33; i++) insert.run(`Чай ${i}`, i);
const c2 = byCursor(c1.at(-1));
assert.deepEqual(c1.map((r) => r.id), [30, 29, 28, 27, 26, 25, 24, 23, 22, 21]);
assert.deepEqual(c2.map((r) => r.id), [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]);               // ни повторов, ни пропусков
// курсор для клиента — непрозрачная строка
const encode = (row) => Buffer.from(JSON.stringify({ created: row.created, id: row.id })).toString('base64url');
const decode = (s) => JSON.parse(Buffer.from(s, 'base64url').toString());
assert.deepEqual(byCursor(decode(encode(c1.at(-1)))).map((r) => r.id), c2.map((r) => r.id));
// план: keyset использует индекс, OFFSET читает и выбрасывает строки
db.exec('CREATE INDEX products_created ON products(created DESC, id DESC)');
const plan = (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
assert.match(plan(`SELECT id FROM products WHERE (created, id) < (10, 10) ${newest} LIMIT 10`), /SEARCH products USING (COVERING )?INDEX products_created/);
const big = new DatabaseSync(':memory:');
big.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
big.exec('WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 200000) INSERT INTO t SELECT i FROM n');
const time = (sql) => { const t = performance.now(); big.prepare(sql).all(); return performance.now() - t; };
const deep = time('SELECT id FROM t ORDER BY id LIMIT 20 OFFSET 190000');
const seek = time('SELECT id FROM t WHERE id > 190000 ORDER BY id LIMIT 20');
assert.ok(deep > seek * 10, `OFFSET ${deep.toFixed(2)} мс, keyset ${seek.toFixed(2)} мс`);

// --- сервер: идемпотентность, лимит, долгая операция, пакет ---
const orders = [];
const keys = new Map();
const buckets = new Map();
const jobs = new Map();
let productCalls = 0;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let raw = '';
  for await (const c of req) raw += c;
  const json = (status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };

  if (url.pathname === '/orders' && req.method === 'POST') {
    const key = req.headers['idempotency-key'];
    if (!key) return json(400, { title: 'Нужен Idempotency-Key' });
    const saved = keys.get(key);
    if (saved) {
      if (saved.body !== raw) return json(422, { title: 'Ключ уже использован с другими данными' });
      return json(saved.status, saved.response, { 'idempotent-replayed': 'true' });
    }
    const order = { id: orders.length + 1, ...JSON.parse(raw) };
    orders.push(order);
    keys.set(key, { body: raw, status: 201, response: order });
    return json(201, order);
  }
  if (url.pathname === '/search') {
    const now = Date.now();
    const b = buckets.get('client') ?? { tokens: 3, at: now };
    b.tokens = Math.min(3, b.tokens + (now - b.at) / 500);                                        // 2 запроса в секунду, запас 3
    b.at = now;
    buckets.set('client', b);
    if (b.tokens < 1) return json(429, { title: 'Слишком много запросов' }, { 'retry-after': '1' });
    b.tokens -= 1;
    return json(200, []);
  }
  if (url.pathname === '/exports' && req.method === 'POST') {
    const id = `exp${jobs.size + 1}`;
    jobs.set(id, { status: 'running', started: Date.now() });
    return json(202, { id, status: 'running' }, { location: `/exports/${id}` });
  }
  if (url.pathname.startsWith('/exports/')) {
    const job = jobs.get(url.pathname.split('/')[2]);
    if (Date.now() - job.started > 150) job.status = 'done';
    return json(200, { status: job.status, ...(job.status === 'done' && { file: '/files/orders.csv' }) });
  }
  if (url.pathname === '/products') {
    productCalls++;
    const ids = url.searchParams.get('ids').split(',');
    return json(200, ids.map((id) => ({ id, title: `Чай ${id}` })));
  }
  json(404, {});
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// идемпотентность
const order = { items: [{ id: 7, qty: 2 }] };
const key = crypto.randomUUID();
const post = (body, k = key) => fetch(`${base}/orders`, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': k }, body: JSON.stringify(body) });
const first = await post(order);
const retry = await post(order);                                                                 // ответ потерялся — повтор
assert.deepEqual([first.status, retry.status, retry.headers.get('idempotent-replayed')], [201, 201, 'true']);
assert.deepEqual(await retry.json(), await first.json());
assert.equal(orders.length, 1);
assert.equal((await post({ items: [] })).status, 422);
assert.equal((await post(order, crypto.randomUUID())).status, 201);                              // новый ключ — новый заказ
assert.equal(orders.length, 2);

// лимит частоты: запас из трёх, дальше 429 с Retry-After
const statuses = [];
for (let i = 0; i < 5; i++) { const r = await fetch(`${base}/search?q=${i}`); statuses.push([r.status, r.headers.get('retry-after')]); }
assert.deepEqual(statuses.slice(0, 3).map((s) => s[0]), [200, 200, 200]);
assert.deepEqual(statuses[3], [429, '1']);
// клиентское ведро токенов не даёт превысить лимит
function tokenBucket(rate, burst) {
  let tokens = burst, last = Date.now();
  return async () => {
    for (;;) {
      const now = Date.now();
      tokens = Math.min(burst, tokens + ((now - last) / 1000) * rate);
      last = now;
      if (tokens >= 1) { tokens -= 1; return; }
      await new Promise((r) => setTimeout(r, ((1 - tokens) / rate) * 1000));
    }
  };
}
await new Promise((r) => setTimeout(r, 1600));                                                   // ведро сервера наполнилось
const take = tokenBucket(1.8, 3);
const limited = [];
for (let i = 0; i < 6; i++) { await take(); limited.push((await fetch(`${base}/search?q=b${i}`)).status); }
assert.deepEqual(limited, [200, 200, 200, 200, 200, 200]);

// долгая операция: 202, Location, опрос
const started = await fetch(`${base}/exports`, { method: 'POST' });
assert.equal(started.status, 202);
const location = started.headers.get('location');
let status;
for (let i = 0; i < 20; i++) {
  status = await (await fetch(base + location)).json();
  if (status.status === 'done') break;
  await new Promise((r) => setTimeout(r, 50));
}
assert.deepEqual(status, { status: 'done', file: '/files/orders.csv' });

// пакет: десять карточек — один запрос
function batcher(load) {
  let pending = null;
  return (id) => {
    if (!pending) {
      pending = { ids: [], promise: null };
      pending.promise = new Promise((resolve) => queueMicrotask(async () => {
        const batch = pending;
        pending = null;
        resolve(await load(batch.ids));
      }));
    }
    pending.ids.push(id);
    const p = pending.promise;
    return p.then((items) => items.find((x) => x.id === String(id)));
  };
}
const getProduct = batcher((ids) => fetch(`${base}/products?ids=${ids.join(',')}`).then((r) => r.json()));
const cards = await Promise.all(Array.from({ length: 10 }, (_, i) => getProduct(i + 1)));
assert.equal(productCalls, 1);
assert.equal(cards[6].title, 'Чай 7');

server.close();
console.log('patterns ok');
