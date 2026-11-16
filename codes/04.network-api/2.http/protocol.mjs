// Проверки к 4.02 в Node: HTTP/1.1 — текст поверх TCP (сырой запрос через сокет), тело размечается
// Content-Length или chunked, HEAD отдаёт заголовки без тела, имена заголовков не зависят от регистра,
// сжатие gzip и brotli и прозрачная распаковка в fetch, согласование содержимого по Accept.
// Запуск: cd codes && node run.mjs 04.network-api/2.http
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import zlib from 'node:zlib';

const catalog = JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ id: i, title: `Чай №${i}`, price: 300 + (i % 50) * 10, inStock: i % 3 !== 0 })));
const server = http.createServer((req, res) => {
  if (req.url === '/stream') {                                                                 // длина заранее неизвестна
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.write('первый кусок\n');
    setTimeout(() => res.end('второй кусок\n'), 20);
    return;
  }
  if (req.url === '/products') {
    const accept = req.headers['accept-encoding'] ?? '';
    const enc = accept.includes('br') ? 'br' : accept.includes('gzip') ? 'gzip' : null;
    const body = enc === 'br' ? zlib.brotliCompressSync(catalog) : enc === 'gzip' ? zlib.gzipSync(catalog) : Buffer.from(catalog);
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': body.length, vary: 'Accept-Encoding', ...(enc && { 'content-encoding': enc }) });
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  if (req.url === '/greeting') {
    const html = (req.headers.accept ?? '').includes('text/html');
    res.writeHead(200, { 'content-type': html ? 'text/html; charset=utf-8' : 'application/json', vary: 'Accept' });
    return res.end(html ? '<p>Привет</p>' : '{"text":"Привет"}');
  }
  res.writeHead(404, { 'content-type': 'text/plain' }).end('нет такого');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

// --- сырой HTTP/1.1 ---
const raw = await new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1', () => {
    socket.write('GET /nothing HTTP/1.1\r\nHost: shop.example\r\nConnection: close\r\n\r\n');
  });
  let data = '';
  socket.on('data', (d) => { data += d; });
  socket.on('end', () => resolve(data));
});
const [head, body] = raw.split('\r\n\r\n');
const [statusLine, ...headerLines] = head.split('\r\n');
assert.equal(statusLine, 'HTTP/1.1 404 Not Found');
assert.ok(headerLines.includes('content-type: text/plain'));                                  // имя — как записал сервер
assert.ok(headerLines.some((h) => /^Transfer-Encoding: chunked$/i.test(h) || /^Content-Length: \d+$/i.test(h)));
assert.match(body, /нет такого/);

// --- chunked: длина неизвестна заранее ---
const streamed = await new Promise((resolve) => http.get(`${base}/stream`, (res) => {
  let text = '';
  res.setEncoding('utf8').on('data', (d) => { text += d; }).on('end', () => resolve({ te: res.headers['transfer-encoding'], cl: res.headers['content-length'], text }));
}));
assert.deepEqual(streamed, { te: 'chunked', cl: undefined, text: 'первый кусок\nвторой кусок\n' });

// --- HEAD: те же заголовки, без тела ---
const headRes = await fetch(`${base}/products`, { method: 'HEAD', headers: { 'accept-encoding': 'identity' } });
assert.equal(headRes.headers.get('content-length'), String(Buffer.byteLength(catalog)));
assert.equal((await headRes.arrayBuffer()).byteLength, 0);

// --- имена заголовков без учёта регистра ---
assert.equal(headRes.headers.get('Content-Type'), headRes.headers.get('content-type'));

// --- сжатие ---
const sizes = {
  plain: Buffer.byteLength(catalog),
  gzip: zlib.gzipSync(catalog).length,
  br: zlib.brotliCompressSync(catalog).length,
};
assert.ok(sizes.plain > 17000 && sizes.plain < 20000 && sizes.gzip < 2500 && sizes.br < 1024, JSON.stringify(sizes));
const viaFetch = await fetch(`${base}/products`);                                              // fetch сам шлёт Accept-Encoding
assert.ok(['gzip', 'br'].includes(viaFetch.headers.get('content-encoding')));
assert.equal(viaFetch.headers.get('vary'), 'Accept-Encoding');
assert.equal((await viaFetch.json()).length, 300);                                            // распаковано прозрачно

// --- согласование содержимого ---
assert.equal(await (await fetch(`${base}/greeting`, { headers: { accept: 'text/html' } })).text(), '<p>Привет</p>');
assert.deepEqual(await (await fetch(`${base}/greeting`, { headers: { accept: 'application/json' } })).json(), { text: 'Привет' });

server.close();
console.log('protocol ok', sizes);
