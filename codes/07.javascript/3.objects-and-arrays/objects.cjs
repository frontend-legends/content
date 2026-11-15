// Глава 7.03 — объекты: ключи только строки и символы, порядок ключей, __proto__ как ключ,
// spread вычисляет геттеры, деструктуризация, Object.groupBy, freeze поверхностный.
// run: node objects.cjs
'use strict';
const assert = require('node:assert/strict');

// ключ приводится к строке; объект как ключ — '[object Object]'
const byId = {};
byId[1] = 'a';
assert.equal(byId['1'], 'a');
const u1 = { id: 1 }; const u2 = { id: 2 };
const seen = {};
seen[u1] = 'first'; seen[u2] = 'second';
assert.deepEqual(Object.keys(seen), ['[object Object]']);
assert.equal(seen[u1], 'second'); // второй затёр первый

// порядок: целочисленные ключи по возрастанию, потом строки в порядке добавления, потом символы
const sym = Symbol('s');
const ordered = { b: 1, 10: 1, a: 1, 2: 1, [sym]: 1, '-1': 1 };
assert.deepEqual(Reflect.ownKeys(ordered), ['2', '10', 'b', 'a', '-1', sym]);

// __proto__ в обычном объекте — не ключ, а сеттер прототипа; Map и Object.create(null) безопасны
const dict = {};
dict['__proto__'] = { polluted: true };
assert.equal(Object.keys(dict).length, 0);
assert.equal(dict.polluted, true);
const safe = Object.create(null);
safe['__proto__'] = 1;
assert.deepEqual(Object.keys(safe), ['__proto__']);
const m = new Map([['__proto__', 1]]);
assert.equal(m.get('__proto__'), 1);

// spread копирует свои перечисляемые свойства (и символы), геттер вычисляется
let calls = 0;
const withGetter = { get now() { calls++; return 42; }, [sym]: 'x' };
const copy = { ...withGetter };
assert.equal(calls, 1);
assert.equal(Object.getOwnPropertyDescriptor(copy, 'now').value, 42); // уже не геттер
assert.equal(copy[sym], 'x');
// порядок спреда: последнее побеждает
assert.deepEqual({ ...{ theme: 'light', size: 'm' }, ...{ size: 'l' } }, { theme: 'light', size: 'l' });

// деструктуризация: значение по умолчанию только для undefined
const { qty = 1, note = '-', city: town = 'Riga' } = { qty: null, note: undefined, city: 'Oslo' };
assert.equal(qty, null);
assert.equal(note, '-');
assert.equal(town, 'Oslo');
const { a: { b: deep } = {} } = {};
assert.equal(deep, undefined);
assert.throws(() => { const { a: { b } } = {}; }, TypeError); // без значения по умолчанию — падение
const [first, , third = 'z', ...rest] = ['x', 'y', undefined, 'w', 'v'];
assert.deepEqual([first, third, rest], ['x', 'z', ['w', 'v']]);
let p = 1, q = 2; [p, q] = [q, p];
assert.deepEqual([p, q], [2, 1]);

// Object.groupBy: объект без прототипа
const items = [{ cat: 'tea', n: 1 }, { cat: 'cup', n: 2 }, { cat: 'tea', n: 3 }];
const groups = Object.groupBy(items, (i) => i.cat);
assert.equal(Object.getPrototypeOf(groups), null);
assert.deepEqual(groups.tea.map((i) => i.n), [1, 3]);
assert.deepEqual([...Map.groupBy(items, (i) => i.cat).keys()], ['tea', 'cup']);

// freeze поверхностный
const cfg = Object.freeze({ api: { url: '/v1' } });
assert.throws(() => { cfg.api = null; }, TypeError);
cfg.api.url = '/v2';
assert.equal(cfg.api.url, '/v2');
console.log('ok');
