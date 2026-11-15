// Глава 7.14 — мемоизация (ключи, WeakMap, промисы), каррирование и fn.length, compose/pipe.
// run: node functional.mjs
import assert from 'node:assert/strict';

// мемоизация по одному примитивному аргументу
function memoize(fn) {
  const cache = new Map();
  return (arg) => { if (!cache.has(arg)) cache.set(arg, fn(arg)); return cache.get(arg); };
}
let computed = 0;
const formatPrice = memoize((v) => { computed++; return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(v); });
formatPrice(490); formatPrice(490); formatPrice(2490);
assert.equal(computed, 2);

// ключ через JSON.stringify: порядок свойств важен, а функции и undefined теряются
assert.notEqual(JSON.stringify({ a: 1, b: 2 }), JSON.stringify({ b: 2, a: 1 }));
assert.equal(JSON.stringify([undefined]), JSON.stringify([null]));

// объект-аргумент: WeakMap не держит объекты в памяти
const byObject = new WeakMap();
const totalOf = (cart) => { if (!byObject.has(cart)) byObject.set(cart, cart.items.reduce((s, i) => s + i, 0)); return byObject.get(cart); };
const cart = { items: [490, 2490] };
assert.equal(totalOf(cart), 2980);
assert.equal(byObject.has(cart), true);

// мемоизация промиса: параллельные вызовы — один запрос; ошибка не кешируется
function memoizeAsync(fn) {
  const cache = new Map();
  return (key) => {
    if (!cache.has(key)) cache.set(key, fn(key).catch((e) => { cache.delete(key); throw e; }));
    return cache.get(key);
  };
}
let requests = 0; let failNext = true;
const loadUser = memoizeAsync(async (id) => { requests++; await new Promise((r) => setTimeout(r, 10)); if (failNext) { failNext = false; throw new Error('503'); } return { id }; });
await assert.rejects(Promise.all([loadUser(1), loadUser(1)]), /503/);
assert.equal(requests, 1);
assert.deepEqual(await loadUser(1), { id: 1 });       // после ошибки — новый запрос
assert.equal(requests, 2);
await loadUser(1);
assert.equal(requests, 2);

// каррирование через fn.length — и ловушка со значением по умолчанию
function curry(fn) {
  return function curried(...args) {
    return args.length >= fn.length ? fn.apply(this, args) : (...more) => curried.apply(this, [...args, ...more]);
  };
}
const price = curry((base, discount, tax) => Math.round(base * (1 - discount) * (1 + tax)));
assert.equal(price(1000)(0.1)(0.2), 1080);
assert.equal(price(1000, 0.1)(0.2), 1080);
const withDefault = curry((base, tax = 0.2) => base * (1 + tax));
assert.equal(withDefault(100), 120);                  // length = 1 — вызов сразу, второй аргумент не ждём

// частичное применение через bind
const applyVat = price.bind(null, 1000, 0);
assert.equal(applyVat(0.2), 1200);

// compose и pipe
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);
const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);
const slug = pipe((s) => s.trim(), (s) => s.toLowerCase(), (s) => s.replace(/\s+/g, '-'));
assert.equal(slug('  Зелёный Чай  '), 'зелёный-чай');
assert.equal(compose((x) => x + 1, (x) => x * 2)(5), 11);
assert.equal(pipe((x) => x + 1, (x) => x * 2)(5), 12);
console.log('ok');
