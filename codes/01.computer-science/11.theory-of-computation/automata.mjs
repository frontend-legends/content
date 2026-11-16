// Проверки к 1.11: конечный автомат для цены «349.90» и то же регуляркой; регулярка проверяет скобки только
// до фиксированной глубины, стек — любой; обратная ссылка выходит за регулярные языки; катастрофический возврат
// /^(a+)+$/ растёт экспоненциально, исправленная регулярка линейна; линейный движок V8 (флаг) не зависает и
// отказывается от обратных ссылок; рекурсивный запрос SQL; автомат состояний оформления заказа.
// Запуск: cd codes && node run.mjs 01.computer-science/11.theory-of-computation
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

// --- конечный автомат: цена из цифр, необязательная точка и до двух знаков после ---
const transitions = {
  start: { digit: 'int' },
  int: { digit: 'int', dot: 'dot' },
  dot: { digit: 'frac1' },
  frac1: { digit: 'frac2' },
  frac2: {},
};
const accepting = new Set(['int', 'frac1', 'frac2']);
const kind = (ch) => (ch >= '0' && ch <= '9' ? 'digit' : ch === '.' ? 'dot' : 'other');
function isPrice(s) {
  let state = 'start';
  for (const ch of s) {
    state = transitions[state][kind(ch)];
    if (!state) return false;                                                                // нет перехода — отказ
  }
  return accepting.has(state);
}
const priceRe = /^\d+(\.\d{1,2})?$/;
for (const s of ['349.90', '349', '0.5', '349.', '.5', '3.999', '34a', '']) assert.equal(isPrice(s), priceRe.test(s), s);
assert.deepEqual(['349.90', '349.', '3.999'].map(isPrice), [true, false, false]);

// --- скобки: регулярка знает только фиксированную глубину, стек — любую ---
const depth2 = /^(\((\(\))*\))*$/;                                                           // вложенность не больше 2
assert.equal(depth2.test('(())()'), true);
assert.equal(depth2.test('((()))'), false);                                                  // правильная строка отвергнута
function balanced(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in pairs && stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}
assert.deepEqual(['((()))', '([]{})', '([)]', '((', ')(', ''].map(balanced), [true, true, false, false, false, true]);

// --- обратная ссылка: «то же слово дважды» — не регулярный язык, но регулярки JS умеют ---
assert.equal(/^(.+) \1$/.test('чай чай'), true);
assert.equal(/^(.+) \1$/.test('чай кофе'), false);

// --- катастрофический возврат: каждые два символа — время ×4 ---
const evil = /^(a+)+$/;
const time = (re, s) => { const t = performance.now(); re.test(s); return performance.now() - t; };
const t20 = Math.min(time(evil, 'a'.repeat(20) + '!'), time(evil, 'a'.repeat(20) + '!'));
const t24 = Math.min(time(evil, 'a'.repeat(24) + '!'), time(evil, 'a'.repeat(24) + '!'));
assert.ok(t24 > t20 * 6, `20: ${t20.toFixed(1)} мс, 24: ${t24.toFixed(1)} мс`);            // теоретически ×16
assert.ok(time(/^a+$/, 'a'.repeat(1e6) + '!') < 50);                                         // тот же язык, миллион символов

// --- линейный движок V8 под флагом ---
const linear = spawnSync(process.execPath, ['--enable-experimental-regexp-engine', '-e', `
const re = new RegExp('^(a+)+$', 'l');
const t = performance.now();
const r = re.test('a'.repeat(40) + '!');
console.log(r, performance.now() - t < 50);
try { new RegExp('(a)\\\\1', 'l'); } catch (e) { console.log(e.message); }`], { encoding: 'utf8' });
assert.deepEqual(linear.stdout.trim().split('\n'), ['false true', 'Invalid regular expression: /(a)\\1/l: Cannot be executed in linear time']);
assert.throws(() => new RegExp('a', 'l'), SyntaxError);                                    // без флага такого флага нет

// --- SQL с рекурсией считает то, что обычный SELECT не может ---
const db = new DatabaseSync(':memory:');
const fib = db.prepare(`
  WITH RECURSIVE fib(n, a, b) AS (SELECT 1, 0, 1 UNION ALL SELECT n + 1, b, a + b FROM fib WHERE n < 10)
  SELECT group_concat(a, ',') AS seq FROM fib`).get();
assert.equal(fib.seq, '0,1,1,2,3,5,8,13,21,34');
db.close();

// --- автомат состояний: недопустимый переход просто невозможен ---
const checkout = {
  cart: { CHECKOUT: 'address' },
  address: { NEXT: 'payment', BACK: 'cart' },
  payment: { PAY: 'paying', BACK: 'address' },
  paying: { SUCCESS: 'done', FAILURE: 'payment' },
  done: {},
};
const step = (state, event) => checkout[state][event] ?? state;
let s = 'cart';
for (const e of ['PAY', 'CHECKOUT', 'NEXT', 'PAY', 'PAY', 'SUCCESS']) s = step(s, e);
assert.equal(s, 'done');                                                                     // PAY из корзины и второй PAY проигнорированы
assert.equal(step('paying', 'BACK'), 'paying');

console.log('automata ok');
