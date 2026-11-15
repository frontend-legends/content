// Глава 7.03 — «Практика»: что выведет, история отмены, дубликаты по sku.
// run: node practice.cjs
const assert = require('node:assert/strict');
const util = require('node:util');

const a = [10, 9, 1, 100]; const b = a.sort();
assert.equal(a === b, true); assert.deepEqual(a, [1, 10, 100, 9]);
assert.equal(util.inspect(Array(3).map(() => 'x')), '[ <3 empty items> ]');
assert.equal([1, , 3].includes(undefined), true);
const { qty = 1 } = { qty: null }; assert.equal(qty, null);
const key = {}; const store = {}; store[key] = 'v';
assert.deepEqual(Object.keys(store), ['[object Object]']);

// история отмены: баг и исправление
{
  const history = [];
  function setQty(cart, sku, q) { history.push({ ...cart }); cart.items.find((i) => i.sku === sku).qty = q; return cart; }
  const cart = { items: [{ sku: 'tea', qty: 1 }] };
  setQty(cart, 'tea', 5);
  assert.equal(history.pop().items[0].qty, 5); // «прошлое» уже испорчено
}
{
  const history = [];
  function setQty(cart, sku, q) { history.push(cart); return { ...cart, items: cart.items.map((i) => (i.sku === sku ? { ...i, qty: q } : i)) }; }
  const pot = { sku: 'pot', qty: 1 };
  const cart = { items: [{ sku: 'tea', qty: 1 }, pot] };
  const next = setQty(cart, 'tea', 5);
  assert.equal(next.items[0].qty, 5);
  assert.equal(history.pop().items[0].qty, 1);
  assert.equal(next.items[1], pot); // не изменённые товары переиспользуются
}

// дубликаты
function dedupeBySku(items) { const m = new Map(); for (const i of items) m.set(i.sku, i); return [...m.values()]; }
assert.deepEqual(dedupeBySku([{ sku: 'tea', price: 490 }, { sku: 'pot', price: 2490 }, { sku: 'tea', price: 450 }]),
  [{ sku: 'tea', price: 450 }, { sku: 'pot', price: 2490 }]);
console.log('ok');
