// Глава 7.09 — «Практика»: вывод цепочки, водопад против Promise.all, forEach против Promise.all.
// run: node practice.mjs
import assert from 'node:assert/strict';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const log = [];
const p = new Promise((resolve) => { log.push('1'); resolve('A'); resolve('B'); });
log.push('2');
await p.then((v) => { log.push(`3 ${v}`); throw new Error('oops'); })
  .then(() => log.push('4'))
  .catch((e) => { log.push(`5 ${e.message}`); return 'recovered'; })
  .finally(() => log.push('6'))
  .then((v) => log.push(`7 ${v}`));
assert.deepEqual(log, ['1', '2', '3 A', '5 oops', '6', '7 recovered']);

const load = (v) => wait(30).then(() => v);
let t = performance.now();
const [a, b, c] = await Promise.all([load('p'), load('r'), load('s')]);
assert.ok(performance.now() - t < 60);
assert.deepEqual([a, b, c], ['p', 'r', 's']);

const saved = []; let hiddenAt = null;
async function saveDrafts(drafts) { try { await Promise.all(drafts.map(async (d) => { await wait(10); saved.push(d); })); } finally { hiddenAt = saved.length; } }
await saveDrafts([1, 2, 3]);
assert.equal(hiddenAt, 3);
console.log('ok');
