// Проверки к 19.14: каждый фрагмент «что выведет» запускается по-настоящему — отдельным процессом Node
// (скрипт без strict и модуль, где strict всегда) и в Chromium, — и вывод сверяется с текстом.
// Нашлось расхождение со старой версией: оторванный метод в strict-режиме бросает TypeError, а не даёт undefined,
// а в браузере setTimeout(obj.regular) возвращает window.name — пустую строку.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { withPage } from '../../_lib/browser.mjs';

const runNode = (code, { module = false } = {}) => {
  const r = spawnSync(process.execPath, [...(module ? ['--input-type=module'] : []), '-e', code], { encoding: 'utf8' });
  return (r.stdout + r.stderr).trim().split('\n').filter(Boolean);
};

// --- порядок event loop ---
assert.deepEqual(runNode(`
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');`), ['1', '4', '3', '2']);

assert.deepEqual(runNode(`
async function f() {
  console.log('A');
  await null;
  console.log('B');
}
console.log('start');
f();
console.log('end');`), ['start', 'A', 'end', 'B']);

// задача посложнее: микрозадачи, порождающие макрозадачи, и await
assert.deepEqual(runNode(`
console.log('1');
setTimeout(() => console.log('2'));
Promise.resolve().then(() => { console.log('3'); setTimeout(() => console.log('4')); });
queueMicrotask(() => console.log('5'));
(async () => { console.log('6'); await null; console.log('7'); })();
console.log('8');`), ['1', '6', '8', '3', '5', '7', '2', '4']);

// микрозадачи между макрозадачами: после каждого таймера очередь микрозадач опустошается
assert.deepEqual(runNode(`
setTimeout(() => { console.log('t1'); Promise.resolve().then(() => console.log('m1')); }, 0);
setTimeout(() => console.log('t2'), 0);`), ['t1', 'm1', 't2']);

// --- замыкания в цикле ---
assert.deepEqual(runNode(`for (var i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);`), ['3', '3', '3']);
assert.deepEqual(runNode(`for (let i = 0; i < 3; i++) setTimeout(() => console.log(i), 0);`), ['0', '1', '2']);
assert.deepEqual(runNode(`for (var i = 0; i < 3; i++) ((j) => setTimeout(() => console.log(j), 0))(i);`), ['0', '1', '2']); // IIFE чинит var

assert.deepEqual(runNode(`for (var i = 0; i < 3; i++) setTimeout((j) => console.log(j), 0, i);`), ['0', '1', '2']); // третий аргумент setTimeout

// --- this и контекст вызова ---
const thisCase = `
const obj = {
  name: 'obj',
  regular() { return this.name; },
  arrow: () => this?.name,
};
console.log(String(obj.regular()));
console.log(String(obj.arrow()));
const fn = obj.regular;
try { console.log(String(fn())); } catch (e) { console.log(e.constructor.name); }`;
assert.deepEqual(runNode(thisCase), ['obj', 'undefined', 'undefined']);            // скрипт без strict: this = globalThis
assert.deepEqual(runNode(thisCase, { module: true }), ['obj', 'undefined', 'TypeError']); // модуль — strict: this === undefined
assert.deepEqual(runNode(`'use strict';${thisCase}`), ['obj', 'undefined', 'TypeError']);

// метод, переданный колбэком: в Node таймер вызывает его с this = объект Timeout
assert.deepEqual(runNode(`
const obj = { name: 'obj', regular() { return this.name; } };
setTimeout(function () { console.log(String(obj.regular.call(this))); }, 0);
setTimeout(() => console.log(obj.regular()), 0);
setTimeout(() => console.log(obj.regular.bind(obj)()), 0);`, { module: true }), ['undefined', 'obj', 'obj']);

// оторванный метод счётчика: обычный скрипт молча пишет в глобальный объект, модуль падает
const counterCase = `const counter = { count: 0, inc() { this.count++; return this.count; } };
const inc = counter.inc;
try { console.log(String(inc()), String(globalThis.count)); } catch (e) { console.log(e.constructor.name); }`;
assert.deepEqual(runNode(counterCase), ['NaN NaN']);               // создано глобальное count = NaN
assert.deepEqual(runNode(counterCase, { module: true }), ['TypeError']);

// --- hoisting и TDZ ---
assert.deepEqual(runNode(`
console.log(String(a));
var a = 1;
try { console.log(b); } catch (e) { console.log(e.constructor.name); }
let b = 2;
foo();
function foo() { console.log('ok'); }
try { bar(); } catch (e) { console.log(e.constructor.name + ': ' + e.message); }
var bar = () => {};`), ['undefined', 'ReferenceError', 'ok', 'TypeError: bar is not a function']);
// TDZ действует до строки объявления, даже если внешняя переменная с тем же именем есть
assert.deepEqual(runNode(`
let x = 'внешняя';
{ try { console.log(x); } catch (e) { console.log(e.constructor.name); } let x = 'внутренняя'; }`), ['ReferenceError']);

// --- приведение типов ---
assert.deepEqual(runNode(`
console.log(JSON.stringify([] + []));
console.log([] + {});
console.log(eval('{} + []'));
console.log(({} + []));
console.log(1 + '2');
console.log('3' * 2);
console.log(true + 1);
console.log(null == undefined, null === undefined);
console.log(NaN === NaN, Object.is(NaN, NaN));
console.log(0.1 + 0.2);
console.log([1, 2, 3] + '');
console.log(0 == '', '' == '0', 0 == '0');
console.log(null == null, undefined == null, 0 == null, '' == null);`), [
  '""', '[object Object]', '0', '[object Object]', '12', '6', '2', 'true false', 'false true', '0.30000000000000004', '1,2,3', 'true false true', 'true true false false',
]); // {} + [] — 0 только как отдельная инструкция: {} там — пустой блок

// --- ссылка и значение ---
assert.deepEqual(runNode(`
let a = { x: 1 };
let b = a;
b.x = 2;
console.log(a.x);
function change(obj) { obj.x = 10; }
function reassign(obj) { obj = { x: 99 }; }
const o = { x: 1 };
change(o); console.log(o.x);
reassign(o); console.log(o.x);`), ['2', '10', '10']);

// --- this в браузере: setTimeout вызывает колбэк с this = window, а window.name — пустая строка ---
await withPage(async (page) => {
  await page.setContent('<!doctype html><title>t</title>');
  const browser = await page.evaluate(() => new Promise((resolve) => {
    const obj = { name: 'obj', regular() { return this.name; } };
    setTimeout(function () { resolve({ viaTimer: obj.regular.call(this), timerThisIsWindow: this === window }); }, 0);
  }));
  assert.deepEqual(browser, { viaTimer: '', timerThisIsWindow: true });
  const direct = await page.evaluate(() => new Promise((resolve) => {
    const obj = { name: 'obj', regular() { return this.name; } };
    setTimeout(obj.regular, 0);                        // сам вызов не виден, проверяем, что вернул бы метод
    const viaLost = obj.regular.call(window);
    setTimeout(() => resolve(JSON.stringify(viaLost)), 1);
  }));
  assert.equal(direct, '""');                          // не undefined: у window есть свойство name
});

console.log('output ok');
