// Проверки к 17.04 в Chromium на двух origin (разные порты — разные origin): SOP запрещает чтение чужого
// ответа, CORS его разрешает при нужном заголовке, preflight для непростого запроса, запрет wildcard с
// credentials; и что запрос доходит до сервера, даже когда браузер блокирует чтение ответа.
// Плюс в Node — разбор origin и отличие origin от site. Атаки не выполняются, проверяется работа правил.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { withPage } from '../../_lib/browser.mjs';

// --- origin = схема + хост + порт ---
const originOf = (url) => { const u = new URL(url); return `${u.protocol}//${u.host}`; };
const sameOrigin = (a, b) => originOf(a) === originOf(b);
assert.ok(sameOrigin('https://app.com/page', 'https://app.com/other'));
assert.ok(!sameOrigin('https://app.com', 'http://app.com'));        // схема
assert.ok(!sameOrigin('https://app.com', 'https://api.app.com'));   // хост
assert.ok(!sameOrigin('https://app.com', 'https://app.com:3000'));  // порт

// --- site = схема + регистрируемый домен (eTLD+1), без субдомена и порта ---
const siteOf = (url) => { const u = new URL(url); return `${u.protocol}//${u.hostname.split('.').slice(-2).join('.')}`; };
const sameSite = (a, b) => siteOf(a) === siteOf(b);
assert.ok(sameSite('https://a.app.com', 'https://b.app.com'));      // субдомены — один site…
assert.ok(!sameOrigin('https://a.app.com', 'https://b.app.com'));   // …но разные origin
assert.ok(sameSite('https://app.com:443', 'https://app.com:3000')); // порт на site не влияет
assert.ok(!sameSite('https://app.com', 'https://evil.com'));

// --- CORS в браузере на двух настоящих origin ---
let hits = [];
const api = createServer((req, res) => {
  hits.push(`${req.method} ${req.url.split('?')[0]}`);
  const origin = req.headers.origin;
  const mode = new URL(req.url, 'http://x').searchParams.get('allow'); // exact | wild | none
  const h = { 'content-type': 'application/json' };
  if (mode === 'exact' && origin) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'GET,PUT', 'access-control-allow-headers': 'x-token' });
  if (mode === 'wild') h['access-control-allow-origin'] = '*';
  if (req.method === 'OPTIONS') { res.writeHead(204, h).end(); return; }
  res.writeHead(200, h).end(JSON.stringify({ balance: 100 }));
});
await new Promise((r) => api.listen(0, r));
const apiBase = `http://localhost:${api.address().port}`;
const site = createServer((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><h1>app</h1>'); });
await new Promise((r) => site.listen(0, r));
const siteBase = `http://localhost:${site.address().port}`;
assert.notEqual(apiBase, siteBase); // разные порты → разные origin, CORS применяется

await withPage(async (page) => {
  await page.goto(siteBase + '/', { waitUntil: 'load' });
  const call = (url, opts) => page.evaluate(async ([url, opts]) => {
    try { const r = await fetch(url, opts); return { ok: true, status: r.status, body: await r.text() }; }
    catch (e) { return { ok: false, err: e.name }; }
  }, [url, opts]);

  // без Access-Control-Allow-Origin браузер не даёт прочитать ответ
  hits = [];
  const blocked = await call(`${apiBase}/data?allow=none`);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.err, 'TypeError');
  assert.deepEqual(hits, ['GET /data']);          // но запрос ДОШЁЛ до сервера — CORS про чтение, а не про отправку

  // с правильным заголовком чтение разрешено
  const allowed = await call(`${apiBase}/data?allow=exact`);
  assert.equal(allowed.ok, true);
  assert.equal(JSON.parse(allowed.body).balance, 100);

  // непростой запрос (PUT + кастомный заголовок) → сначала preflight OPTIONS
  hits = [];
  const put = await call(`${apiBase}/data?allow=exact`, { method: 'PUT', headers: { 'x-token': '1' } });
  assert.equal(put.ok, true);
  assert.deepEqual(hits, ['OPTIONS /data', 'PUT /data']); // браузер спросил разрешение до реального запроса

  // wildcard нельзя сочетать с credentials — браузер блокирует
  const wildCreds = await call(`${apiBase}/data?allow=wild`, { credentials: 'include' });
  assert.equal(wildCreds.ok, false);
  assert.equal(wildCreds.err, 'TypeError');
});
api.close(); site.close();

// --- что SOP разрешает и запрещает (сводно) ---
const sop = { readCrossOriginResponse: false, accessForeignIframeDom: false, embedImgScriptLink: true, submitFormCrossOrigin: true };
assert.equal(sop.readCrossOriginResponse, false); // чтение запрещено…
assert.equal(sop.submitFormCrossOrigin, true);    // …а отправка разрешена — поэтому возможен CSRF

console.log('cors ok');
