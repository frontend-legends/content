// Глава 7.04 — функции как объекты и их формы: name и length, стрелки без new/prototype/arguments,
// именованное function expression, значения по умолчанию, rest и arguments (связь в sloppy mode).
// run: node forms.cjs
const assert = require('node:assert/strict');

// функция — объект: свойства, передача, хранение
function formatPrice(value, currency = '₽', ...rest) { return `${value} ${currency}`; }
formatPrice.calls = 0;
assert.equal(typeof formatPrice, 'function');
assert.equal(formatPrice.name, 'formatPrice');
assert.equal(formatPrice.length, 1);            // считает параметры до первого со значением по умолчанию или rest
const anon = function () {}; const arrow = () => {};
assert.equal(anon.name, 'anon');                // имя выводится из переменной
assert.equal(arrow.name, 'arrow');

// стрелка: нет prototype, нельзя new, нет своего arguments
assert.equal(arrow.prototype, undefined);
assert.throws(() => new arrow(), { name: 'TypeError', message: 'arrow is not a constructor' });
function outer() { const inner = () => arguments[0]; return inner('ignored'); }
assert.equal(outer('outer arg'), 'outer arg');  // arguments внешней функции
const m = { method() {} };
assert.throws(() => new m.method(), TypeError); // сокращённый метод — тоже не конструктор

// имя именованного function expression видно только внутри
const fact = function f(n) { return n <= 1 ? 1 : n * f(n - 1); };
assert.equal(fact(5), 120);
assert.equal(typeof f, 'undefined');

// значения по умолчанию: вычисляются при вызове, только для undefined, видят предыдущие параметры
let created = 0;
function withDefault(a, b = a * 2, list = (created++, [])) { list.push(a); return [b, list]; }
assert.deepEqual(withDefault(1), [2, [1]]);
assert.deepEqual(withDefault(1), [2, [1]]);     // новый массив каждый вызов (в Python было бы иначе)
assert.equal(created, 2);
assert.deepEqual(withDefault(1, null), [null, [1]]);
assert.throws(() => { function g(a = b, b = 1) { return a; } g(); }, ReferenceError); // TDZ параметров

// rest — массив, arguments — псевдомассив
function restFn(...args) { return Array.isArray(args); }
function argsFn() { return [Array.isArray(arguments), arguments.length, Array.from(arguments)]; }
assert.equal(restFn(1, 2), true);
assert.deepEqual(argsFn(1, 2), [false, 2, [1, 2]]);

// в sloppy mode arguments связан с параметрами, в strict — нет
function sloppy(a) { arguments[0] = 99; return a; }
function strict(a) { 'use strict'; arguments[0] = 99; return a; }
function sloppyWithDefault(a = 0) { arguments[0] = 99; return a; }
assert.equal(sloppy(1), 99);
assert.equal(strict(1), 1);
assert.equal(sloppyWithDefault(1), 1);           // параметры по умолчанию отключают связь
console.log('ok');
