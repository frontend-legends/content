// Проверки к 17.13: валидация HTTP-кеша на настоящем сервере (ETag → 304 без тела), стратегии Service Worker
// как функции над мок-кешем и мок-сетью (cache-first, network-first, stale-while-revalidate, офлайн),
// хеш содержимого в имени ассета (cache busting), прохождение запроса по слоям до первого свежего.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';

// --- HTTP-кеш: валидация через ETag, 304 Not Modified без перекачки тела ---
const body = JSON.stringify({ items: [1, 2, 3] });
const etag = '"' + createHash('sha1').update(body).digest('hex').slice(0, 16) + '"';
let bodiesSent = 0;
const server = createServer((req, res) => {
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { etag }).end(); return; } // не изменилось — пустой ответ
  bodiesSent++;
  res.writeHead(200, { etag, 'cache-control': 'no-cache', 'content-type': 'application/json' }).end(body);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/data`;

const first = await fetch(url);
const got = await first.text();
assert.equal(first.status, 200);
assert.equal(first.headers.get('etag'), etag);
const second = await fetch(url, { headers: { 'if-none-match': etag } }); // браузер шлёт сохранённый ETag
assert.equal(second.status, 304);
assert.equal(await second.text(), '');     // тело не пришло — экономия трафика
assert.equal(bodiesSent, 1);               // сервер отдал тело один раз, второй ответ — только заголовок
server.close();

// --- стратегии Service Worker над мок-кешем и мок-сетью ---
const makeEnv = (initial = {}, { offline = false } = {}) => {
  const cache = new Map(Object.entries(initial));
  let netCalls = 0;
  const network = async (key) => { netCalls++; if (offline) throw new Error('offline'); return `сеть:${key}@${netCalls}`; };
  return { cache, network, calls: () => netCalls };
};

const cacheFirst = async (env, key) => env.cache.get(key) ?? (async () => { const r = await env.network(key); env.cache.set(key, r); return r; })();
const networkFirst = async (env, key) => { try { const r = await env.network(key); env.cache.set(key, r); return r; } catch { return env.cache.get(key); } };
const staleWhileRevalidate = (env, key) => {
  const cached = env.cache.get(key);
  const fresh = env.network(key).then((r) => { env.cache.set(key, r); return r; }).catch(() => cached);
  return { response: cached ?? fresh, done: fresh }; // отдать кеш сразу, обновление идёт в фоне
};

// cache-first: в кеше есть — сеть не трогаем
{
  const env = makeEnv({ '/logo.svg': 'кеш:logo' });
  assert.equal(await cacheFirst(env, '/logo.svg'), 'кеш:logo');
  assert.equal(env.calls(), 0);                       // статика отдана мгновенно, без сети
  assert.equal(await cacheFirst(env, '/font.woff2'), 'сеть:/font.woff2@1'); // чего нет — берём и кладём в кеш
  assert.equal(env.cache.get('/font.woff2'), 'сеть:/font.woff2@1');
}
// network-first: всегда свежее, а офлайн — из кеша
{
  const online = makeEnv({ '/api/me': 'кеш:старое' });
  assert.equal(await networkFirst(online, '/api/me'), 'сеть:/api/me@1');   // онлайн — свежий ответ
  assert.equal(online.cache.get('/api/me'), 'сеть:/api/me@1');             // и кеш обновлён
  const offline = makeEnv({ '/api/me': 'кеш:старое' }, { offline: true });
  assert.equal(await networkFirst(offline, '/api/me'), 'кеш:старое');      // сеть упала — отдаём кеш
}
// stale-while-revalidate: мгновенно кеш, следующий запрос уже свежий
{
  const env = makeEnv({ '/feed': 'кеш:вчера' });
  const r1 = staleWhileRevalidate(env, '/feed');
  assert.equal(await r1.response, 'кеш:вчера');       // пользователь сразу видит кеш
  await r1.done;                                      // фоновое обновление завершилось
  assert.equal(env.cache.get('/feed'), 'сеть:/feed@1');
  const r2 = staleWhileRevalidate(env, '/feed');
  assert.equal(await r2.response, 'сеть:/feed@1');    // в следующий раз — уже обновлённое
}

// --- хеш содержимого в имени ассета: cache busting без ручной чистки ---
const hashedName = (base, content) => { const h = createHash('sha256').update(content).digest('hex').slice(0, 8); return base.replace(/\.(\w+)$/, `.${h}.$1`); };
const v1 = hashedName('app.js', 'console.log(1)');
const v1again = hashedName('app.js', 'console.log(1)');
const v2 = hashedName('app.js', 'console.log(2)');
assert.equal(v1, v1again);                            // тот же код — то же имя, берётся из кеша
assert.notEqual(v1, v2);                              // изменился код — новое имя, браузер скачает заново
assert.match(v1, /^app\.[0-9a-f]{8}\.js$/);
// index.html остаётся no-cache и указывает на актуальные хешированные файлы
const cachePolicy = (file) => /\.[0-9a-f]{8}\.\w+$/.test(file) ? 'immutable, max-age=31536000' : 'no-cache';
assert.equal(cachePolicy(v2), 'immutable, max-age=31536000');
assert.equal(cachePolicy('index.html'), 'no-cache');

// --- слои кеша: запрос останавливается на первом, где есть свежие данные ---
const layers = [
  { name: 'memory', store: new Map() },
  { name: 'service-worker', store: new Map([['/feed', 'swr']]) },
  { name: 'http', store: new Map([['/feed', 'http'], ['/logo', 'http-logo']]) },
  { name: 'cdn', store: new Map([['/feed', 'cdn']]) },
];
const resolve = (key) => { for (const l of layers) if (l.store.has(key)) return { hit: l.name, value: l.store.get(key) }; return { hit: 'origin', value: null }; };
assert.deepEqual(resolve('/feed'), { hit: 'service-worker', value: 'swr' }); // самый высокий слой с данными
assert.deepEqual(resolve('/logo'), { hit: 'http', value: 'http-logo' });     // выше нет — дошли до HTTP-кеша
assert.equal(resolve('/profile').hit, 'origin');                             // нигде нет — идём на сервер

console.log('caching ok');
