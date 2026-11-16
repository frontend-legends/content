// Проверки к 5.08 в Chromium на HTTP-сервере со счётчиком запросов: width/height → aspect-ratio до загрузки,
// выбор из srcset (x-дескрипторы и плотность, w без sizes = ширина окна, sizes и sizes="auto"), picture и media,
// loading="lazy" у картинок и iframe, currentColor у SVG inline и через img, имя SVG-картинки,
// iframe sandbox и allow (Permissions Policy), title у iframe.
// Запуск: cd codes && node run.mjs 05.html/8.media
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const png = (w, h) => { const p = new PNG({ width: w, height: h }); p.data.fill(180); return PNG.sync.write(p); };
const files = { '/tea-400.png': png(400, 267), '/tea-800.png': png(800, 533), '/tea-1200.png': png(1200, 800), '/tea-mobile.png': png(400, 400), '/icon.png': png(32, 32), '/icon@2x.png': png(64, 64) };
const svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="currentColor"/></svg>';
const hits = [];
const pages = new Map();
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  hits.push(path);
  if (files[path]) { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }); return res.end(files[path]); }
  if (path === '/icon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); return res.end(svgIcon); }
  if (path === '/widget') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<!doctype html><p>Отзывы</p>'); }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(pages.get(path) ?? '');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch({ executablePath: findChromium() });
const open = async (path, html, ctx = {}) => {
  pages.set(path, `<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width"><style>body{margin:0}</style></head><body>${html}</body></html>`);
  hits.length = 0;
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...ctx });
  const page = await context.newPage();
  await page.goto(base + path, { waitUntil: 'load' });
  return { page, close: () => context.close() };
};
const src = (page, sel = 'img') => page.$eval(sel, (i) => new URL(i.currentSrc).pathname);

try {
  // --- width и height резервируют место ещё до загрузки: из них получается aspect-ratio ---
  let p = await open('/ratio', `<img id="i" src="/tea-1200.png?never" width="1200" height="800" alt="" style="width: 300px; height: auto">`);
  const ratio = await p.page.$eval('#i', (i) => ({ ar: getComputedStyle(i).aspectRatio, h: i.getBoundingClientRect().height }));
  assert.deepEqual(ratio, { ar: 'auto 1200 / 800', h: 200 });
  await p.close();

  // --- x-дескрипторы: браузер берёт файл под плотность экрана ---
  for (const [dpr, file] of [[1, '/icon.png'], [2, '/icon@2x.png']]) {
    p = await open('/x', `<img src="/icon.png" srcset="/icon.png 1x, /icon@2x.png 2x" width="32" height="32" alt="">`, { deviceScaleFactor: dpr });
    assert.equal(await src(p.page), file);
    await p.close();
  }

  // --- w-дескрипторы: без sizes браузер считает, что картинка шириной в окно ---
  const srcset = 'srcset="/tea-400.png 400w, /tea-800.png 800w, /tea-1200.png 1200w"';
  p = await open('/nosizes', `<div style="width: 300px"><img src="/tea-400.png" ${srcset} alt="" style="width: 100%"></div>`);
  assert.equal(await src(p.page), '/tea-1200.png');                     // колонка 300px, а скачан файл для 1280px
  await p.close();
  p = await open('/sizes', `<div style="width: 300px"><img src="/tea-400.png" ${srcset} sizes="300px" alt="" style="width: 100%"></div>`);
  assert.equal(await src(p.page), '/tea-400.png');
  await p.close();
  p = await open('/sizes2x', `<div style="width: 300px"><img src="/tea-400.png" ${srcset} sizes="300px" alt="" style="width: 100%"></div>`, { deviceScaleFactor: 2 });
  assert.equal(await src(p.page), '/tea-800.png');                      // 300 × 2 = 600 → ближайший больший 800w
  await p.close();
  // sizes="auto" у ленивой картинки: браузер берёт настоящую ширину из раскладки
  p = await open('/sizesauto', `<div style="height: 2000px"></div><div style="width: 300px"><img id="lz" loading="lazy" src="/tea-400.png" ${srcset} sizes="auto" alt="" style="width: 100%"></div>`);
  await p.page.$eval('#lz', (i) => i.scrollIntoView());
  await p.page.waitForFunction(() => document.getElementById('lz').complete && document.getElementById('lz').naturalWidth > 0);
  assert.equal(await src(p.page, '#lz'), '/tea-400.png');
  await p.close();

  // --- picture: другой кадр для узкого экрана; отображается и стилизуется img ---
  const pic = `<picture><source media="(width < 600px)" srcset="/tea-mobile.png"><img id="pi" src="/tea-1200.png" alt="Улун молочный" style="width: 100%"></picture>`;
  p = await open('/picture', pic, { viewport: { width: 390, height: 800 } });
  assert.equal(await src(p.page, '#pi'), '/tea-mobile.png');
  assert.equal(await p.page.$eval('#pi', (i) => i.getBoundingClientRect().height), 390); // квадратный кадр
  await p.close();
  p = await open('/picture', pic);
  assert.equal(await src(p.page, '#pi'), '/tea-1200.png');
  await p.close();

  // --- loading="lazy": картинка и iframe ниже экрана не грузятся, пока к ним не прокрутили ---
  p = await open('/lazy', `<img src="/tea-400.png" alt="" width="400" height="267">
    <div style="height: 5000px"></div>
    <img id="far" loading="lazy" src="/tea-800.png" alt="" width="800" height="533">
    <iframe id="fr" loading="lazy" src="/widget" title="Отзывы покупателей" width="400" height="200"></iframe>`);
  assert.deepEqual([hits.includes('/tea-400.png'), hits.includes('/tea-800.png'), hits.includes('/widget')], [true, false, false]);
  await p.page.$eval('#fr', (f) => f.scrollIntoView());
  await p.page.waitForFunction(() => document.getElementById('far').complete);
  await p.page.waitForTimeout(300);
  assert.deepEqual([hits.includes('/tea-800.png'), hits.includes('/widget')], [true, true]);
  await p.close();

  // --- SVG: inline наследует currentColor, через img — нет; имя у смысловой SVG ---
  p = await open('/svg', `<div style="color: rgb(255, 0, 0)">
      <svg id="inl" width="20" height="20" viewBox="0 0 10 10" role="img" aria-label="Корзина"><rect width="10" height="10" fill="currentColor"/></svg>
      <img id="viaimg" src="/icon.svg" width="20" height="20" alt="">
      <svg width="20" height="20" viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" fill="currentColor"/></svg>
    </div>`);
  const shot = PNG.sync.read(await p.page.screenshot({ clip: { x: 0, y: 0, width: 60, height: 22 } }));
  const px = (x, y) => [...shot.data.slice((y * shot.width + x) * 4, (y * shot.width + x) * 4 + 3)];
  const inl = await p.page.$eval('#inl', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x + 10), Math.round(r.y + 10)]; });
  const img = await p.page.$eval('#viaimg', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.x + 10), Math.round(r.y + 10)]; });
  assert.deepEqual(px(...inl), [255, 0, 0]);                              // взяла цвет текста страницы
  assert.deepEqual(px(...img), [0, 0, 0]);                                // в img currentColor — чёрный по умолчанию
  assert.equal(await p.page.getByRole('img', { name: 'Корзина' }).count(), 1);
  await p.close();

  // --- iframe sandbox: без разрешений скрипты не работают; allow-scripts — работают ---
  p = await open('/sandbox', `
    <iframe id="s1" sandbox srcdoc="<p id=t>нет</p><script>document.getElementById('t').textContent='скрипт'</script>"></iframe>
    <iframe id="s2" sandbox="allow-scripts" srcdoc="<p id=t>нет</p><script>document.getElementById('t').textContent='скрипт'</script>"></iframe>`);
  await p.page.waitForTimeout(200);
  const texts = await Promise.all(['s1', 's2'].map((id) => p.page.frameLocator('#' + id).locator('#t').textContent()));
  assert.deepEqual(texts, ['нет', 'скрипт']);
  // allow-scripts без allow-same-origin: документ во фрейме — с «непрозрачным» origin
  const origin = await (await (await p.page.$('#s2')).contentFrame()).evaluate(() => self.origin);
  assert.equal(origin, 'null');
  await p.close();

  // --- allow: доступ фрейма к возможностям устройства (Permissions Policy) ---
  p = await open('/allow', `<iframe id="a1" src="${base.replace('localhost', '127.0.0.1')}/widget" title="Звонок"></iframe>
    <iframe id="a2" src="${base.replace('localhost', '127.0.0.1')}/widget" allow="camera; microphone" title="Звонок"></iframe>`);
  const policy = await p.page.evaluate(() => ['a1', 'a2'].map((id) => document.getElementById(id).featurePolicy.allowsFeature('camera')));
  assert.deepEqual(policy, [false, true]);                                // чужому фрейму камера по умолчанию закрыта
  assert.equal(await p.page.getByTitle('Звонок').count(), 2);
  await p.close();
} finally {
  await browser.close();
  server.close();
}

console.log('media ok');
