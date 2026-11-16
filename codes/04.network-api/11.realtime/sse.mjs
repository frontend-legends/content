// Проверки к 4.11 в Chromium: SSE — формат событий (event, id, многострочный data), onmessage видит только
// события без имени; после обрыва браузер сам переподключается через retry и присылает Last-Event-ID;
// ответ 204 останавливает переподключение; по HTTP/1.1 шесть открытых EventSource занимают все соединения
// к хосту, и седьмой запрос ждёт. Длинный опрос с курсором не теряет событий между запросами.
// Запуск: cd codes && node run.mjs 04.network-api/11.realtime
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const connections = [];
let notificationStreams = 0;
const events = [];                                                                               // для длинного опроса
let waiting = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/prices') {
    connections.push(req.headers['last-event-id'] ?? null);
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const from = Number(req.headers['last-event-id'] ?? 0);
    res.write('retry: 200\n\n');
    res.write(`id: ${from + 1}\nevent: price\ndata: {"id":7,"price":${450 + from}}\n\n`);
    res.write(`id: ${from + 2}\ndata: строка 1\ndata: строка 2\n\n`);
    if (from === 0) setTimeout(() => res.end(), 50);                                                // первый раз сервер обрывает
    return;
  }
  if (url.pathname === '/api/notifications') {
    notificationStreams++;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const timer = setInterval(() => res.write(`data: заказ ${notificationStreams}\n\n`), 100);
    req.on('close', () => clearInterval(timer));
    return;
  }
  if (url.pathname === '/done') { res.writeHead(204); return res.end(); }
  if (url.pathname === '/hold') { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': открыто\n\n'); return; }
  if (url.pathname === '/ping') { res.writeHead(200, { 'access-control-allow-origin': '*' }); return res.end('pong'); }
  if (url.pathname === '/poll') {
    const cursor = Number(url.searchParams.get('after') ?? 0);
    const reply = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(events.filter((e) => e.id > cursor))); };
    if (events.some((e) => e.id > cursor)) return reply();
    waiting.push(reply);                                                                           // держим запрос, пока нет новостей
    setTimeout(() => { waiting = waiting.filter((w) => w !== reply); if (!res.headersSent) reply(); }, 2000);
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><title>shop</title>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const publish = (text) => { events.push({ id: events.length + 1, text }); const w = waiting; waiting = []; w.forEach((f) => f()); };

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);

  // --- формат и переподключение ---
  const got = await page.evaluate(() => new Promise((resolve) => {
    const log = [];
    const es = new EventSource('/prices');
    es.onmessage = (e) => log.push(['message', e.lastEventId, e.data]);
    es.addEventListener('price', (e) => log.push(['price', e.lastEventId, JSON.parse(e.data).price]));
    es.onerror = () => log.push(['error', es.readyState]);
    setTimeout(() => { es.close(); resolve(log); }, 700);
  }));
  assert.deepEqual(got.slice(0, 4), [
    ['price', '1', 450],
    ['message', '2', 'строка 1\nстрока 2'],                                                       // строки data склеены через \n
    ['error', 0],                                                                                 // 0 — CONNECTING: переподключается
    ['price', '3', 452],
  ]);
  assert.deepEqual(connections.slice(0, 2), [null, '2']);                                        // второй раз — с Last-Event-ID

  // --- 204 останавливает переподключение ---
  const stopped = await page.evaluate(() => new Promise((resolve) => {
    const es = new EventSource('/done');
    es.onerror = () => setTimeout(() => resolve(es.readyState), 300);
  }));
  assert.equal(stopped, 2);                                                                       // CLOSED

  // --- шесть SSE по HTTP/1.1 занимают все соединения к хосту ---
  const blocked = await page.evaluate(async () => {
    const streams = Array.from({ length: 6 }, () => new EventSource('/hold'));
    await new Promise((r) => setTimeout(r, 300));
    const ping = () => Promise.race([fetch('/ping').then((r) => r.text()), new Promise((r) => setTimeout(() => r('ждёт'), 800))]);
    const before = await ping();
    streams[0].close();
    const after = await ping();
    streams.forEach((s) => s.close());
    return { before, after };
  });
  assert.deepEqual(blocked, { before: 'ждёт', after: 'pong' });

  // --- практика: один поток на все вкладки, ведущая — по замку Web Locks ---
  const leaderScript = () => {
    window.got = [];
    const channel = new BroadcastChannel('notifications');
    navigator.locks.request('notifications-leader', () => new Promise(() => {
      const es = new EventSource('/api/notifications');
      es.onmessage = (e) => { window.got.push(e.data); channel.postMessage(e.data); };
    }));
    channel.onmessage = (e) => window.got.push(e.data);
  };
  const context = await browser.newContext();
  const tabs = [];
  for (let i = 0; i < 3; i++) {
    const tab = await context.newPage();
    await tab.goto(base);
    await tab.evaluate(leaderScript);
    tabs.push(tab);
  }
  await tabs[0].waitForTimeout(400);
  assert.equal(notificationStreams, 1);                                                          // один поток на три вкладки
  for (const tab of tabs) assert.ok((await tab.evaluate(() => window.got.length)) > 0);
  await tabs[0].close();                                                                         // ведущая закрылась
  await tabs[1].waitForTimeout(400);
  assert.equal(notificationStreams, 2);                                                          // замок перешёл, поток открыт заново
  assert.ok((await tabs[2].evaluate(() => window.got.at(-1))) === 'заказ 2');
  await context.close();
} finally {
  await browser.close();
}

// --- длинный опрос с курсором ---
const received = [];
let after = 0;
const poller = (async () => {
  while (received.length < 3) {
    const batch = await (await fetch(`${base}/poll?after=${after}`)).json();
    for (const e of batch) { received.push(e.text); after = e.id; }
  }
})();
setTimeout(() => publish('заказ принят'), 50);
setTimeout(() => { publish('заказ собран'); publish('заказ отправлен'); }, 150);                  // два события между запросами
await poller;
assert.deepEqual(received, ['заказ принят', 'заказ собран', 'заказ отправлен']);
server.close();
console.log('sse ok');
