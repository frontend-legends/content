// Проверки к 2.10: стек для парных скобок, путей, минимума за O(1), обратной польской записи,
// калькулятора и монотонный стек — примеры из условий и случайные тесты против простых решений.
// Запуск: cd codes && node run.mjs 02.algorithms-data-structures/10.stack
import { posix } from 'node:path';
import { assert, fuzz, randArray, randInt, randString } from '../_shared.ts';

// --- шаблон: монотонный стек — следующий больший элемент ---
function nextGreater(a: number[]): number[] {
  const result = new Array(a.length).fill(-1);
  const stack: number[] = [];                     // индексы, ждущие своего большего
  for (let i = 0; i < a.length; i++) {
    while (stack.length && a[stack.at(-1)!] < a[i]) result[stack.pop()!] = a[i];
    stack.push(i);
  }
  return result;
}

// --- 20. Valid Parentheses ---
function isValid(s: string): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const stack: string[] = [];
  for (const c of s) {
    if (c in pairs) {
      if (stack.pop() !== pairs[c]) return false;
    } else stack.push(c);
  }
  return stack.length === 0;
}

// --- 71. Simplify Path ---
function simplifyPath(path: string): string {
  const stack: string[] = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

// --- 155. Min Stack ---
class MinStack {
  private values: number[] = [];
  private mins: number[] = [];                    // минимум на каждой глубине

  push(val: number): void {
    this.values.push(val);
    this.mins.push(this.mins.length ? Math.min(val, this.mins.at(-1)!) : val);
  }
  pop(): void {
    this.values.pop();
    this.mins.pop();
  }
  top(): number {
    return this.values.at(-1)!;
  }
  getMin(): number {
    return this.mins.at(-1)!;
  }
}

// --- 150. Evaluate Reverse Polish Notation ---
function evalRPN(tokens: string[]): number {
  const stack: number[] = [];
  for (const t of tokens) {
    if (!['+', '-', '*', '/'].includes(t)) {
      stack.push(Number(t));
      continue;
    }
    const b = stack.pop()!;
    const a = stack.pop()!;                       // порядок важен для - и /
    if (t === '+') stack.push(a + b);
    else if (t === '-') stack.push(a - b);
    else if (t === '*') stack.push(a * b);
    else stack.push(Math.trunc(a / b));           // деление к нулю
  }
  return stack[0];
}

// --- 224. Basic Calculator ---
function calculate(s: string): number {
  let result = 0;
  let sign = 1;
  const stack: number[] = [];                     // результат и знак перед скобкой
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      let n = 0;
      while (i < s.length && s[i] >= '0' && s[i] <= '9') n = n * 10 + Number(s[i++]);
      i--;
      result += sign * n;
    } else if (c === '+') sign = 1;
    else if (c === '-') sign = -1;
    else if (c === '(') {
      stack.push(result, sign);
      result = 0;
      sign = 1;
    } else if (c === ')') {
      const before = stack.pop()!;
      result = stack.pop()! + before * result;
    }
  }
  return result;
}

// ===== проверки =====
assert.deepEqual(nextGreater([2, 1, 2, 4, 3]), [4, 2, 4, -1, -1]);
fuzz(1000, () => randArray(randInt(0, 10), 0, 9), (a) => {
  assert.deepEqual(nextGreater(a), a.map((x, i) => a.slice(i + 1).find((y) => y > x) ?? -1));
});

// 20
assert.equal(isValid('()'), true);
assert.equal(isValid('()[]{}'), true);
assert.equal(isValid('(]'), false);
assert.equal(isValid('([)]'), false);
assert.equal(isValid('{[]}'), true);
assert.equal(isValid('('), false);
fuzz(2000, () => randString(randInt(0, 8), '()[]{}'), (s) => {
  let t = s, prev;
  do { prev = t; t = t.replace(/\(\)|\[\]|\{\}/g, ''); } while (t !== prev);
  assert.equal(isValid(s), t === '');
});

// 71
assert.equal(simplifyPath('/home/'), '/home');
assert.equal(simplifyPath('/home//foo/'), '/home/foo');
assert.equal(simplifyPath('/home/user/Documents/../Pictures'), '/home/user/Pictures');
assert.equal(simplifyPath('/../'), '/');
assert.equal(simplifyPath('/.../a/../b/c/../d/./'), '/.../b/d');                                 // «...» — обычное имя
fuzz(1000, () => '/' + Array.from({ length: randInt(0, 6) }, () => ['a', 'b', '.', '..', '', '...'][randInt(0, 5)]).join('/'), (p) => {
  const normalized = posix.normalize(p);                                                            // эталон из Node.js
  const expected = normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
  assert.equal(simplifyPath(p), expected);
});

// 155
const ms = new MinStack();
ms.push(-2); ms.push(0); ms.push(-3);
assert.equal(ms.getMin(), -3);
ms.pop();
assert.equal(ms.top(), 0);
assert.equal(ms.getMin(), -2);
fuzz(300, () => Array.from({ length: randInt(1, 30) }, () => randInt(-5, 5)), (ops) => {
  const s = new MinStack(), model: number[] = [];
  for (const x of ops) {
    if (x > 2 && model.length) { s.pop(); model.pop(); } else { s.push(x); model.push(x); }
    if (model.length) { assert.equal(s.getMin(), Math.min(...model)); assert.equal(s.top(), model.at(-1)); }
  }
});

// 150
assert.equal(evalRPN(['2', '1', '+', '3', '*']), 9);
assert.equal(evalRPN(['4', '13', '5', '/', '+']), 6);
assert.equal(evalRPN(['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']), 22);
assert.equal(evalRPN(['7', '-2', '/']), -3);                                                     // к нулю, а не вниз

// 224
assert.equal(calculate('1 + 1'), 2);
assert.equal(calculate(' 2-1 + 2 '), 3);
assert.equal(calculate('(1+(4+5+2)-3)+(6+8)'), 23);
assert.equal(calculate('-(2 + 3)'), -5);                                                          // унарный минус
assert.equal(calculate('- (3 + (4 + 5))'), -12);
// по условию двух операторов подряд нет: унарный минус — только в начале или после «(»
const randExpr = (depth: number, first: boolean): string => {
  if (depth === 0 || randInt(0, 2) === 0) return String(randInt(0, 20));
  const parts = Array.from({ length: randInt(1, 3) }, (_, i) => randExpr(depth - 1, i === 0));
  const body = parts.map((p, i) => (i ? ['+', '-', ' - ', ' + '][randInt(0, 3)] : '') + p).join('');
  return (first && randInt(0, 3) === 0 ? '-' : '') + '(' + body + ')';
};
fuzz(2000, () => randExpr(3, true), (e) => {
  assert.equal(calculate(e) + 0, new Function(`return ${e}`)() + 0);                              // -0 и 0 считаем одинаковыми
});

console.log('stack ok');
