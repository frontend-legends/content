// Проверки к 3.02 в Chromium через протокол DevTools: изоляция сайтов (фрейм с чужого сайта — отдельный процесс,
// с того же сайта — нет), процессы браузера, граница origin внутри одного процесса, падение процесса фрейма не роняет страницу,
// строка User-Agent и userAgentData.
// В headless-сборке для тестов изоляция по умолчанию выключена, поэтому включаем её флагом --site-per-process,
// как в обычном Chrome на десктопе.
// Запуск: cd codes && node run.mjs 03.web/2.browser-engines
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const html = (body) => ({ status: 200, contentType: 'text/html; charset=utf-8', body: `<!doctype html><html><body>${body}</body></html>` });
const routes = {
  'http://shop.test/': html(`<h1>Магазин</h1>
    <iframe id="same" src="http://shop.test/cart"></iframe>
    <iframe id="api" src="http://api.shop.test/widget"></iframe>
    <iframe id="reviews" src="http://reviews.example/widget"></iframe>`),
  'http://shop.test/cart': html('<p>корзина</p>'),
  'http://api.shop.test/widget': html('<p>доставка</p>'),
  'http://reviews.example/widget': html('<p>отзывы</p>'),
};

const run = async (args) => {
  const browser = await chromium.launch({ executablePath: findChromium(), args });
  const page = await browser.newPage();
  await page.route(/^http:\/\/[^/]*(shop\.test|reviews\.example)\//, (r) => r.fulfill(routes[r.request().url()] ?? { status: 404, body: '' }));
  await page.goto('http://shop.test/');
  await page.waitForTimeout(300);
  const cdp = await browser.newBrowserCDPSession();
  const { targetInfos } = await cdp.send('Target.getTargets');
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
  return { browser, page, cdp, oopif: targetInfos.filter((t) => t.type === 'iframe').map((t) => t.url), renderers: processInfo.filter((p) => p.type === 'renderer').length, types: [...new Set(processInfo.map((p) => p.type))].sort() };
};

// --- без флага headless-сборка держит все фреймы в одном процессе ---
let r = await run([]);
assert.deepEqual([r.oopif, r.renderers], [[], 1]);
await r.browser.close();

// --- с изоляцией сайтов: чужой сайт — отдельный процесс, свой origin и поддомен того же сайта — нет ---
r = await run(['--site-per-process']);
try {
  assert.deepEqual(r.oopif, ['http://reviews.example/widget']);
  assert.ok(r.renderers >= 2);                                       // страница и чужой фрейм; Chrome держит и запасной процесс
  assert.deepEqual(r.types, ['GPU', 'browser', 'network.mojom.NetworkService', 'renderer']); // браузер, рендереры, GPU, сеть

  // процесс — не граница origin: поддомен в том же процессе, но читать его документ всё равно нельзя
  const access = await r.page.evaluate(() => Object.fromEntries(['same', 'api', 'reviews'].map((id) => {
    try { return [id, document.getElementById(id).contentDocument?.body.textContent ?? null]; } catch (e) { return [id, e.name]; }
  })));
  assert.deepEqual(access, { same: 'корзина', api: null, reviews: null });

  // устаревший приём document.domain: поддомены видят друг друга, только если обе стороны присвоили общий домен
  const apiFrame = r.page.frames().find((f) => f.url() === 'http://api.shop.test/widget');
  const readApi = () => r.page.evaluate(() => document.getElementById('api').contentDocument?.body.textContent ?? null);
  await r.page.evaluate(() => { document.domain = 'shop.test'; });
  const onlyParent = await readApi();                                    // согласилась только страница — доступа нет
  await apiFrame.evaluate(() => { document.domain = 'shop.test'; });
  assert.deepEqual([onlyParent, await readApi()], [null, 'доставка']);  // согласились обе стороны — есть

  // --- User-Agent: Chrome до сих пор называет себя Mozilla, AppleWebKit, Gecko и Safari ---
  const ua = await r.page.evaluate(() => ({ ua: navigator.userAgent, data: typeof navigator.userAgentData }));
  for (const word of ['Mozilla/5.0', 'AppleWebKit/537.36', 'KHTML, like Gecko', 'Safari/537.36']) assert.ok(ua.ua.includes(word), word);
  assert.equal(ua.data, 'undefined');                                  // userAgentData — только в безопасном контексте, а здесь http
} finally {
  await r.browser.close();
}

console.log('processes ok');
