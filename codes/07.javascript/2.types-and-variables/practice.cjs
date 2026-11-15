// Глава 7.02 — «Практика»: что выведет, баг с || и доставкой, полифил Object.is.
// run: node practice.cjs
const assert = require('node:assert/strict');

// P1
assert.deepEqual([1 + '2' + 3, 1 + 2 + '3', '5' - 2, [] + [], [1, 2] + [3], null + 1, undefined + 1, null == 0, null >= 0, [] == ![]],
  ['123', '33', 3, '', '1,23', 1, NaN, false, true, true]);

// P2: баг и исправление
function totalBad(qtyInput, product) {
  const qty = qtyInput.value || 1;
  const shipping = product.shipping || 300;
  return product.price * qty + shipping;
}
assert.equal(totalBad({ value: '2' }, { price: 2490, shipping: 0 }), 5280);
assert.equal(totalBad({ value: '' }, { price: 2490, shipping: 0 }), 2790);
function total(qtyInput, product) {
  const qty = Number(qtyInput.value);
  if (qtyInput.value.trim() === '' || !Number.isInteger(qty) || qty < 1) throw new RangeError('Укажите количество');
  const shipping = product.shipping ?? 300;
  return product.price * qty + shipping;
}
assert.equal(total({ value: '2' }, { price: 2490, shipping: 0 }), 4980);
assert.equal(total({ value: '2' }, { price: 2490 }), 5280);
assert.throws(() => total({ value: '' }, { price: 2490 }), RangeError);
assert.equal(2490 + '2', '24902');

// P3: полифил Object.is
function same(a, b) {
  if (a === b) return a !== 0 || 1 / a === 1 / b;
  return a !== a && b !== b;
}
const cases = [[NaN, NaN], [0, -0], [-0, -0], ['1', 1], [1, 1], [{}, {}], [null, undefined]];
for (const [a, b] of cases) assert.equal(same(a, b), Object.is(a, b));
console.log('ok');
