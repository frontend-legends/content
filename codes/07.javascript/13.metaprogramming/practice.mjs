// Глава 7.13 — «Практика»: модель со схемой, кеш на Proxy над Map, вывод про ключи.
// run: node practice.mjs
import assert from 'node:assert/strict';
import util from 'node:util';

function createModel(schema) {
  const check = (key) => { if (!Object.hasOwn(schema, key)) throw new TypeError(`неизвестное поле ${String(key)}`); };
  return new Proxy({}, {
    get(t, k, r) { if (typeof k === 'symbol') return Reflect.get(t, k, r); check(k); return Reflect.get(t, k, r); },
    set(t, k, v, r) { check(k); if (typeof v !== schema[k]) throw new TypeError(`${k} должно быть ${schema[k]}, а не ${typeof v}`); return Reflect.set(t, k, v, r); },
    deleteProperty(t, k) { check(k); return Reflect.deleteProperty(t, k); },
  });
}
const product = createModel({ title: 'string', price: 'number' });
product.title = 'Чай';
assert.equal(product.title, 'Чай');
assert.throws(() => { product.price = '490'; }, /price должно быть number/);
assert.throws(() => { product.sale = true; }, /неизвестное поле sale/);
assert.throws(() => product.titel, /неизвестное поле titel/);
assert.doesNotThrow(() => util.inspect(product));

const bad = new Proxy(new Map(), { get(t, k) { return t[k]; } });
assert.throws(() => bad.set('tea', 490), /incompatible receiver/);
const cache = new Proxy(new Map(), { get(t, k) { const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; } });
cache.set('tea', 490);
assert.equal(cache.get('tea'), 490);
assert.equal(cache.size, 1);

const id = Symbol('id');
const p = { title: 'Чай', [id]: 7 };
Object.defineProperty(p, 'sku', { value: 'TEA-1' });
assert.deepEqual(Object.keys(p), ['title']);
assert.equal(JSON.stringify(p), '{"title":"Чай"}');
assert.deepEqual(Reflect.ownKeys(p), ['title', 'sku', id]);
assert.deepEqual([{ ...p }[id], { ...p }.sku], [7, undefined]);
assert.equal(Object.getOwnPropertyDescriptor(p, 'sku').writable, false);
console.log('ok');
