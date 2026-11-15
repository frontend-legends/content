// Глава 7.06 — «Практика»: что выведет, лимитер.
// run: node practice.cjs
const assert = require('node:assert/strict');
const fns = []; for (var i = 0; i < 3; i++) fns.push(() => i);
const fns2 = []; for (let j = 0; j < 6; j++) { fns2.push(() => j); j++; }
let currency = '₽'; const format = (v) => `${v} ${currency}`; currency = '$';
assert.deepEqual(fns.map((f) => f()), [3, 3, 3]);
assert.deepEqual(fns2.map((f) => f()), [1, 3, 5]);
assert.equal(format(10), '10 $');

function createLimiter(max) { let used = 0; return function tryRun(fn) { if (used >= max) return false; used++; fn(); return true; }; }
const sent = [];
const free = createLimiter(2); const promo = createLimiter(1);
assert.deepEqual([free(() => sent.push('tea')), free(() => sent.push('pot')), free(() => sent.push('cup'))], [true, true, false]);
assert.equal(promo(() => sent.push('code')), true);
assert.deepEqual(sent, ['tea', 'pot', 'code']);
const boom = createLimiter(1);
assert.throws(() => boom(() => { throw new Error('x'); }));
assert.equal(boom(() => {}), false); // ошибка не даёт обойти лимит
console.log('ok');
