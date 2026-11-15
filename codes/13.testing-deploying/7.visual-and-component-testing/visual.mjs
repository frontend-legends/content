// Проверки к 13.07: скриншот-сравнение Playwright (эталон, регрессия, маска динамики) и axe-core в браузере.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { project, run, bin, read, write, list } from '../../_lib/project.mjs';
import { findChromium } from '../../_lib/browser.mjs';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const page = (color) => `<!doctype html><meta charset="utf-8">
<style>body{margin:0;font:16px sans-serif} .card{width:240px;padding:16px;border:1px solid #ccc}
button{background:${color};color:#fff;border:0;padding:8px 16px}</style>
<div class="card"><h2>Пуэр</h2><p class="date">Обновлено: <span id="now"></span></p><button>В корзину</button></div>
<script>document.getElementById('now').textContent = new Date().toISOString();</script>`;

const config = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  reporter: [['json', { outputFile: 'report.json' }]],
  use: { viewport: { width: 320, height: 240 }, launchOptions: { executablePath: ${JSON.stringify(findChromium() ?? '')} || undefined } },
});
`;
const spec = `import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('карточка без маски', async ({ page }) => {
  await page.setContent(readFileSync('card.html', 'utf8'));
  await expect(page.locator('.card')).toHaveScreenshot('card-raw.png');
});

test('карточка с маской даты', async ({ page }) => {
  await page.setContent(readFileSync('card.html', 'utf8'));
  await expect(page.locator('.card')).toHaveScreenshot('card.png', { mask: [page.locator('#now')] });
});

test('axe находит проблемы, которые не видит функциональный тест', async ({ page }) => {
  await page.setContent(\`<!doctype html><html lang="ru"><title>t</title><main><h1>Каталог</h1>
    <button style="background:#fff;color:#eee">Купить</button>
    <button><svg width="16" height="16"></svg></button>
    <img src="tea.png">
    <input type="email">
  </main></html>\`);
  await expect(page.getByRole('button', { name: 'Купить' })).toBeVisible(); // функционально всё «есть»
  await page.addScriptTag({ path: ${JSON.stringify(axePath)} });
  const ids = await page.evaluate(async () => (await axe.run()).violations.map((v) => v.id).sort());
  require('node:fs').writeFileSync('axe.json', JSON.stringify(ids));
});
`.replace("require('node:fs').writeFileSync", "(await import('node:fs')).writeFileSync");

const dir = project({ 'package.json': JSON.stringify({ type: 'module' }), 'playwright.config.mjs': config, 'tests/card.spec.mjs': spec, 'card.html': page('#2563eb') });
const pw = () => {
  const r = run(bin('playwright'), ['test', '--workers=1'], { cwd: dir, env: { CI: '' } });
  const report = JSON.parse(read(dir, 'report.json'));
  const out = {};
  const walk = (s) => { for (const sp of s.specs ?? []) for (const t of sp.tests) out[sp.title] = { status: t.status, error: (t.results.at(-1).error?.message ?? '').replace(/\x1B\[[0-9;]*m/g, '') }; (s.suites ?? []).forEach(walk); };
  report.suites.forEach(walk);
  return { r, out };
};

// 1. первого эталона нет — тест падает и записывает снимок
let res = pw();
assert.equal(res.out['карточка с маской даты'].status, 'unexpected');
assert.match(res.out['карточка с маской даты'].error, /A snapshot doesn't exist at .*card-(darwin|linux|win32)\.png, writing actual/);
// эталон хранится отдельно для каждой ОС: шрифты и сглаживание отличаются
assert.ok(list(dir, 'tests').some((f) => f.endsWith(`card-${process.platform}.png`)));
assert.deepEqual(JSON.parse(read(dir, 'axe.json')), ['button-name', 'color-contrast', 'image-alt', 'label']);

// 2. второй прогон: с маской стабильно, без маски дата меняется — ложное падение
res = pw();
assert.equal(res.out['карточка с маской даты'].status, 'expected');
assert.equal(res.out['карточка без маски'].status, 'unexpected');
assert.match(res.out['карточка без маски'].error, /\d+ pixels \(ratio [\d.]+ of all image pixels\) are different/);

// 3. цвет кнопки поменяли — настоящая визуальная регрессия, функционально всё то же
write(dir, 'card.html', page('#dc2626'));
res = pw();
assert.equal(res.out['карточка с маской даты'].status, 'unexpected');
assert.match(res.out['карточка с маской даты'].error, /pixels \(ratio [\d.]+ of all image pixels\) are different/);
assert.ok(list(dir, 'test-results').some((f) => f.endsWith('-diff.png'))); // картинка с отличиями для ревью

// 4. изменение принято — эталон обновляют явно
run(bin('playwright'), ['test', '--update-snapshots', '--workers=1'], { cwd: dir, env: { CI: '' } });
res = pw();
assert.equal(res.out['карточка с маской даты'].status, 'expected');

console.log('visual ok');
