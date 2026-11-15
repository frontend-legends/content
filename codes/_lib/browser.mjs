// Хелпер для проверок, которым нужен настоящий браузер: вычисленные CSS-значения, раскладка, события, порядок кадров.
//
//   import { withPage } from '../../_lib/browser.mjs';
//   await withPage(async (page) => {
//     await page.setContent('<style>…</style><div id="a">…</div>');
//     const color = await page.$eval('#a', (el) => getComputedStyle(el).color);
//     assert.equal(color, 'rgb(255, 0, 0)');
//   });
//
// Браузер: CHROMIUM_PATH, иначе chromium из кеша Playwright (npx playwright-core install chromium-headless-shell).
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), 'Library/Caches/ms-playwright'), join(homedir(), '.cache/ms-playwright')].filter(Boolean);
  const bins = [
    'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell',
    'chrome-headless-shell-linux64/chrome-headless-shell',
    'chrome-linux/headless_shell',
  ];
  for (const dir of caches) {
    if (!existsSync(dir)) continue;
    for (const d of readdirSync(dir).filter((n) => n.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const b of bins) if (existsSync(join(dir, d, b))) return join(dir, d, b);
    }
  }
  return undefined; // пусть playwright-core сам найдёт свой
}

export async function withPage(fn, { viewport = { width: 1280, height: 800 } } = {}) {
  const browser = await chromium.launch({ executablePath: findChromium() });
  try {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e));
    const result = await fn(page);
    if (errors.length) throw errors[0];
    return result;
  } finally {
    await browser.close();
  }
}
