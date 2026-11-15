// Проверки к 13.08: покрытие Vitest (строки против ветвей, пороги) и мутационное тестирование Stryker.
import assert from 'node:assert/strict';
import { project, run, bin, read, write } from '../../_lib/project.mjs';

const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  // скидка 10% от 10 штук
  'discount.js': `export function price(base, qty) {
  return qty >= 10 ? base * qty * 0.9 : base * qty;
}
`,
  'vitest.config.js': "export default { test: { coverage: { provider: 'v8', reporter: ['json-summary', 'text'], include: ['discount.js'] } } };",
  'stryker.config.json': JSON.stringify({ testRunner: 'vitest', mutate: ['discount.js'], reporters: ['json'], jsonReporter: { fileName: 'mutation.json' }, coverageAnalysis: 'perTest', tempDirName: '.stryker-tmp' }),
});
const tests = (body) => write(dir, 'discount.test.js', `import { test, expect } from 'vitest';\nimport { price } from './discount.js';\n${body}\n`);
const coverage = () => {
  const r = run(bin('vitest'), ['run', '--coverage'], { cwd: dir });
  const t = JSON.parse(read(dir, 'coverage/coverage-summary.json')).total;
  return { status: r.status, out: r.out, lines: t.lines.pct, statements: t.statements.pct, functions: t.functions.pct, branches: t.branches.pct };
};
const mutation = () => {
  const r = run(bin('stryker'), ['run'], { cwd: dir });
  assert.equal(r.status, 0, r.out);
  const mutants = Object.values(JSON.parse(read(dir, 'mutation.json')).files)[0].mutants;
  const survived = mutants.filter((m) => m.status === 'Survived' || m.status === 'NoCoverage').map((m) => m.replacement);
  const killed = mutants.filter((m) => m.status === 'Killed').length;
  return { total: mutants.length, killed, survived, score: Math.round((killed / mutants.length) * 100) };
};

// --- 1. тест без проверки: строки 100%, ветви 50%, мутанты живы все ---
tests(`test('считает', () => { price(100, 1); });`);
const c1 = coverage();
assert.deepEqual([c1.lines, c1.statements, c1.functions, c1.branches], [100, 100, 100, 50]);
const m1 = mutation();
assert.equal(m1.total, 8);
assert.equal(m1.killed, 0); // ни одна внесённая ошибка не поймана

// порог покрытия ветвей роняет прогон
write(dir, 'vitest.config.js', "export default { test: { coverage: { provider: 'v8', reporter: ['json-summary'], include: ['discount.js'], thresholds: { branches: 80 } } } };");
const gated = coverage();
assert.notEqual(gated.status, 0);
assert.match(gated.out, /Coverage for branches \(50%\) does not meet global threshold \(80%\)/);
write(dir, 'vitest.config.js', "export default { test: { coverage: { provider: 'v8', reporter: ['json-summary'], include: ['discount.js'] } } };");

// --- 2. проверки на 1 и 20 штук: покрытие 100% везде, но граница не проверена ---
tests(`test('одна штука — без скидки', () => { expect(price(100, 1)).toBe(100); });
test('двадцать штук — скидка', () => { expect(price(100, 20)).toBe(1800); });`);
const c2 = coverage();
assert.deepEqual([c2.lines, c2.branches], [100, 100]);
const m2 = mutation();
// «>=» заменили на «>» — граница не проверена; «*» заменили на «/» — при qty = 1 это одно и то же
assert.deepEqual(m2.survived, ['qty > 10', 'base / qty']);
assert.equal(m2.score, 75);

// --- 3. добавили границу и не единичное количество: все мутанты убиты ---
tests(`test('три штуки — без скидки', () => { expect(price(100, 3)).toBe(300); });
test('двадцать штук — скидка', () => { expect(price(100, 20)).toBe(1800); });
test('ровно десять — уже скидка', () => { expect(price(100, 10)).toBe(900); });`);
const m3 = mutation();
assert.deepEqual(m3.survived, []);
assert.equal(m3.score, 100);

console.log('coverage ok');
