// Глава 9.05, «Практика», задача про поиск: abort() после прихода заголовков, пока читается тело,
// отклоняет уже r.json() — тоже с AbortError. Поэтому catch стоит в конце цепочки.
// run: node abort-body.mjs  (настоящий fetch Node.js и локальный HTTP-сервер)
import assert from 'node:assert/strict';
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.write('["re",'); // заголовки и начало тела ушли, конец придёт позже
  setTimeout(() => res.end('"react"]'), 200);
});
await new Promise((r) => server.listen(0, r));

const controller = new AbortController();
const r = await fetch(`http://localhost:${server.address().port}/`, { signal: controller.signal });
assert.equal(r.status, 200); // fetch уже выполнился
const body = r.json();
controller.abort();
await assert.rejects(body, (e) => e.name === 'AbortError');

server.closeAllConnections();
server.close();
console.log('abort-body: ok');
