// Проверки к 4.04 в Chromium на трёх origin (две страницы и API на разных портах и хостах):
// какие запросы идут без preflight, кеш preflight (Access-Control-Max-Age), чтение заголовков ответа
// (Access-Control-Expose-Headers), Allow-Headers: * и Authorization (Chromium пропускает), preflight без кук и
// с ответом 401 блокирует сам запрос, credentials и *, режим no-cors даёт непрозрачный ответ,
// кеш без Vary: Origin отдаёт чужое разрешение, после межсайтового редиректа Origin становится null.
// Запуск: cd codes && node run.mjs 04.network-api/4.cors
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const log = [];
const cfg = { allowHeaders: 'content-type, x-request-id', maxAge: null, preflightStatus: 204, allowOrigin: 'echo', credentials: false };
const cache = new Map();                                                                         // «CDN», который забыл про Vary
let apiOrigin2;

const api = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const origin = req.headers.origin;
  log.push({ method: req.method, path: url.pathname, origin, cookie: req.headers.cookie, auth: req.headers.authorization, ct: req.headers['content-type'] });
  const acao = cfg.allowOrigin === 'echo' ? origin : cfg.allowOrigin;
  const cors = {
    ...(acao && { 'access-control-allow-origin': acao }),
    ...(cfg.credentials && { 'access-control-allow-credentials': 'true' }),
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(cfg.preflightStatus, {
      ...cors,
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
      'access-control-allow-headers': cfg.allowHeaders,
      ...(cfg.maxAge !== null && { 'access-control-max-age': String(cfg.maxAge) }),
    });
    return res.end();
  }
  if (url.pathname === '/cached') {                                                              // кеш по URL без учёта Origin
    if (!cache.has(req.url)) cache.set(req.url, { 'access-control-allow-origin': origin, 'content-type': 'application/json' });
    res.writeHead(200, cache.get(req.url));
    return res.end('[]');
  }
  if (url.pathname === '/moved') {
    res.writeHead(302, { ...cors, location: `${apiOrigin2}/target` });
    return res.end();
  }
  if (url.pathname === '/target') {
    res.writeHead(200, { 'access-control-allow-origin': origin ?? '*', 'content-type': 'text/plain' });
    return res.end(String(origin));
  }
  res.writeHead(200, { ...cors, 'content-type': 'application/json', 'x-total-count': '42', ...(url.pathname === '/exposed' && { 'access-control-expose-headers': 'X-Total-Count' }) });
  res.end('{"items":[]}');
});
await new Promise((r) => api.listen(0, '127.0.0.1', r));
const apiOrigin = `http://127.0.0.1:${api.address().port}`;
const api2 = http.createServer((req, res) => api.emit('request', req, res));
await new Promise((r) => api2.listen(0, '127.0.0.1', r));
apiOrigin2 = `http://localhost:${api2.address().port}`;

const site = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>shop</title>'); });
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const siteA = `http://localhost:${site.address().port}`;
const siteB = `http://127.0.0.1:${site.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(siteA);
  const call = (path, init) => page.evaluate(async ([u, i]) => {
    try {
      const r = await fetch(u, i);
      return { status: r.status, type: r.type, total: r.headers.get('x-total-count'), ct: r.headers.get('content-type'), body: await r.text() };
    } catch (e) { return { error: `${e.name}: ${e.message}` }; }
  }, [`${apiOrigin}${path}`, init]);
  const methodsSeen = () => log.splice(0).map((l) => l.method);

  // --- что отправляется без preflight ---
  const cases = [
    ['GET', {}],
    ['POST text/plain', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'qty=2' }],
    ['POST form', { method: 'POST', body: new URLSearchParams({ qty: '2' }).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' } }],
    ['GET Accept-Language', { headers: { 'accept-language': 'ru' } }],
    ['POST json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"qty":2}' }],
    ['GET X-Request-Id', { headers: { 'x-request-id': '1' } }],
    ['PUT', { method: 'PUT', body: '{}' }],
    ['DELETE', { method: 'DELETE' }],
  ];
  const preflighted = {};
  for (const [name, init] of cases) {
    await call(`/items?case=${encodeURIComponent(name)}`, init);
    preflighted[name] = methodsSeen()[0] === 'OPTIONS';
  }
  assert.deepEqual(preflighted, {
    'GET': false, 'POST text/plain': false, 'POST form': false, 'GET Accept-Language': false,
    'POST json': true, 'GET X-Request-Id': true, 'PUT': true, 'DELETE': true,
  });

  // --- кеш preflight ---
  const twice = async (path) => {
    for (let i = 0; i < 2; i++) await call(path, { method: 'PUT', body: '{}' });
    return methodsSeen();
  };
  cfg.maxAge = 0;
  assert.deepEqual(await twice('/cart/0'), ['OPTIONS', 'PUT', 'OPTIONS', 'PUT']);
  cfg.maxAge = 600;
  assert.deepEqual(await twice('/cart/600'), ['OPTIONS', 'PUT', 'PUT']);                         // второй раз — без preflight
  cfg.maxAge = null;
  assert.deepEqual(await twice('/cart/default'), ['OPTIONS', 'PUT', 'PUT']);                    // без заголовка — кеш 5 секунд
  await new Promise((r) => setTimeout(r, 5200));
  await call('/cart/default', { method: 'PUT', body: '{}' });
  assert.deepEqual(methodsSeen(), ['OPTIONS', 'PUT']);

  // --- чтение заголовков ответа ---
  assert.equal((await call('/items')).total, null);                                               // не отдан наружу
  assert.equal((await call('/items')).ct, 'application/json');                                    // безопасный заголовок виден
  assert.equal((await call('/exposed')).total, '42');
  methodsSeen();

  // --- Allow-Headers: * — по спецификации Fetch не покрывает Authorization, но Chromium пока пропускает ---
  cfg.allowHeaders = '*';
  assert.equal((await call('/me?star', { headers: { 'x-request-id': '1' } })).status, 200);
  assert.equal((await call('/me?star-auth', { headers: { authorization: 'Bearer t' } })).status, 200);
  cfg.allowHeaders = '*, authorization';
  assert.equal((await call('/me?explicit', { headers: { authorization: 'Bearer t' } })).status, 200);
  const preflight = log.filter((l) => l.method === 'OPTIONS').at(-1);
  assert.equal(preflight.auth, undefined);                                                        // сам preflight без Authorization
  cfg.allowHeaders = 'content-type, x-request-id';
  methodsSeen();

  // --- preflight отвечает 401: запрос не отправляется вовсе ---
  cfg.preflightStatus = 401;
  const blocked = await call('/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.match(blocked.error, /Failed to fetch/);
  assert.deepEqual(methodsSeen(), ['OPTIONS']);
  cfg.preflightStatus = 204;

  // --- credentials: * запрещена, нужен точный origin и Allow-Credentials ---
  cfg.allowOrigin = '*';
  assert.match((await call('/me?cred-star', { credentials: 'include' })).error, /Failed to fetch/);
  assert.equal((await call('/me?no-cred-star')).status, 200);
  cfg.allowOrigin = 'echo';
  cfg.credentials = true;
  assert.equal((await call('/me?cred-echo', { credentials: 'include' })).status, 200);
  cfg.credentials = false;
  methodsSeen();

  // --- no-cors: запрос уходит, ответ непрозрачный ---
  const opaque = await call('/no-cors', { mode: 'no-cors' });
  assert.deepEqual(opaque, { status: 0, type: 'opaque', total: null, ct: null, body: '' });
  assert.deepEqual(methodsSeen(), ['GET']);

  // --- кеш без Vary: Origin ---
  await call('/cached');                                                                          // закешировано разрешение для siteA
  const other = await browser.newPage();
  await other.goto(siteB);
  const fromB = await other.evaluate((u) => fetch(u).then(() => 'ok', (e) => e.name), `${apiOrigin}/cached`);
  assert.equal(fromB, 'TypeError');                                                               // siteB получил ACAO для siteA

  // --- редирект на другой origin: Origin становится null ---
  const redirected = await call('/moved');
  assert.equal(redirected.body, 'null');
} finally {
  await browser.close();
  api.close();
  api2.close();
  site.close();
}
console.log('cors ok');
