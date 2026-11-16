// Проверки к 4.08 в Chromium: ответ без Cache-Control, но с Last-Modified, кешируется эвристически;
// без валидаторов — не переиспользуется; max-age отсчитывается с учётом Age; no-cache и ETag дают
// условный запрос и 304; Vary разделяет варианты; stale-while-revalidate отдаёт старое и обновляет в фоне;
// режимы cache у fetch; обычная перезагрузка не перепроверяет подресурсы; POST не кешируется;
// кеш разделён по сайту страницы.
// Запуск: cd codes && node run.mjs 04.network-api/8.caching
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const hits = {};
const seen = [];
let version = 1;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  hits[p] = (hits[p] ?? 0) + 1;
  seen.push({ p, inm: req.headers['if-none-match'], ims: req.headers['if-modified-since'], lang: req.headers['x-lang'] });
  const common = { 'content-type': 'text/plain', 'access-control-allow-origin': '*' };
  const tenDaysAgo = new Date(Date.now() - 10 * 864e5).toUTCString();
  switch (p) {
    case '/': res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>shop</title>');
    case '/page': res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-cache' }); return res.end('<!doctype html><script src="/app.js"></script><img src="/logo.png">');
    case '/app.js': res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'max-age=3600' }); return res.end('window.app = 1');
    case '/logo.png': res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'max-age=3600' }); return res.end();
    case '/heuristic': res.writeHead(200, { ...common, 'last-modified': tenDaysAgo }); return res.end('каталог');
    case '/no-validators': res.writeHead(200, common); return res.end('каталог');
    case '/fresh': res.writeHead(200, { ...common, 'cache-control': 'max-age=60' }); return res.end(`v${version}`);
    case '/aged': res.writeHead(200, { ...common, 'cache-control': 'max-age=60', age: '59' }); return res.end(`v${version}`);
    case '/etag': {
      const tag = `"v${version}"`;
      if (req.headers['if-none-match'] === tag) { res.writeHead(304, { etag: tag, 'cache-control': 'no-cache' }); return res.end(); }
      res.writeHead(200, { ...common, etag: tag, 'cache-control': 'no-cache' }); return res.end(`v${version}`);
    }
    case '/vary': res.writeHead(200, { ...common, 'cache-control': 'max-age=60', vary: 'X-Lang' }); return res.end(req.headers['x-lang']);
    case '/swr': res.writeHead(200, { ...common, 'cache-control': 'max-age=1, stale-while-revalidate=60' }); return res.end(`v${version}`);
    case '/post': res.writeHead(200, { ...common, 'cache-control': 'max-age=60' }); return res.end('ok');
    case '/shared': res.writeHead(200, { ...common, 'cache-control': 'max-age=600' }); return res.end('общая библиотека');
    default: res.writeHead(404); return res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);
  const get = (path, init) => page.evaluate(([p, i]) => fetch(p, i).then((r) => r.text()), [path, init]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // эвристическая свежесть: нет Cache-Control, но есть Last-Modified
  await get('/heuristic'); await get('/heuristic');
  assert.equal(hits['/heuristic'], 1);
  // без валидаторов и без Cache-Control — каждый раз в сеть
  await get('/no-validators'); await get('/no-validators');
  assert.equal(hits['/no-validators'], 2);

  // max-age: свежий ответ из кеша, даже если на сервере новая версия
  assert.equal(await get('/fresh'), 'v1');
  version = 2;
  assert.equal(await get('/fresh'), 'v1');
  assert.equal(hits['/fresh'], 1);

  // Age: 59 при max-age=60 — свежесть кончается через секунду
  await get('/aged');
  await sleep(1200);
  await get('/aged');
  assert.equal(hits['/aged'], 2);

  // no-cache + ETag: каждый раз условный запрос, 304 без тела
  version = 1;
  seen.length = 0;
  assert.equal(await get('/etag'), 'v1');
  assert.equal(await get('/etag'), 'v1');
  assert.deepEqual(seen.map((s) => s.inm), [undefined, '"v1"']);                               // второй — с If-None-Match
  version = 2;
  assert.equal(await get('/etag'), 'v2');                                                     // изменилось — 200 с новым телом

  // Vary: другой вариант заголовка — промах
  await get('/vary', { headers: { 'x-lang': 'ru' } });
  await get('/vary', { headers: { 'x-lang': 'ru' } });
  assert.equal(hits['/vary'], 1);
  assert.equal(await get('/vary', { headers: { 'x-lang': 'en' } }), 'en');
  assert.equal(hits['/vary'], 2);

  // stale-while-revalidate: устаревшее отдаётся сразу, обновление — в фоне
  version = 1;
  assert.equal(await get('/swr'), 'v1');
  version = 2;
  await sleep(1300);
  assert.equal(await get('/swr'), 'v1');                                                      // устаревшее, без ожидания
  await sleep(200);
  assert.equal(hits['/swr'], 2);                                                              // фоновая перепроверка ушла
  assert.equal(await get('/swr'), 'v2');                                                      // теперь в кеше новое
  assert.equal(hits['/swr'], 2);

  // режимы cache у fetch
  version = 3;
  hits['/fresh'] = 0;
  assert.equal(await get('/fresh', { cache: 'force-cache' }), 'v1');                          // взять из кеша
  assert.equal(await get('/fresh', { cache: 'no-store' }), 'v3');                             // мимо кеша
  assert.equal(await get('/fresh'), 'v1');                                                    // no-store кеш не обновил
  assert.equal(await get('/fresh', { cache: 'reload' }), 'v3');                               // мимо кеша, но обновил его
  assert.equal(await get('/fresh'), 'v3');
  assert.equal(hits['/fresh'], 2);

  // POST не кешируется
  await get('/post', { method: 'POST' }); await get('/post', { method: 'POST' });
  assert.equal(hits['/post'], 2);

  // перезагрузка: документ перепроверяется, подресурсы со свежим max-age — нет
  await page.goto(`${base}/page`);
  await page.waitForLoadState('load');
  const before = { page: hits['/page'], js: hits['/app.js'], img: hits['/logo.png'] };
  await page.reload();
  await page.waitForLoadState('load');
  assert.deepEqual({ page: hits['/page'], js: hits['/app.js'], img: hits['/logo.png'] }, { page: before.page + 1, js: before.js, img: before.img });

  // кеш разделён по сайту страницы: тот же URL с другого сайта — снова в сеть
  const fromA = await browser.newPage();
  await fromA.goto(`http://localhost:${port}/`);
  await fromA.evaluate((u) => fetch(u).then((r) => r.text()), `${base}/shared`);
  await fromA.evaluate((u) => fetch(u).then((r) => r.text()), `${base}/shared`);
  assert.equal(hits['/shared'], 1);
  await page.goto(base);
  await page.evaluate((u) => fetch(u).then((r) => r.text()), `${base}/shared`);
  assert.equal(hits['/shared'], 2);                                                            // сайт другой — кеш свой
} finally {
  await browser.close();
  server.close();
}
console.log('cache ok');
