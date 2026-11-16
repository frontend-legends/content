// Проверки к 1.04: слабая и сильная типизация. JavaScript неявно приводит типы, Python — нет:
// '5' + 2 там TypeError, а '5' * 2 — повтор строки. Python запускается, если он есть в системе.
// Запуск: cd codes && node run.mjs 01.computer-science/4.languages-and-compilers
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// JavaScript: динамическая и слабая
assert.equal('5' * 2, 10);
assert.equal('5' + 2, '52');
assert.equal([] + {}, '[object Object]');
let x = 5;
x = 'пять';                                                                              // тип у значения, не у переменной
assert.equal(typeof x, 'string');

// Python: динамическая, но сильная
let python;
try { python = execFileSync('python3', ['-I', '-c', `
try:
    '5' + 2
except TypeError as e:
    print('TypeError:', e)
print('5' * 2)
print(int('5') + 2)
x = 5
x = 'пять'
print(type(x).__name__)
`]).toString().trim().split('\n'); } catch { python = null; }
if (python) {
  assert.deepEqual(python, ['TypeError: can only concatenate str (not "int") to str', '55', '7', 'str']);
} else {
  console.log('python3 не найден — сравнение с Python пропущено');
}

console.log('typing ok');
