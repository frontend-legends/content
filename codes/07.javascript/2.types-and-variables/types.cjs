// Глава 7.02 — типы: typeof, копирование по значению и по ссылке, числа IEEE 754, BigInt, строки UTF-16, обёртки.
// run: node types.cjs
'use strict';
const assert = require('node:assert/strict');

// typeof: 7 примитивов + object, плюс function и исторический null
assert.deepEqual(
  ['s', 1, 1n, true, undefined, Symbol('x'), null, {}, [], () => {}].map((v) => typeof v),
  ['string', 'number', 'bigint', 'boolean', 'undefined', 'symbol', 'object', 'object', 'object', 'function'],
);
assert.equal(typeof undeclaredVariable, 'undefined'); // typeof не бросает на необъявленной переменной

// примитивы копируются значением, объекты — ссылкой; параметр функции — копия ссылки
let a = 1; let b = a; b++;
assert.equal(a, 1);
const o1 = { n: 1 }; const o2 = o1; o2.n++;
assert.equal(o1.n, 2);
function reassign(obj) { obj = { n: 100 }; }
function mutate(obj) { obj.n = 100; }
reassign(o1); assert.equal(o1.n, 2);
mutate(o1); assert.equal(o1.n, 100);
assert.notEqual({ n: 1 }, { n: 1 }); // сравниваются ссылки

// числа: один тип double
assert.equal(0.1 + 0.2, 0.30000000000000004);
assert.ok(Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON);
assert.equal(Number.MAX_SAFE_INTEGER, 2 ** 53 - 1);
assert.equal(2 ** 53 + 1, 2 ** 53);                 // точность кончилась
assert.equal(9007199254740993n + 1n, 9007199254740994n);
assert.throws(() => 1n + 1, TypeError);             // BigInt и Number не смешиваются
assert.equal(NaN === NaN, false);
assert.equal(Object.is(NaN, NaN), true);
assert.equal(0 === -0, true);
assert.equal(Object.is(0, -0), false);
assert.equal(1 / -0, -Infinity);
assert.equal(isNaN('abc'), true);                   // глобальный приводит к числу
assert.equal(Number.isNaN('abc'), false);
assert.equal((0.615).toFixed(2), '0.61');           // 0.615 хранится как 0.61499999...

// строки: UTF-16, символ вне BMP — две кодовые единицы
const x = '𝒳';
assert.equal(x.length, 2);
assert.equal([...x].length, 1);
assert.equal(x.codePointAt(0), 0x1d4b3);

// обёртки: метод у примитива работает через временный объект, свойство не сохраняется
const s = 'abc';
assert.equal(s.toUpperCase(), 'ABC');
assert.throws(() => { s.custom = 1; }, TypeError);   // в strict mode — ошибка
assert.equal(typeof new String('a'), 'object');
assert.equal(Boolean(new Boolean(false)), true);     // объект всегда truthy
assert.equal(new String('a') == 'a', true);
assert.equal(new String('a') === 'a', false);
console.log('ok');
