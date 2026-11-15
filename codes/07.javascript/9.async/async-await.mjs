// Глава 7.09 — async/await: async всегда возвращает промис, return await в try ловит ошибку, а return — нет;
// последовательно против параллельно; forEach не ждёт; пул с ограничением параллельности.
// run: node async-await.mjs
import assert from 'node:assert/strict';
const wait = (ms, v, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(new Error(v)) : res(v)), ms));

async function value() { return 42; }
assert.ok(value() instanceof Promise);
async function throws() { throw new Error('async throw'); }
await assert.rejects(throws(), /async throw/);              // throw становится отклонением, а не исключением при вызове

// return без await внутри try — ошибка пролетает мимо catch
async function withoutAwait() { try { return wait(5, 'fail', true); } catch { return 'поймано'; } }
async function withAwait() { try { return await wait(5, 'fail', true); } catch { return 'поймано'; } }
await assert.rejects(withoutAwait(), /fail/);
assert.equal(await withAwait(), 'поймано');

// последовательно и параллельно
let t = performance.now();
await wait(30); await wait(30); await wait(30);
const seq = performance.now() - t;
t = performance.now();
await Promise.all([wait(30), wait(30), wait(30)]);
const par = performance.now() - t;
assert.ok(seq >= 85 && par < 60, `последовательно ${seq.toFixed(0)} мс, параллельно ${par.toFixed(0)} мс`);

// forEach не ждёт асинхронный колбэк
const done = [];
[1, 2, 3].forEach(async (n) => { await wait(5); done.push(n); });
assert.deepEqual(done, []);                                  // код после forEach уже здесь
await wait(20);
assert.equal(done.length, 3);
const ordered = [];
for (const n of [3, 1, 2]) { await wait(n * 3); ordered.push(n); }
assert.deepEqual(ordered, [3, 1, 2]);

// пул: не больше limit задач одновременно, порядок результатов сохраняется
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
let active = 0, peak = 0;
const out = await mapLimit([5, 1, 4, 2, 3, 1], 2, async (ms) => { active++; peak = Math.max(peak, active); await wait(ms * 3); active--; return ms * 10; });
assert.equal(peak, 2);
assert.deepEqual(out, [50, 10, 40, 20, 30, 10]);
console.log('ok');
