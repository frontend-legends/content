// Глава 7.01 — «Гонки без потоков»: устаревший ответ поиска и check-then-act (balance === -60)
// run: node races.mjs
import assert from 'node:assert/strict';

const delay = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
let shown;
async function search(q) { const res = await delay(q === 'r' ? 50 : 10, 'results:' + q); shown = res; }
search('r'); search('re');
await delay(100); console.log('naive shown =', shown); assert.equal(shown, 'results:r'); // устаревший ответ победил
let lastId = 0;
async function search2(q) { const id = ++lastId; const res = await delay(q === 'r' ? 50 : 10, 'results:' + q); if (id === lastId) shown = res; }
search2('r'); search2('re');
await delay(100); console.log('guarded shown =', shown); assert.equal(shown, 'results:re');
let balance = 100;
async function withdraw(n) { if (balance >= n) { await delay(5); balance -= n; } }
await Promise.all([withdraw(80), withdraw(80)]); console.log('check-then-act balance =', balance); assert.equal(balance, -60);
