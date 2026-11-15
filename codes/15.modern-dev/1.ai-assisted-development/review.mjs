// Проверки к 15.01: правдоподобные, но неверные подсказки — и чем их ловят. Каждая «подсказка» выглядит
// разумно и часто встречается в сгенерированном коде.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { project, run, bin, vitest } from '../../_lib/project.mjs';

const require = createRequire(import.meta.url);
process.removeAllListeners('warning');
const { DatabaseSync } = await import('node:sqlite');

const orders = [{ id: 1, status: 'paid' }, { id: 2, status: 'new' }, { id: 3, status: 'paid' }];

// 1. несуществующий API: метод из отклонённого предложения
assert.equal(typeof orders.groupBy, 'undefined');
assert.throws(() => orders.groupBy((o) => o.status), TypeError);
assert.deepEqual(Object.keys(Object.groupBy(orders, (o) => o.status)), ['paid', 'new']); // настоящий API

// 2. устаревший API: удалён в новой мажорной версии
assert.equal(typeof require('react-dom').render, 'undefined');            // ReactDOM.render удалён в React 19
assert.equal(typeof require('react-dom/client').createRoot, 'function');
await assert.rejects(import('ai/react'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' }); // useChat переехал в @ai-sdk/react

// 3. тонкий баг на краях: сортировка по умолчанию — строковая
const prices = [1200, 300, 90];
assert.deepEqual([...prices].sort(), [1200, 300, 90]);                 // «отсортировано» как строки
assert.deepEqual([...prices].sort((a, b) => a - b), [90, 300, 1200]);

// 4. месяц в Date считается с нуля
assert.equal(new Date(2026, 11, 1).getMonth() + 1, 12);                // «11» — это декабрь

// 5. безопасность: SQL склейкой строк
const db = new DatabaseSync(':memory:');
db.exec("create table users (name text, email text); insert into users values ('anya', 'a@shop.example'), ('petya', 'p@shop.example');");
const unsafe = (name) => db.prepare(`select email from users where name = '${name}'`).all();
const safe = (name) => db.prepare('select email from users where name = ?').all(name);
assert.equal(unsafe('anya').length, 1);
assert.equal(unsafe("' or '1'='1").length, 2); // инъекция: все пользователи
assert.equal(safe("' or '1'='1").length, 0);

// 6. всё это ловят типы и тесты — если они есть
const dir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2024', lib: ['es2024'], module: 'nodenext', moduleResolution: 'nodenext' } }),
  'suggestion.ts': `const orders = [{ id: 1, status: 'paid' }];\nexport const grouped = orders.groupBy((o) => o.status);\n`,
});
const tsc = run(bin('tsc'), ['-p', '.'], { cwd: dir });
assert.notEqual(tsc.status, 0);
assert.match(tsc.out, /Property 'groupBy' does not exist on type/);

const t = vitest({ 'cheapest.js': 'export const cheapest = (prices) => [...prices].sort()[0];\n', 'cheapest.test.js': `import { test, expect } from 'vitest';
import { cheapest } from './cheapest.js';
test('самая низкая цена', () => { expect(cheapest([1200, 300, 90])).toBe(90); });` });
assert.equal(t.numFailedTests, 1);
assert.match(t.tests[0].failureMessages[0], /expected 1200 to be 90/);

console.log('review ok');
