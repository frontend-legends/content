// Проверки к 4.11 в Chromium и Node: рукопожатие WebSocket — Upgrade, Sec-WebSocket-Key и ответ 101
// с Sec-WebSocket-Accept = base64(sha1(key + GUID)); кука сайта уходит в рукопожатии, свои заголовки
// браузер задать не может; границы сообщений сохраняются; bufferedAmount растёт сразу после send;
// браузер сам отвечает на ping; коды закрытия: свой код и причина, 1006 при обрыве; соединение с чужого
// сайта проходит, пока сервер не проверяет Origin; переподключение с задержкой и возобновлением с курсора.
// Запуск: cd codes && node run.mjs 04.network-api/11.realtime
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const handshakes = [];
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'session=s1; Path=/; HttpOnly; SameSite=Lax' });
  res.end('<!doctype html><title>чат</title>');
});
const allowed = new Set();
const wss = new WebSocketServer({
  server,
  verifyClient: ({ req, origin }) => !req.url.startsWith('/strict') || allowed.has(origin),
});
wss.on('headers', (headers, req) => handshakes.push({ req: req.headers, res: headers }));
let pongs = 0;
wss.on('connection', (ws, req) => {
  ws.on('pong', () => { pongs++; });
  ws.on('message', (data, isBinary) => {
    const text = isBinary ? `бинарное ${data.length}` : data.toString();
    if (text === 'закрой') return ws.close(4001, 'сессия истекла');
    if (text === 'оборви') return ws.terminate();
    if (text === 'пинг') return ws.ping();
    ws.send(`эхо: ${text}`);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
allowed.add(base);

const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  await page.goto(base);

  // --- рукопожатие, сообщения, bufferedAmount ---
  const chat = await page.evaluate((url) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    const log = [];
    ws.onopen = () => {
      ws.send('привет');
      ws.send('как дела');
      ws.send(new Uint8Array(1000));
      const big = new Uint8Array(20 * 1024 * 1024);
      ws.send(big);
      log.push(['buffered', ws.bufferedAmount > 0]);
      ws.send('пинг');
      ws.send('закрой');
    };
    ws.onmessage = (e) => log.push(['message', e.data]);
    ws.onclose = (e) => { log.push(['close', e.code, e.reason, e.wasClean]); resolve(log); };
  }), `ws://127.0.0.1:${port}/chat`);
  assert.deepEqual(chat, [
    ['buffered', true],
    ['message', 'эхо: привет'],                                                                   // границы сообщений сохранены
    ['message', 'эхо: как дела'],
    ['message', 'эхо: бинарное 1000'],
    ['message', `эхо: бинарное ${20 * 1024 * 1024}`],
    ['close', 4001, 'сессия истекла', true],
  ]);
  assert.equal(pongs, 1);                                                                         // браузер ответил на ping сам

  const { req, res } = handshakes[0];
  assert.equal(req.upgrade, 'websocket');
  assert.equal(req.origin, base);
  assert.equal(req.cookie, 'session=s1');                                                         // кука ушла в рукопожатии
  assert.equal(res[0], 'HTTP/1.1 101 Switching Protocols');
  const accept = createHash('sha1').update(req['sec-websocket-key'] + GUID).digest('base64');
  assert.ok(res.includes(`Sec-WebSocket-Accept: ${accept}`));

  // --- обрыв без закрывающего кадра — 1006 ---
  const dropped = await page.evaluate((url) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    ws.onopen = () => ws.send('оборви');
    ws.onclose = (e) => resolve([e.code, e.wasClean]);
  }), `ws://127.0.0.1:${port}/chat`);
  assert.deepEqual(dropped, [1006, false]);

  // --- свои заголовки задать нельзя: второй аргумент — подпротоколы ---
  const headersTry = await page.evaluate((url) => { try { new WebSocket(url, { headers: { authorization: 'x' } }); return 'создан'; } catch (e) { return e.name; } }, `ws://127.0.0.1:${port}/chat`);
  assert.equal(headersTry, 'SyntaxError');

  // --- чужой сайт: CORS не действует, защищает только проверка Origin ---
  const other = await browser.newPage();
  await other.goto(`http://localhost:${port}/`);
  const fromOther = (path) => other.evaluate((url) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    ws.onopen = () => { resolve('открыто'); ws.close(); };
    ws.onclose = (e) => resolve(`закрыто ${e.code}`);
  }), `ws://127.0.0.1:${port}${path}`);
  assert.equal(await fromOther('/chat'), 'открыто');                                             // без проверки — пустили
  assert.equal(await fromOther('/strict'), 'закрыто 1006');                                       // сервер отклонил рукопожатие
  assert.equal(handshakes.at(-1).req.origin, `http://localhost:${port}`);                         // Origin чужого сайта сервер видит
  assert.equal(handshakes.at(-1).req.cookie, undefined);                                          // Lax-кука в межсайтовое рукопожатие не ушла
} finally {
  await browser.close();
}

// --- переподключение с курсором (WebSocket из Node) ---
const history = [];
const feed = new WebSocketServer({ port: 0 });
let drops = 0;
feed.on('connection', (ws, req) => {
  const after = Number(new URL(req.url, 'http://x').searchParams.get('after') ?? 0);
  for (const m of history.filter((h) => h.id > after)) ws.send(JSON.stringify(m));                // догоняем пропущенное
  ws.on('message', () => {});
  if (drops < 2) { drops++; setTimeout(() => ws.terminate(), 30); }                               // первые два соединения рвутся
});
await new Promise((r) => feed.on('listening', r));
for (let i = 1; i <= 5; i++) history.push({ id: i, text: `событие ${i}` });

const seen = [];
const delays = [];
await new Promise((done) => {
  let lastId = 0;
  let attempt = 0;
  const connect = () => {
    const ws = new WebSocket(`ws://127.0.0.1:${feed.address().port}/?after=${lastId}`);
    ws.onopen = () => { attempt = 0; };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id <= lastId) return;                                                                  // дубль после переподключения
      lastId = m.id;
      seen.push(m.id);
      if (seen.length === 7) { ws.close(); done(); }
    };
    ws.onclose = () => {
      if (seen.length === 7) return;
      const delay = Math.min(1000, 50 * 2 ** attempt++) * (0.5 + Math.random() / 2);
      delays.push(delay);
      setTimeout(connect, delay);
    };
  };
  connect();
  setTimeout(() => { history.push({ id: 6, text: 'событие 6' }, { id: 7, text: 'событие 7' }); }, 120);
});
assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7]);                                                    // ничего не потеряно и не повторено
assert.equal(delays.length, 2);
feed.close();
server.close();
console.log('websocket ok');
