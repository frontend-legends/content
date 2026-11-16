// Проверки к 1.08: ссылочная прозрачность и мемоизация, функциональное ядро и императивная оболочка,
// законы функтора и монады для массива (map, flatMap), Promise нарушает их — then и выравнивает, и
// усыновляет thenable; Option через ?. и ??; Result без исключений; ленивость iterator helpers;
// структурное разделение в Immer и поверхностный Object.freeze.
// Запуск: cd codes && node run.mjs 01.computer-science/8.fp
import assert from 'node:assert/strict';
import { produce } from 'immer';

// --- ссылочная прозрачность: чистую функцию можно заменить её значением ---
let calls = 0;
const priceWithVat = (price) => { calls++; return Math.round(price * 1.2); };
const memo = (f) => { const cache = new Map(); return (x) => (cache.has(x) ? cache.get(x) : (cache.set(x, f(x)), cache.get(x))); };
const fast = memo(priceWithVat);
assert.deepEqual([fast(100), fast(100), fast(100)], [120, 120, 120]);
assert.equal(calls, 1);
// нечистая — зависит от времени, кешировать нельзя
const happyHour = (price, now) => (new Date(now).getUTCHours() === 15 ? price * 0.9 : price);
assert.notEqual(happyHour(100, Date.UTC(2026, 0, 1, 15)), happyHour(100, Date.UTC(2026, 0, 1, 16)));

// --- практика «Скидка счастливого часа»: время — аргумент, тесты стабильны ---
const discountAt = (price, date) => (date.getHours() >= 15 && date.getHours() < 16 ? Math.round(price * 0.9) : price);
assert.equal(discountAt(500, new Date(2026, 10, 16, 15, 30)), 450);
assert.equal(discountAt(500, new Date(2026, 10, 16, 18, 0)), 500);

// --- функтор: законы map для массива ---
const xs = [1, 2, 3];
const f = (x) => x + 1, g = (x) => x * 10;
assert.deepEqual(xs.map((x) => x), xs);                                                      // тождество
assert.deepEqual(xs.map((x) => g(f(x))), xs.map(f).map(g));                                // композиция

// --- монада: законы flatMap для массива ---
const of = (x) => [x];
const k = (x) => [x, -x], h = (x) => [x * 2];
assert.deepEqual(of(5).flatMap(k), k(5));                                                    // левая единица
assert.deepEqual(xs.flatMap(of), xs);                                                        // правая единица
assert.deepEqual(xs.flatMap(k).flatMap(h), xs.flatMap((x) => k(x).flatMap(h)));            // ассоциативность

// --- Promise: then — и map, и flatMap; Promise<Promise<T>> не бывает ---
const p = Promise.resolve(1);
assert.equal(Promise.resolve(p), p);                                                          // обёртка вернула тот же промис
assert.equal(await p.then((x) => x + 1), 2);                                                  // как map
assert.equal(await p.then((x) => Promise.resolve(x + 1)), 2);                                 // как flatMap — выровнял
// «левая единица» нарушена: значение с методом then усыновляется
const thenable = { then: (resolve) => resolve('усыновлён') };
const fn = (x) => Promise.resolve(typeof x);
assert.equal(await Promise.resolve(thenable).then(fn), 'string');                            // fn получил 'усыновлён'
assert.equal(await fn(thenable), 'object');

// --- Option: отсутствие значения без исключений ---
const user = { address: null };
assert.equal(user.address?.city ?? 'город не указан', 'город не указан');
assert.equal([user].map((u) => u.address).filter(Boolean).map((a) => a.city)[0], undefined);  // массив как Option

// --- Result: ошибка как значение ---
const ok = (value) => ({ ok: true, value });
const err = (error) => ({ ok: false, error });
const chain = (r, fn2) => (r.ok ? fn2(r.value) : r);
const parseQty = (s) => (/^\d+$/.test(s) ? ok(Number(s)) : err('количество — не число'));
const checkStock = (n) => (n <= 5 ? ok(n) : err('на складе только 5'));
const order = (s) => chain(chain(parseQty(s), checkStock), (n) => ok(n * 450));
assert.deepEqual(order('2'), { ok: true, value: 900 });
assert.deepEqual(order('много'), { ok: false, error: 'количество — не число' });
assert.deepEqual(order('9'), { ok: false, error: 'на складе только 5' });

// --- ленивость: iterator helpers тянут ровно столько, сколько нужно ---
let pulled = 0;
function* orders() { for (let i = 1; ; i++) { pulled++; yield { id: i, total: (i * 137) % 1000 }; } }
const bigOnes = Iterator.from(orders()).filter((o) => o.total > 900).map((o) => o.id).take(3).toArray();
assert.deepEqual(bigOnes, [7, 14, 29]);
assert.equal(pulled, 29);                                                                     // бесконечный источник, 29 элементов
// массив сначала обрабатывает всё
let mapped = 0;
const all = Array.from({ length: 1e5 }, (_, i) => ({ id: i + 1, total: ((i + 1) * 137) % 1000 }));
const eager = all.filter((o) => o.total > 900).map((o) => { mapped++; return o.id; }).slice(0, 3);
assert.deepEqual(eager, [7, 14, 29]);
assert.ok(mapped > 9000);
let lazyMapped = 0;
const lazy = all.values().filter((o) => o.total > 900).map((o) => { lazyMapped++; return o.id; }).take(3).toArray();
assert.deepEqual([lazy, lazyMapped], [[7, 14, 29], 3]);

// --- неизменяемость: структурное разделение ---
const state = { cart: { items: [{ id: 1, qty: 1 }, { id: 2, qty: 1 }] }, user: { name: 'Аня' } };
const next = produce(state, (draft) => { draft.cart.items[1].qty = 3; });
assert.equal(state.cart.items[1].qty, 1);                                                    // старое не тронуто
assert.equal(next.cart.items[1].qty, 3);
assert.equal(next.user, state.user);                                                         // нетронутые ветки общие
assert.equal(next.cart.items[0], state.cart.items[0]);
assert.notEqual(next.cart, state.cart);
// Object.freeze поверхностный
const frozen = Object.freeze({ items: [1] });
frozen.items.push(2);
assert.deepEqual(frozen.items, [1, 2]);
assert.throws(() => { 'use strict'; frozen.items = []; }, TypeError);

console.log('fp ok');
