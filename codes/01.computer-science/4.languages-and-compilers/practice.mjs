// Проверки к практике 1.04: калькулятор без eval, функция с return и переносом строки,
// ограничения ASI (перевод строки перед =>), ESLint no-unreachable находит недостижимый блок.
// Запуск: cd codes && node run.mjs 01.computer-science/4.languages-and-compilers
import assert from 'node:assert/strict';
import { Linter } from 'eslint';

function calc(src) {
  const tokens = src.match(/\d+(\.\d+)?|[-+*/()]/g) ?? [];
  if (tokens.join('') !== src.replace(/\s+/g, '')) throw new SyntaxError('Недопустимый символ');
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function expr() {
    let value = term();
    while (peek() === '+' || peek() === '-') value = next() === '+' ? value + term() : value - term();
    return value;
  }
  function term() {
    let value = factor();
    while (peek() === '*' || peek() === '/') value = next() === '*' ? value * factor() : value / factor();
    return value;
  }
  function factor() {
    const t = next();
    if (t === '-') return -factor();
    if (t === '(') {
      const value = expr();
      if (next() !== ')') throw new SyntaxError('Ожидалась )');
      return value;
    }
    if (t !== undefined && /^\d/.test(t)) return Number(t);
    throw new SyntaxError(`Неожиданный токен ${t}`);
  }

  const result = expr();
  if (pos < tokens.length) throw new SyntaxError(`Лишний токен ${peek()}`);
  return result;
}

assert.equal(calc('2 + 3 * (4 - 1)'), 11);
assert.equal(calc('-(2 + 3) * 4'), -20);
assert.equal(calc('8 / 4 / 2'), 1);
assert.equal(calc('2 - 3 - 4'), -5);
assert.equal(calc('1.5 * 2'), 3);
for (const bad of ['alert(1)', '2 +', '(1 + 2', '1 2', '2 ** 3']) assert.throws(() => calc(bad), { name: 'SyntaxError' }, bad);

// «Что вернёт функция?»
const getConfig = new Function("return\n{\n  theme: 'dark'\n}");
assert.equal(getConfig(), undefined);
const fixed = new Function("return {\n  theme: 'dark',\n};");
assert.deepEqual(fixed(), { theme: 'dark' });

// перевод строки перед => запрещён
assert.throws(() => new Function('const f = (a)\n=> a;'), SyntaxError);
// строка, начинающаяся с (, продолжает предыдущее выражение
assert.throws(() => new Function('const a = 1\n(function () {})()')(), TypeError);       // 1(...) — не функция

// ESLint видит недостижимый код после return
const messages = new Linter().verify("function getConfig() {\n  return\n  {\n    theme: 'dark'\n  }\n}\n", {
  rules: { 'no-unreachable': 'error' },
});
assert.deepEqual(messages.map((m) => [m.ruleId, m.line]), [['no-unreachable', 3]]);

console.log('practice ok');
