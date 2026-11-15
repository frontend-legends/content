// Глава 7.13 — символы: уникальность, скрытость от keys/for...in/JSON, глобальный реестр Symbol.for,
// известные символы (toStringTag, iterator, toPrimitive).
// run: node symbols.mjs
import assert from 'node:assert/strict';

const id = Symbol('id');
assert.notEqual(Symbol('id'), Symbol('id'));
assert.equal(id.description, 'id');
assert.equal(String(id), 'Symbol(id)');
assert.throws(() => `${id}`, TypeError);                 // неявно в строку — нельзя

const user = { name: 'Аня', [id]: 42 };
assert.deepEqual(Object.keys(user), ['name']);
assert.equal(JSON.stringify(user), '{"name":"Аня"}');
const forIn = []; for (const k in user) forIn.push(k);
assert.deepEqual(forIn, ['name']);
assert.deepEqual(Object.getOwnPropertySymbols(user), [id]);
assert.equal({ ...user }[id], 42);                       // spread копирует символы

assert.equal(Symbol.for('app.cart'), Symbol.for('app.cart'));
assert.equal(Symbol.keyFor(Symbol.for('app.cart')), 'app.cart');
assert.equal(Symbol.keyFor(id), undefined);

class Money { get [Symbol.toStringTag]() { return 'Money'; } }
assert.equal(Object.prototype.toString.call(new Money()), '[object Money]');
assert.equal(Object.prototype.toString.call(null), '[object Null]');
console.log('ok');
