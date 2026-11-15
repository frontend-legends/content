// Проверки к 13.04: асинхронность без await, часовой пояс, зависимость от порядка, поиск элементов как пользователь.
import assert from 'node:assert/strict';
import { project, run, bin, vitest } from '../../_lib/project.mjs';

const load = "const load = () => new Promise((r) => setTimeout(() => r(2), 10));";

// --- асинхронность: проверка в then без return теряется ---
const lost = vitest({ 'a.test.js': `import { test, expect } from 'vitest';
${load}
test('then без return', () => { load().then((v) => expect(v).toBe(3)); });` });
assert.equal(lost.status, 0);           // прогон зелёный
assert.equal(lost.numPassedTests, 1);   // хотя 2 !== 3

// Vitest отслеживает неожиданный .resolves и всё равно падает, а с await — правильно
const tracked = vitest({ 'a.test.js': `import { test, expect } from 'vitest';
${load}
test('resolves без await', () => { expect(load()).resolves.toBe(3); });
test('с await', async () => { await expect(load()).resolves.toBe(3); });
test('async и await', async () => { expect(await load()).toBe(2); });` });
assert.deepEqual(tracked.tests.map((t) => t.status), ['failed', 'failed', 'passed']);
assert.match(tracked.tests[0].failureMessages[0], /expected 2 to be 3/);

// --- часовой пояс: зелёный локально, красный в CI ---
const tzFiles = {
  'delivery.js': `export const deliveryDate = (iso) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long' }).format(new Date(iso));
export const deliveryDateIn = (iso, timeZone) => new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'long', timeZone }).format(new Date(iso));`,
  'delivery.test.js': `import { test, expect } from 'vitest';
import { deliveryDate, deliveryDateIn } from './delivery.js';
test('доставка 16 ноября (зависит от TZ машины)', () => { expect(deliveryDate('2026-11-15T22:30:00Z')).toBe('16 ноября'); });
test('доставка 16 ноября по Москве', () => { expect(deliveryDateIn('2026-11-15T22:30:00Z', 'Europe/Moscow')).toBe('16 ноября'); });`,
};
const tzDir = project({ 'package.json': JSON.stringify({ type: 'module' }), ...tzFiles });
const inTz = (TZ) => {
  run(bin('vitest'), ['run', '--reporter=json', '--outputFile=r.json'], { cwd: tzDir, env: { TZ } });
  return JSON.parse(run('cat', ['r.json'], { cwd: tzDir }).stdout).testResults[0].assertionResults.map((t) => t.status);
};
assert.deepEqual(inTz('Europe/Moscow'), ['passed', 'passed']); // «у разработчика»
assert.deepEqual(inTz('UTC'), ['failed', 'passed']);           // «в CI»

// --- скрытая зависимость от порядка: shuffle её показывает ---
const orderDir = project({
  'package.json': JSON.stringify({ type: 'module' }),
  'session.test.js': `import { test, expect } from 'vitest';
const session = { user: null };
test('вход сохраняет пользователя', () => { session.user = 'anya'; expect(session.user).toBe('anya'); });
test('приветствие по имени', () => { expect(\`Привет, \${session.user}\`).toBe('Привет, anya'); });
test('корзина пуста', () => { expect([]).toHaveLength(0); });`,
});
const order = (args) => run(bin('vitest'), ['run', ...args], { cwd: orderDir }).status;
assert.equal(order([]), 0); // по порядку всё зелёное
const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => order(['--sequence.shuffle', `--sequence.seed=${seed}`]));
assert.ok(seeds.includes(1), 'при перемешивании находится порядок, в котором тест падает');

// --- поиск как пользователь: роль и имя переживают смену разметки, класс — нет ---
const ui = (markup) => `// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { screen } from '@testing-library/dom';
test('по роли', () => {
  document.body.innerHTML = \`${markup}\`;
  expect(screen.getByRole('button', { name: 'В корзину' })).toBeTruthy();
});
test('по классу', () => {
  document.body.innerHTML = \`${markup}\`;
  expect(document.querySelector('.btn-primary')).not.toBeNull();
});`;
const v1 = vitest({ 'ui.test.js': ui('<div class="card"><button class="btn-primary">В корзину</button></div>') });
assert.deepEqual(v1.tests.map((t) => t.status), ['passed', 'passed']);
const v2 = vitest({ 'ui.test.js': ui('<article><button class="add-to-cart" type="button">В корзину</button></article>') });
assert.deepEqual(v2.tests.map((t) => t.status), ['passed', 'failed']);

// элемент без доступного имени роль-запрос не находит — это сигнал о доступности
const icon = vitest({ 'icon.test.js': `// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { screen } from '@testing-library/dom';
test('иконка без подписи', () => {
  document.body.innerHTML = '<button><svg></svg></button>';
  expect(() => screen.getByRole('button', { name: 'В корзину' })).toThrow(/Unable to find an accessible element with the role "button" and name "В корзину"/);
});` });
assert.equal(icon.numPassedTests, 1, icon.out);

console.log('unit ok');
