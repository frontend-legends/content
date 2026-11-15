// Глава 7.04 — «Практика»: что выведет, once, подсчёт комментариев явным стеком.
// run: node practice.cjs
const assert = require('node:assert/strict');

function price(value, currency = '₽', ...rest) {}
assert.deepEqual([price.name, price.length], ['price', 1]);
const arrow = () => {};
assert.throws(() => new arrow(), { message: 'arrow is not a constructor' });
function sloppy(a) { arguments[0] = 99; return a; }
assert.equal(sloppy(1), 99);
assert.deepEqual(['1', '2', '3'].map(parseInt), [1, NaN, NaN]);
assert.deepEqual(['1', '2', '3'].map(Number), [1, 2, 3]);

function once(fn) { let called = false; let result; return function (...args) { if (!called) { called = true; result = fn.apply(this, args); } return result; }; }
let sent = 0;
const pay = once((id) => { sent++; return `paid ${id}`; });
assert.equal(pay(7), 'paid 7'); assert.equal(pay(8), 'paid 7'); assert.equal(sent, 1);
const shop = { name: 'tea', label: once(function () { return this.name; }) };
assert.equal(shop.label(), 'tea');

function countRec(c) { return 1 + c.replies.reduce((s, r) => s + countRec(r), 0); }
function count(root) { let total = 0; const stack = [root]; while (stack.length) { const c = stack.pop(); total++; stack.push(...c.replies); } return total; }
let chain = { replies: [] };
for (let i = 0; i < 20000; i++) chain = { replies: [chain] };
assert.throws(() => countRec(chain), RangeError);
assert.equal(count(chain), 20001);
const small = { replies: [{ replies: [] }, { replies: [{ replies: [] }] }] };
assert.equal(count(small), countRec(small));
console.log('ok');
