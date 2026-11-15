// Глава 7.12 — «Практика»: вывод генератора, chunk, поиск без лишних страниц.
// run: node practice.mjs
import assert from 'node:assert/strict';

const log = [];
function* gen() { try { const a = yield 1; log.push(`a = ${a}`); yield 2; yield 3; } finally { log.push('finally'); } }
const g = gen();
log.push(g.next('потеряется').value);
log.push(g.next('A').value);
for (const x of g) { log.push(`loop ${x}`); break; }
assert.deepEqual(g.next(), { value: undefined, done: true });
assert.deepEqual(log, [1, 'a = A', 2, 'loop 3', 'finally']);

function* chunk(iterable, size) { let b = []; for (const it of iterable) { b.push(it); if (b.length === size) { yield b; b = []; } } if (b.length) yield b; }
assert.deepEqual([...chunk([1, 2, 3, 4, 5], 2)], [[1, 2], [3, 4], [5]]);
assert.deepEqual([...chunk(new Set('abc'), 2)], [['a', 'b'], ['c']]);
function* ids() { let i = 1; while (true) yield i++; }
const two = chunk(ids(), 100).take(2).toArray();
assert.deepEqual(two.map((b) => b.length), [100, 100]);
assert.equal(two[1][99], 200);

const requested = [];
const fetchPage = async (page, { signal } = {}) => { requested.push(page); await new Promise((r) => setTimeout(r, 2)); return { items: [{ price: 900 }, { price: page === 2 ? 450 : 800 }], hasMore: page < 5 }; };
async function* allProducts(signal) { for (let page = 1; ; page++) { const { items, hasMore } = await fetchPage(page, { signal }); yield* items; if (!hasMore) return; } }
async function findCheap(limit) { const c = new AbortController(); try { for await (const p of allProducts(c.signal)) if (p.price < limit) return p; return null; } finally { c.abort(); } }
assert.deepEqual(await findCheap(500), { price: 450 });
assert.deepEqual(requested, [1, 2]);
console.log('ok');
