// Проверки к 13.07: снапшоты Vitest (ломаются от переименования класса, -u принимает что угодно)
// и браузерный режим Vitest — настоящая раскладка вместо нулей jsdom.
import assert from 'node:assert/strict';
import { vitest, write, read, list } from '../../_lib/project.mjs';
import { findChromium } from '../../_lib/browser.mjs';

const card = (cls, price) => `export const card = () => '<div class="${cls}"><h2>Пуэр</h2><b>${price}</b><button>В корзину</button></div>';\n`;
const snapTest = `import { test, expect } from 'vitest';
import { card } from './card.js';
test('снапшот карточки', () => { expect(card()).toMatchSnapshot(); });
test('осмысленная проверка', () => { expect(card()).toContain('<b>1 200 ₽</b>'); });
`;

// первый прогон записывает снапшот
const first = vitest({ 'card.js': card('card', '1 200 ₽'), 'card.test.js': snapTest });
assert.equal(first.numPassedTests, 2);
assert.ok(list(first.dir, '__snapshots__').includes('card.test.js.snap'));
assert.match(read(first.dir, '__snapshots__/card.test.js.snap'), /exports\[`снапшот карточки 1`\]/);

// переименовали класс — для пользователя ничего не изменилось, снапшот упал
const renamed = vitest({ 'card.js': card('product-card', '1 200 ₽') }, { dir: first.dir });
assert.deepEqual(renamed.tests.map((t) => t.status), ['failed', 'passed']);
assert.match(renamed.tests[0].failureMessages[0], /Snapshot `снапшот карточки 1` mismatched/);

// настоящая ошибка — цена — а «обновить снапшоты» принимает и её
const broken = vitest({ 'card.js': card('product-card', 'NaN ₽') }, { dir: first.dir, args: ['-u'] });
assert.deepEqual(broken.tests.map((t) => t.status), ['passed', 'failed']); // снапшот молча переписан, спасла только явная проверка
assert.match(read(first.dir, '__snapshots__/card.test.js.snap'), /NaN ₽/);

// --- браузерный режим: тот же тест, что в jsdom дал ширину 0 ---
const sizeTest = `import { test, expect } from 'vitest';
test('ширина и перекрытие', () => {
  document.body.innerHTML = '<button style="width:200px;height:40px">Оформить</button><div style="position:fixed;inset:0">cookie</div>';
  const b = document.querySelector('button');
  expect(b.getBoundingClientRect().width).toBe(200);
  const r = b.getBoundingClientRect();
  expect(document.elementFromPoint(r.x + 10, r.y + 10)).not.toBe(b); // кнопку перекрыли
});
`;
const jsdomRun = vitest({ 'vitest.config.js': "export default { test: { environment: 'jsdom' } };", 'size.test.js': sizeTest });
assert.equal(jsdomRun.numFailedTests, 1);
assert.match(jsdomRun.tests[0].failureMessages[0], /expected \+0 to be 200/);

const browserRun = vitest({
  'vitest.config.js': `import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
export default defineConfig({ test: { browser: { enabled: true, headless: true,
  provider: playwright({ launchOptions: { executablePath: ${JSON.stringify(findChromium() ?? null)} ?? undefined } }),
  instances: [{ browser: 'chromium' }] } } });`,
  'size.test.js': sizeTest,
});
assert.equal(browserRun.numPassedTests, 1, browserRun.out);

console.log('component ok');
