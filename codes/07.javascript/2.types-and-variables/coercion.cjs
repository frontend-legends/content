// Глава 7.02 — приведение типов: ToNumber, ToString, ToBoolean, ToPrimitive и Symbol.toPrimitive, оператор +,
// ==, ===, Object.is, falsy, ?? против ||.
// run: node coercion.cjs
const assert = require('node:assert/strict');

// ToNumber
assert.deepEqual([Number(''), Number(' 42 '), Number('42px'), Number(null), Number(undefined), Number(true), Number([]), Number([5]), Number([1, 2]), Number({})],
  [0, 42, NaN, 0, NaN, 1, 0, 5, NaN, NaN]);
assert.equal(parseInt('42px', 10), 42);
assert.equal(parseInt('0.0000005'), 0);   // строка читается до точки
assert.equal(parseInt(0.0000005), 5);     // число сначала становится строкой '5e-7'

// + со строкой — конкатенация, остальные арифметические операторы — числа
assert.equal('2' + 1, '21');
assert.equal('2' - 1, 1);
assert.equal('2' * '3', 6);
assert.equal(1 + 2 + '3', '33');
assert.equal('1' + 2 + 3, '123');
assert.equal(+'', 0);
assert.equal([] + [], '');
assert.equal([] + {}, '[object Object]');
assert.equal([1, 2] + [3], '1,23');
assert.equal(true + 1, 2);
assert.equal(null + 1, 1);
assert.equal(undefined + 1, NaN);

// ToPrimitive: Symbol.toPrimitive получает hint; без него valueOf/toString по порядку
const price = {
  [Symbol.toPrimitive](hint) { return hint === 'number' ? 2490 : hint === 'string' ? '2490 ₽' : 'default'; },
};
assert.equal(+price, 2490);
assert.equal(`${price}`, '2490 ₽');
assert.equal(price + '', 'default');     // у + hint default
const money = { valueOf: () => 100, toString: () => 'сто' };
assert.equal(money * 2, 200);
assert.equal(String(money), 'сто');
assert.equal(money + '', '100');          // default → сначала valueOf
assert.equal(new Date(0) + 0 === new Date(0).toString() + '0', true); // Date: default → string

// == : null и undefined равны только друг другу
assert.equal(null == undefined, true);
assert.equal(null == 0, false);
assert.equal(null >= 0, true);            // сравнение < > приводит null к 0, а == — нет
assert.equal(undefined == 0, false);
assert.equal('' == 0, true);
assert.equal('0' == false, true);
assert.equal([] == false, true);
assert.equal([] == ![], true);
assert.equal(NaN == NaN, false);
assert.equal([0] == false, true);
assert.equal(Boolean([0]), true);         // при этом [0] — truthy

// falsy — ровно 8 значений
const falsy = [false, 0, -0, 0n, '', null, undefined, NaN];
assert.ok(falsy.every((v) => !v));
assert.ok([[], {}, '0', 'false', ' ', -1, Infinity, new Boolean(false)].every((v) => !!v));

// ?? против ||
const qty = 0;
assert.equal(qty || 1, 1);
assert.equal(qty ?? 1, 0);
assert.equal('' ?? 'x', '');
assert.equal(null ?? 'x', 'x');
console.log('ok');
