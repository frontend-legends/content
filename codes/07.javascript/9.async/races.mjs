// Глава 7.09 — гонки и отмена: поздний ответ затирает новый; проверка «последний запрос» и AbortController;
// отмена настоящего fetch, AbortSignal.timeout, AbortSignal.any.
// run: node races.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// поиск: ответы приходят не в том порядке, в котором ушли запросы
const latency = { ч: 50, ча: 10 };
const search = (q, signal) => new Promise((resolve, reject) => {
  const t = setTimeout(() => resolve(`результаты для «${q}»`), latency[q]);
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); });
});
{
  let shown;
  const onInput = async (q) => { shown = await search(q); };
  onInput('ч'); onInput('ча');
  await wait(70);
  assert.equal(shown, 'результаты для «ч»');               // старый ответ пришёл последним и победил
}
{
  let shown; let latest = 0;
  const onInput = async (q) => { const id = ++latest; const r = await search(q); if (id === latest) shown = r; };
  onInput('ч'); onInput('ча');
  await wait(70);
  assert.equal(shown, 'результаты для «ча»');
}
{
  let shown; let controller; const aborted = [];
  const onInput = async (q) => {
    controller?.abort();
    controller = new AbortController();
    try { shown = await search(q, controller.signal); } catch (e) { aborted.push(e.name); }
  };
  onInput('ч'); onInput('ча');
  await wait(70);
  assert.equal(shown, 'результаты для «ча»');
  assert.deepEqual(aborted, ['AbortError']);
}

// настоящий fetch: отмена, тайм-аут, объединение сигналов
const server = http.createServer((req, res) => { setTimeout(() => res.end('slow'), 2000).unref(); });
await new Promise((r) => server.listen(0, r));
const url = `http://127.0.0.1:${server.address().port}/`;
{
  const c = new AbortController();
  setTimeout(() => c.abort(), 20);
  await assert.rejects(fetch(url, { signal: c.signal }), { name: 'AbortError' });
}
await assert.rejects(fetch(url, { signal: AbortSignal.timeout(20) }), { name: 'TimeoutError' });
{
  const user = new AbortController();
  const signal = AbortSignal.any([user.signal, AbortSignal.timeout(1000)]);
  setTimeout(() => user.abort(), 10);
  await assert.rejects(fetch(url, { signal }), { name: 'AbortError' });
}
server.closeAllConnections(); server.close();
console.log('ok');
