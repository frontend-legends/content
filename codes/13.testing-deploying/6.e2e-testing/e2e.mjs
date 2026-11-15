// Проверки к 13.06: настоящий Playwright Test — автоожидание, перекрытая кнопка, строгие локаторы,
// подмена сети, повтор и «flaky», изоляция контекстов, сохранённый вход.
import assert from 'node:assert/strict';
import { project, run, bin, read } from '../../_lib/project.mjs';
import { findChromium } from '../../_lib/browser.mjs';

const server = `import { createServer } from 'node:http';
const pages = {
  '/': \`<h1>Пуэр</h1><p id="stock"></p>
<button id="buy" hidden>В корзину</button>
<script>
  setTimeout(() => { document.getElementById('buy').hidden = false; }, 400);
  fetch('/api/stock').then((r) => r.json()).then((s) => { document.getElementById('stock').textContent = 'На складе: ' + s.count; })
    .catch(() => { document.getElementById('stock').textContent = 'Остаток неизвестен'; });
  document.getElementById('buy').onclick = () => { document.querySelector('h1').textContent = 'В корзине: 1'; };
</script>\`,
  '/banner': \`<button>Оформить</button><div style="position:fixed;inset:0;background:#0003">Мы используем cookie</div>\`,
  '/two': \`<button>Купить</button><button>Купить</button>\`,
  '/login': \`<button onclick="document.cookie='session=abc; path=/'; location.href='/account'">Войти</button>\`,
  '/account': \`<p id="who"></p><script>document.getElementById('who').textContent = document.cookie.includes('session=abc') ? 'Вы вошли' : 'Гость';</script>\`,
};
createServer((req, res) => {
  if (req.url === '/api/stock') { res.setHeader('content-type', 'application/json'); return setTimeout(() => res.end('{"count":3}'), 300); }
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><meta charset="utf-8">' + (pages[req.url] ?? 'not found'));
}).listen(4173);
`;

const config = `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'e2e',
  retries: 1,
  timeout: 5000,
  expect: { timeout: 2000 },
  reporter: [['json', { outputFile: 'report.json' }]],
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: ${JSON.stringify(findChromium() ?? '')} || undefined } },
  webServer: { command: 'node server.mjs', url: 'http://localhost:4173', reuseExistingServer: false },
});
`;

const spec = `import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('автоожидание: кнопка появляется через 400 мс', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'В корзину' }).click();
  await expect(page.getByRole('heading')).toHaveText('В корзине: 1');
});

test('проверка без повторов видит страницу раньше времени', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('#stock').textContent()).toBe('На складе: 3');
});

test('веб-проверка ждёт', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stock')).toHaveText('На складе: 3');
});

test('кнопку перекрыл баннер', async ({ page }) => {
  await page.goto('/banner');
  await page.getByRole('button', { name: 'Оформить' }).click({ timeout: 1000 });
});

test('два элемента на один локатор', async ({ page }) => {
  await page.goto('/two');
  await page.getByRole('button', { name: 'Купить' }).click();
});

test('подмена API: ошибка сервера', async ({ page }) => {
  await page.route('**/api/stock', (route) => route.fulfill({ status: 500, body: '' }));
  await page.goto('/');
  await expect(page.locator('#stock')).toHaveText('Остаток неизвестен');
});

test('нестабильный: падает с первой попытки', async ({}, testInfo) => {
  expect(testInfo.retry).toBe(1);
});

test('контекст 1 пишет в localStorage', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('cart', '1'));
  expect(await page.evaluate(() => localStorage.getItem('cart'))).toBe('1');
});

test('контекст 2 его не видит', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => localStorage.getItem('cart'))).toBeNull();
});

test('сохранённый вход', async ({ browser }) => {
  const first = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const page = await first.newPage();
  await page.goto('/login');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('#who')).toHaveText('Вы вошли');
  await first.storageState({ path: 'auth.json' });
  await first.close();

  const reused = await browser.newContext({ baseURL: 'http://localhost:4173', storageState: 'auth.json' });
  const again = await reused.newPage();
  await again.goto('/account');
  await expect(again.locator('#who')).toHaveText('Вы вошли');

  const fresh = await browser.newContext({ baseURL: 'http://localhost:4173' });
  const guest = await fresh.newPage();
  await guest.goto('/account');
  await expect(guest.locator('#who')).toHaveText('Гость');
});
`;

const dir = project({ 'package.json': JSON.stringify({ type: 'module' }), 'server.mjs': server, 'playwright.config.mjs': config, 'e2e/shop.spec.mjs': spec });
const r = run(bin('playwright'), ['test', '--workers=1'], { cwd: dir, env: { CI: '' } });
const report = JSON.parse(read(dir, 'report.json'));
const results = {};
const walk = (suite) => {
  for (const s of suite.specs ?? []) for (const t of s.tests) results[s.title] = { status: t.status, errors: t.results.map((x) => (x.error?.message ?? '').replace(/\x1B\[[0-9;]*m/g, '')).join('\n'), attempts: t.results.length };
  for (const c of suite.suites ?? []) walk(c);
};
report.suites.forEach(walk);
const st = (name) => results[name]?.status;

assert.equal(st('автоожидание: кнопка появляется через 400 мс'), 'expected', r.out);
assert.equal(st('проверка без повторов видит страницу раньше времени'), 'unexpected');
assert.match(results['проверка без повторов видит страницу раньше времени'].errors, /Expected: "На складе: 3"\s+Received: ""/);
assert.equal(st('веб-проверка ждёт'), 'expected');

assert.equal(st('кнопку перекрыл баннер'), 'unexpected');
assert.match(results['кнопку перекрыл баннер'].errors, /intercepts pointer events/);

assert.equal(st('два элемента на один локатор'), 'unexpected');
assert.match(results['два элемента на один локатор'].errors, /strict mode violation: getByRole\('button', \{ name: 'Купить' \}\) resolved to 2 elements/);

assert.equal(st('подмена API: ошибка сервера'), 'expected');

// упал, прошёл на повторе — отчёт помечает его как flaky, а не как успех
assert.equal(st('нестабильный: падает с первой попытки'), 'flaky');
assert.equal(results['нестабильный: падает с первой попытки'].attempts, 2);

assert.equal(st('контекст 1 пишет в localStorage'), 'expected');
assert.equal(st('контекст 2 его не видит'), 'expected');
assert.equal(st('сохранённый вход'), 'expected');
assert.ok(JSON.parse(read(dir, 'auth.json')).cookies.some((c) => c.name === 'session'));

assert.equal(report.stats.flaky, 1);
assert.equal(report.stats.unexpected, 3);

console.log('e2e ok');
