// Глава 7.12 — протокол итерации: свой итерируемый объект, кто им пользуется, итератор одноразовый,
// break и деструктуризация вызывают return(), for...in против for...of.
// run: node iterators.mjs
import assert from 'node:assert/strict';

// итерируемый объект: [Symbol.iterator]() возвращает итератор с next()
const pages = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    let current = this.from; const last = this.to;
    return { next: () => (current <= last ? { value: current++, done: false } : { value: undefined, done: true }) };
  },
};
assert.deepEqual([...pages], [1, 2, 3]);
assert.deepEqual(Array.from(pages, (p) => `стр. ${p}`), ['стр. 1', 'стр. 2', 'стр. 3']);
const [first, ...others] = pages;
assert.deepEqual([first, others], [1, [2, 3]]);
assert.deepEqual(new Set(pages).size, 3);
let sum = 0; for (const p of pages) sum += p;
assert.equal(sum, 6);
// объект без Symbol.iterator — не итерируемый
assert.throws(() => [...{ a: 1 }], { name: 'TypeError', message: /is not iterable/ });

// итератор одноразовый, итерируемый объект — нет
const it = [1, 2][Symbol.iterator]();
assert.deepEqual([...it], [1, 2]);
assert.deepEqual([...it], []);
assert.equal(it[Symbol.iterator](), it);             // итератор массива сам итерируемый и возвращает себя

// досрочный выход вызывает return()
const closed = [];
const resource = {
  [Symbol.iterator]() {
    let i = 0;
    return { next: () => ({ value: i++, done: false }), return: () => { closed.push('return'); return { done: true }; } };
  },
};
for (const x of resource) if (x === 2) break;
const [a, b] = resource;
assert.deepEqual(closed, ['return', 'return']);

// for...in перебирает ключи-строки, включая унаследованные; for...of — значения
const arr = ['tea', 'pot'];
Array.prototype.extra = 'наследуется';
const keys = []; for (const k in arr) keys.push(k);
delete Array.prototype.extra;
assert.deepEqual(keys, ['0', '1', 'extra']);
const values = []; for (const v of arr) values.push(v);
assert.deepEqual(values, ['tea', 'pot']);
console.log('ok');
