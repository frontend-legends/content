// Проверки к 13.01: разные слои ловят разные ошибки; тест на найденный баг сначала падает, потом проходит.
import assert from 'node:assert/strict';
import { project, run, bin, vitest, write } from '../../_lib/project.mjs';

// функция корзины с двумя ошибками: строка вместо числа и скидка, применённая дважды
const buggy = `export function total(items: { price: number; qty: number }[], discount = 0): number {
  const sum = items.reduce((s, i) => s + i.price * i.qty, 0);
  const discounted = sum * (1 - discount);
  return Math.round(discounted * (1 - discount));
}
`;
const caller = `import { total } from './cart.ts';
total([{ price: '1200', qty: 1 }]);
`;
const tsconfig = JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', allowImportingTsExtensions: true } });

// статика: тип ловит строку вместо числа без запуска кода — но не логику скидки
const dir = project({ 'package.json': JSON.stringify({ type: 'module' }), 'tsconfig.json': tsconfig, 'cart.ts': buggy, 'use.ts': caller });
const tsc = run(bin('tsc'), ['-p', '.'], { cwd: dir });
assert.notEqual(tsc.status, 0);
assert.match(tsc.out, /use\.ts\(2,\d+\): error TS2322: Type 'string' is not assignable to type 'number'/);
write(dir, 'use.ts', `import { total } from './cart.ts';\ntotal([{ price: 1200, qty: 1 }], 0.1);\n`);
assert.equal(run(bin('tsc'), ['-p', '.'], { cwd: dir }).status, 0); // типы довольны, а скидка всё ещё двойная

// тест на найденный баг: сначала воспроизвести — тест должен упасть
const test = `import { test, expect } from 'vitest';
import { total } from './cart.ts';
test('скидка 10% применяется один раз', () => {
  expect(total([{ price: 1000, qty: 2 }], 0.1)).toBe(1800);
});
test('без скидки — просто сумма', () => {
  expect(total([{ price: 1200, qty: 1 }, { price: 300, qty: 3 }])).toBe(2100);
});
`;
const red = vitest({ 'cart.test.ts': test }, { dir });
assert.equal(red.numFailedTests, 1);
assert.equal(red.tests.find((t) => t.status === 'failed').name, 'скидка 10% применяется один раз');
assert.match(red.tests.find((t) => t.status === 'failed').failureMessages[0], /expected 1620 to be 1800/);

// исправление — тот же тест зелёный и дальше стережёт регрессию
write(dir, 'cart.ts', `export function total(items: { price: number; qty: number }[], discount = 0): number {
  const sum = items.reduce((s, i) => s + i.price * i.qty, 0);
  return Math.round(sum * (1 - discount));
}
`);
const green = vitest({}, { dir });
assert.equal(green.numPassedTests, 2);
assert.equal(green.numFailedTests, 0);

// строка из API: умножение приводит к числу, сложение склеивает
assert.equal('1200' * 1, 1200);
assert.equal('1200' + 300, '1200300');

console.log('intro ok');
