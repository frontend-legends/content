// Глава 7.10 — «Практика»: fetch не отклоняется на 404/500, своя HttpError с cause, повтор только временных ошибок.
// run: node practice.mjs
import assert from 'node:assert/strict';
import http from 'node:http';

let calls = 0;
const server = http.createServer((req, res) => {
  calls++;
  if (req.url === '/missing') { res.statusCode = 404; return res.end('{"error":"not found"}'); }
  if (req.url === '/flaky') { res.statusCode = calls % 3 === 0 ? 200 : 503; return res.end(res.statusCode === 200 ? '{"ok":true}' : 'busy'); }
  if (req.url === '/html') { res.statusCode = 200; return res.end('<html>maintenance</html>'); }
  res.end('{"id":7}');
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

// fetch выполняется на 404
const raw = await fetch(`${base}/missing`);
assert.equal(raw.ok, false);
assert.equal(raw.status, 404);

class HttpError extends Error {
  constructor(status, url, options) { super(`HTTP ${status} для ${url}`, options); this.name = 'HttpError'; this.status = status; }
}
async function getJson(url, init) {
  let res;
  try { res = await fetch(url, init); } catch (cause) { throw new HttpError(0, url, { cause }); }
  if (!res.ok) throw new HttpError(res.status, url);
  try { return await res.json(); } catch (cause) { throw new HttpError(res.status, url, { cause }); }
}
assert.deepEqual(await getJson(`${base}/ok`), { id: 7 });
await assert.rejects(getJson(`${base}/missing`), (e) => e instanceof HttpError && e.status === 404);
await assert.rejects(getJson(`${base}/html`), (e) => e instanceof HttpError && e.cause instanceof SyntaxError);
await assert.rejects(getJson('http://127.0.0.1:1/'), (e) => e.status === 0 && e.cause instanceof TypeError);

// повтор с паузой — только для временных ошибок
const isRetryable = (e) => e instanceof HttpError && (e.status === 0 || e.status === 429 || e.status >= 500);
async function withRetry(fn, { retries = 3, baseDelay = 5 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
    }
  }
}
calls = 0;
assert.deepEqual(await withRetry(() => getJson(`${base}/flaky`)), { ok: true });
assert.equal(calls, 3);
calls = 0;
await assert.rejects(withRetry(() => getJson(`${base}/missing`)), (e) => e.status === 404);
assert.equal(calls, 1); // 404 не повторяется

// return в finally проглатывает ошибку
function save() { try { throw new Error('диск полон'); } finally { return 'сохранено'; } }
assert.equal(save(), 'сохранено');
server.close();
console.log('ok');
