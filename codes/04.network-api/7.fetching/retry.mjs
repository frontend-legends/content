// Проверки к 4.07 в Node: повтор с экспоненциальной задержкой и случайным разбросом повторяет только
// сетевые ошибки, 429 и 5xx и только идемпотентные методы, учитывает Retry-After и ограничен числом
// попыток; обёртка бросает HttpError на не-2xx; одинаковые одновременные GET схлопываются в один;
// axios отклоняет промис на 404, а fetch — нет.
// Запуск: cd codes && node run.mjs 04.network-api/7.fetching
import assert from 'node:assert/strict';
import http from 'node:http';
import axios from 'axios';

const hits = {};
const server = http.createServer((req, res) => {
  const key = `${req.method} ${req.url}`;
  hits[key] = (hits[key] ?? 0) + 1;
  const n = hits[key];
  if (req.url === '/flaky') { res.writeHead(n < 3 ? 503 : 200); return res.end(n < 3 ? 'занято' : '{"ok":true}'); }
  if (req.url === '/limited') { res.writeHead(n < 2 ? 429 : 200, n < 2 ? { 'retry-after': '1' } : {}); return res.end('{}'); }
  if (req.url === '/bad') { res.writeHead(400, { 'content-type': 'application/problem+json' }); return res.end('{"title":"Неверный запрос"}'); }
  if (req.url === '/down') { res.writeHead(503); return res.end(); }
  if (req.url === '/catalog') { setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('[1,2,3]'); }, 50); return; }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

class HttpError extends Error {
  constructor(response, body) {
    super(`HTTP ${response.status}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.body = body;
    this.retryAfter = response.headers.get('retry-after');
  }
}

const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);
const RETRIABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const delays = [];

async function request(url, { retries = 3, baseDelay = 100, ...init } = {}) {
  const method = (init.method ?? 'GET').toUpperCase();
  const canRetry = IDEMPOTENT.has(method) || init.headers?.['idempotency-key'];
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      throw new HttpError(res, await res.text());
    } catch (e) {
      if (e.name === 'AbortError') throw e;                                                   // отмену не повторяем
      const retriable = e instanceof HttpError ? RETRIABLE.has(e.status) : true;               // сетевая ошибка — повторяем
      if (!canRetry || !retriable || attempt >= retries) throw e;
      const fromHeader = e.retryAfter ? Number(e.retryAfter) * 1000 : 0;
      const backoff = Math.random() * baseDelay * 2 ** attempt;                                // полный разброс
      const wait = Math.max(fromHeader, backoff);
      delays.push(Math.round(wait));
      await sleep(wait);
    }
  }
}

// 503 дважды, потом 200 — две повторные попытки
assert.deepEqual(await (await request(`${base}/flaky`)).json(), { ok: true });
assert.equal(hits['GET /flaky'], 3);
assert.ok(delays.every((d, i) => d <= 100 * 2 ** i));

// 429 с Retry-After: 1 — ждём не меньше секунды
delays.length = 0;
const t = performance.now();
await request(`${base}/limited`);
assert.ok(performance.now() - t >= 990);
assert.deepEqual(delays, [1000]);

// 400 не повторяется, ошибка содержит тело
await assert.rejects(request(`${base}/bad`), (e) => e.status === 400 && e.body.includes('Неверный запрос'));
assert.equal(hits['GET /bad'], 1);

// POST без ключа идемпотентности не повторяется, с ключом — повторяется
await assert.rejects(request(`${base}/down`, { method: 'POST', body: '{}' }), { status: 503 });
assert.equal(hits['POST /down'], 1);
await assert.rejects(request(`${base}/down`, { method: 'POST', body: '{}', retries: 2, baseDelay: 10, headers: { 'idempotency-key': 'k1' } }), { status: 503 });
assert.equal(hits['POST /down'], 1 + 3);

// сетевая ошибка повторяется, но число попыток ограничено
await assert.rejects(request('http://127.0.0.1:1/', { retries: 2, baseDelay: 10 }), TypeError);

// --- практика «Повторы добили сервер»: исправленная load ---
async function load(url, { retries = 5, baseDelay = 500 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url).catch(() => null);
    if (res?.ok) return res.json();
    const retriable = !res || [408, 429, 500, 502, 503, 504].includes(res.status);
    if (!retriable || attempt >= retries) throw new Error(`Не удалось загрузить: ${res?.status ?? 'сеть'}`);
    const retryAfter = Number(res?.headers.get('retry-after')) * 1000 || 0;
    await sleep(Math.max(retryAfter, Math.random() * baseDelay * 2 ** attempt));
  }
}
hits['GET /flaky'] = 0;
assert.deepEqual(await load(`${base}/flaky`, { baseDelay: 20 }), { ok: true });
await assert.rejects(load(`${base}/bad`), /Не удалось загрузить: 400/);
assert.equal(hits['GET /bad'], 2);                                                              // 4xx не повторялся

// --- одинаковые одновременные запросы — один поход в сеть ---
const inFlight = new Map();
function getOnce(url) {
  if (!inFlight.has(url)) {
    inFlight.set(url, fetch(url).then((r) => r.json()).finally(() => inFlight.delete(url)));
  }
  return inFlight.get(url);
}
const [a, b, c] = await Promise.all([getOnce(`${base}/catalog`), getOnce(`${base}/catalog`), getOnce(`${base}/catalog`)]);
assert.deepEqual([a, b, c], [[1, 2, 3], [1, 2, 3], [1, 2, 3]]);
assert.equal(hits['GET /catalog'], 1);
await getOnce(`${base}/catalog`);
assert.equal(hits['GET /catalog'], 2);                                                         // после ответа — снова сеть

// --- axios отклоняет на 404, fetch — нет ---
assert.equal((await fetch(`${base}/nothing`)).status, 404);
await assert.rejects(axios.get(`${base}/nothing`), (e) => e.response.status === 404);
assert.equal((await axios.get(`${base}/nothing`, { validateStatus: () => true })).status, 404);

server.close();
console.log('retry ok');
