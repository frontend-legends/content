// Проверки к 13.03: Vitest и Jest на ESM и TypeScript, окружения DOM, изоляция файлов, .only в CI, related, node:test.
import assert from 'node:assert/strict';
import { project, run, bin, vitest, write } from '../../_lib/project.mjs';

const esmTest = `import { sum } from './sum.js';
test('сумма', () => { expect(sum(2, 3)).toBe(5); });
`;
const tsTest = `import { sum } from './sum.ts';
const n: number = 5;
test('сумма в TS', () => { expect(sum(2, 3)).toBe(n); });
`;
const files = {
  'package.json': JSON.stringify({ type: 'module' }),
  'sum.js': 'export const sum = (a, b) => a + b;\n',
  'sum.ts': 'export const sum = (a: number, b: number): number => a + b;\n',
};

// --- Jest: ESM и TypeScript без настройки не работают ---
const jestDir = project({ ...files, 'esm.test.js': esmTest });
const jest = (args = [], env = {}) => run(bin('jest'), ['--ci', ...args], { cwd: jestDir, env });
const [major, minor] = process.versions.node.split('.').map(Number);
const plain = jest();
if (major === 24 && minor < 9) {
  // Jest 30 на Node.js до 24.9: ESM без трансформации или флага не загружается
  assert.notEqual(plain.status, 0);
  assert.match(plain.out, /Must use import to load ES Module/);
  assert.match(plain.out, /Use Node v24\.9\+ where Jest supports require\(esm\) natively/);
}
// с экспериментальными VM-модулями Node.js — работает
const vm = jest([], { NODE_OPTIONS: '--experimental-vm-modules' });
assert.equal(vm.status, 0, vm.out);
// TypeScript Jest сам не понимает — нужен ts-jest или Babel
write(jestDir, 'ts.test.ts', tsTest);
const ts = jest(['ts.test.ts'], { NODE_OPTIONS: '--experimental-vm-modules' });
assert.notEqual(ts.status, 0);

// --- Vitest: тот же код, ESM и TS сразу; API совместим с Jest при globals ---
const vt = vitest({ ...files, 'esm.test.js': esmTest, 'ts.test.ts': tsTest, 'vitest.config.js': 'export default { test: { globals: true } };' });
assert.equal(vt.numPassedTests, 2, vt.out);

// --- окружения: в node нет document, jsdom и happy-dom его дают, но без раскладки ---
const env = vitest({
  'node.test.js': `import { test, expect } from 'vitest';
test('node', () => { expect(typeof document).toBe('undefined'); });`,
  'jsdom.test.js': `// @vitest-environment jsdom
import { test, expect } from 'vitest';
test('jsdom', () => {
  document.body.innerHTML = '<button style="width:200px">Купить</button>';
  const b = document.querySelector('button');
  expect(b.textContent).toBe('Купить');
  expect(b.getBoundingClientRect().width).toBe(0); // раскладки нет
});`,
  'happy.test.js': `// @vitest-environment happy-dom
import { test, expect } from 'vitest';
test('happy-dom', () => { document.body.innerHTML = '<p>ok</p>'; expect(document.querySelector('p').textContent).toBe('ok'); });`,
});
assert.equal(env.numPassedTests, 3, env.out);

// --- изоляция: файлы не видят глобальное состояние друг друга, тесты внутри файла — видят ---
const iso = vitest({
  'counter.js': 'export let count = 0; export const inc = () => ++count;\n',
  'a.test.js': `import { test, expect } from 'vitest';
import { inc } from './counter.js';
test('a1', () => { globalThis.leak = 'a'; expect(inc()).toBe(1); });
test('a2 видит состояние модуля после a1', () => { expect(inc()).toBe(2); });`,
  'b.test.js': `import { test, expect } from 'vitest';
import { inc } from './counter.js';
test('b — модуль и глобальные заново', () => { expect(globalThis.leak).toBeUndefined(); expect(inc()).toBe(1); });`,
});
assert.equal(iso.numPassedTests, 3, iso.out);

// --- фильтр по имени ---
const filterDir = vitest({
  'cart.test.js': `import { test, expect } from 'vitest';
test('скидка один раз', () => expect(1).toBe(1));
test('скидка ноль', () => expect(1).toBe(1));
test('доставка', () => expect(1).toBe(1));`,
}, { args: ['-t', 'скидка'] });
assert.equal(filterDir.numPassedTests, 2);
assert.equal(filterDir.numPendingTests + filterDir.numTodoTests, 1);

// --- забытый test.only: локально тихо запускает один тест, в CI — ошибка ---
const only = { 'only.test.js': `import { test, expect } from 'vitest';
test.only('только этот', () => expect(1).toBe(1));
test('пропущен', () => expect(1).toBe(2));` };
const local = vitest(only);
assert.equal(local.numPassedTests, 1);
assert.equal(local.numFailedTests, 0); // сломанный тест молча пропущен
const ciDir = project({ 'package.json': JSON.stringify({ type: 'module' }), ...only });
const ci = run(bin('vitest'), ['run'], { cwd: ciDir, env: { CI: 'true' } });
assert.notEqual(ci.status, 0);
assert.match(ci.out, /Unexpected \.only modifier/);

// --- related: только тесты, которые зависят от изменённого файла ---
const relDir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'price.js': 'export const price = () => 1;\n',
  'delivery.js': 'export const delivery = () => 2;\n',
  'price.test.js': `import { test, expect } from 'vitest'; import { price } from './price.js'; test('price', () => expect(price()).toBe(1));`,
  'delivery.test.js': `import { test, expect } from 'vitest'; import { delivery } from './delivery.js'; test('delivery', () => expect(delivery()).toBe(2));`,
});
const related = run(bin('vitest'), ['related', 'price.js', '--run'], { cwd: relDir });
assert.equal(related.status, 0, related.out);
assert.match(related.out, /Affected\s+1 of 2 test files \(related to price\.js\)/);
assert.match(related.out, /Tests\s+1 passed \(1\)/);

// --- node:test: встроенный раннер, TypeScript без сборки за счёт удаления типов ---
const nodeDir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'sum.ts': files['sum.ts'],
  'sum.test.ts': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sum } from './sum.ts';
test('сумма', () => { const n: number = sum(2, 3); assert.equal(n, 5); });
`,
}, { linkModules: false });
const nodeRun = run(process.execPath, ['--test'], { cwd: nodeDir });
assert.equal(nodeRun.status, 0, nodeRun.out);
assert.match(nodeRun.out, /pass 1/);
assert.match(nodeRun.out, /fail 0/);

console.log('runners ok');
