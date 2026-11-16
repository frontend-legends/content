// Проверки к 3.06 в Chromium на HTTP-сервере: как браузер измеряет метрики.
// LCP: без buffered ранние записи теряются, кандидаты растут, запись прекращается после ввода; разбор LCP из web-vitals.
// CLS: окна сессий (пауза меньше 1 с, длина до 5 с) против простой суммы; сдвиг после ввода не считается.
// INP: записи Event Timing, общий interactionId у pointerdown/pointerup/click, длительность кратна 8 мс,
// фазы и скрипты long-animation-frame из web-vitals.
// Navigation и Resource Timing: TTFB с задержкой сервера, Server-Timing, нули у чужого ресурса без Timing-Allow-Origin.
// Запуск: cd codes && node run.mjs 03.web/6.core-web-vitals
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const require = createRequire(import.meta.url);
// iife-сборки нет в exports пакета — берём её из той же папки, что и экспортируемую attribution-сборку
const vitals = readFileSync(join(dirname(require.resolve('web-vitals/attribution')), 'web-vitals.attribution.iife.js'), 'utf8');
const png = (w, h) => { const p = new PNG({ width: w, height: h }); for (let i = 0; i < p.data.length; i += 4) p.data.set([120, 80, 40, 255], i); return PNG.sync.write(p); };
const images = { '/hero.png': png(600, 400), '/small.png': png(200, 100), '/big.png': png(800, 500) };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pages = new Map();
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const delay = Number(url.searchParams.get('d') ?? 0);
  await wait(delay);
  if (images[url.pathname]) {
    const headers = { 'content-type': 'image/png', 'cache-control': 'no-store' };
    if (url.searchParams.has('tao')) headers['timing-allow-origin'] = '*';
    res.writeHead(200, headers);
    return res.end(images[url.pathname]);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'server-timing': 'db;dur=180;desc="catalog", render;dur=40' });
  res.end(pages.get(url.pathname) ?? '');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const other = base.replace('localhost', '127.0.0.1');                // другой origin для ресурсов

const browser = await chromium.launch({ executablePath: findChromium() });
const open = async (path, html) => {
  pages.set(path, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><script>${vitals}</script></head><body style="margin:0">${html}</body></html>`);
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'load' });
  return { page, close: () => ctx.close() };
};

try {
  // --- LCP: кандидаты растут; после ввода новые не записываются ---
  let p = await open('/lcp', `<h1 id="title" style="font-size:24px">Улун</h1>
    <img id="small" src="/small.png" width="200" height="100" alt="">
    <div id="slot"></div>`);
  await p.page.evaluate(() => { window.__lcp = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp.push(e.element?.id || e.element?.tagName); }).observe({ type: 'largest-contentful-paint', buffered: true }); });
  await p.page.waitForTimeout(200);
  // подписка без buffered после загрузки не получает уже случившиеся записи
  const late = await p.page.evaluate(() => new Promise((r) => {
    const got = { plain: 0, buffered: 0 };
    new PerformanceObserver((l) => { got.plain += l.getEntries().length; }).observe({ type: 'largest-contentful-paint' });
    new PerformanceObserver((l) => { got.buffered += l.getEntries().length; }).observe({ type: 'largest-contentful-paint', buffered: true });
    setTimeout(() => r(got), 300);
  }));
  assert.equal(late.plain, 0);
  assert.ok(late.buffered > 0);
  // добавляем крупную картинку — она станет новым кандидатом
  await p.page.evaluate(() => { const i = new Image(600, 400); i.id = 'hero'; i.src = '/hero.png'; document.getElementById('slot').append(i); });
  await p.page.waitForTimeout(300);
  const beforeInput = await p.page.evaluate(() => [...window.__lcp]);
  assert.ok(beforeInput.includes('small') && beforeInput.at(-1) === 'hero', JSON.stringify(beforeInput));
  // после клика пользователя LCP больше не обновляется
  await p.page.mouse.click(5, 5);
  await p.page.evaluate(() => { const i = new Image(800, 500); i.id = 'after'; i.src = '/big.png?late'; document.body.append(i); });
  await p.page.waitForTimeout(300);
  assert.equal((await p.page.evaluate(() => window.__lcp)).includes('after'), false);
  await p.close();

  // разбор LCP на части: TTFB, задержка начала загрузки, загрузка, задержка отрисовки
  p = await open('/lcp-parts', `<img id="hero" src="/hero.png?d=300" width="600" height="400" alt="">`);
  const parts = await p.page.evaluate(() => new Promise((resolve) => {
    webVitals.onLCP((m) => resolve({ value: Math.round(m.value), a: m.attribution }), { reportAllChanges: true });
  }));
  assert.ok(parts.a.resourceLoadDuration >= 280, JSON.stringify(parts.a));  // картинка грузилась 300 мс
  const sum = parts.a.timeToFirstByte + parts.a.resourceLoadDelay + parts.a.resourceLoadDuration + parts.a.elementRenderDelay;
  assert.ok(Math.abs(sum - parts.value) <= 2);                            // части складываются в LCP
  await p.close();

  // --- CLS: окна сессий; сдвиг после ввода не считается ---
  // onCLS регистрируем в начале страницы, до сдвигов
  p = await open('/cls', `<script>window.__cls = []; webVitals.onCLS((m) => window.__cls.push(m.value), { reportAllChanges: true });</script><div id="ad" style="height:0"></div><p id="text" style="height:300px">Описание чая</p><button id="more">Ещё</button>`);
  const shift = (h) => p.page.evaluate((h) => { document.getElementById('ad').style.height = h + 'px'; return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }, h);
  await p.page.evaluate(() => { window.__shifts = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ v: e.value, t: e.startTime, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); });
  await p.page.waitForTimeout(500);                                     // после первой отрисовки
  await shift(50); await p.page.waitForTimeout(200); await shift(100);   // окно 1: два сдвига рядом
  await p.page.waitForTimeout(1300);                                    // пауза больше секунды — новое окно
  await shift(150);                                                     // окно 2: один сдвиг
  const shifts = await p.page.evaluate(() => window.__shifts);
  assert.equal(shifts.length, 3);
  // окна сессий по правилам CLS: пауза < 1 с и длина окна < 5 с
  const windows = [];
  for (const s of shifts) {
    const w = windows.at(-1);
    if (w && s.t - w.last < 1000 && s.t - w.first < 5000) { w.sum += s.v; w.last = s.t; } else windows.push({ first: s.t, last: s.t, sum: s.v });
  }
  const total = shifts.reduce((a, s) => a + s.v, 0);
  const cls = Math.max(...windows.map((w) => w.sum));
  assert.equal(windows.length, 2);
  assert.ok(cls < total);                                               // CLS — худшее окно, а не сумма всех сдвигов
  await p.page.waitForTimeout(200);
  const reported = await p.page.evaluate(() => window.__cls.at(-1));
  assert.ok(Math.abs(reported - cls) < 1e-4, `web-vitals ${reported}, окна ${cls}`);
  // сдвиг сразу после клика помечен hadRecentInput и в CLS не идёт
  await p.page.click('#more');
  await shift(250);
  assert.equal((await p.page.evaluate(() => window.__shifts)).at(-1).input, true);
  await p.close();

  // --- INP: записи Event Timing, общий interactionId, фазы ---
  p = await open('/inp', `<button id="buy" style="font-size:20px">В корзину</button><p id="count">0</p>`);
  await p.page.evaluate(() => {
    window.__events = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__events.push({ name: e.name, id: e.interactionId, duration: e.duration }); })
      .observe({ type: 'event', durationThreshold: 16, buffered: true });
    window.__inp = null;
    webVitals.onINP((m) => {
      const { inputDelay, processingDuration, presentationDelay, longAnimationFrameEntries } = m.attribution;
      const scripts = longAnimationFrameEntries.flatMap((f) => f.scripts.map((s) => ({ type: s.invokerType, invoker: s.invoker, hasUrl: 'sourceURL' in s })));
      window.__inp = { value: m.value, a: { inputDelay, processingDuration, presentationDelay }, scripts };
    }, { reportAllChanges: true });
    document.getElementById('buy').addEventListener('click', () => {
      const end = performance.now() + 150;
      while (performance.now() < end) {}                                // тяжёлый обработчик
      document.getElementById('count').textContent = '1';
    });
  });
  await p.page.click('#buy');
  await p.page.waitForFunction(() => window.__inp !== null);
  const ev = await p.page.evaluate(() => window.__events);
  const click = ev.find((e) => e.name === 'click');
  assert.ok(click && click.duration >= 150, JSON.stringify(ev));
  assert.ok(ev.every((e) => e.duration % 8 === 0), JSON.stringify(ev));   // длительность округлена до 8 мс
  const ids = new Set(ev.filter((e) => ['pointerdown', 'pointerup', 'click'].includes(e.name)).map((e) => e.id));
  assert.equal(ids.size, 1);                                            // одно действие — один interactionId
  const inp = await p.page.evaluate(() => window.__inp);
  assert.ok(inp.value >= 150);
  assert.ok(inp.a.processingDuration >= 140, JSON.stringify(inp.a));   // время ушло на обработку
  assert.ok(Math.abs(inp.a.inputDelay + inp.a.processingDuration + inp.a.presentationDelay - inp.value) <= 8);
  // долгий кадр называет виновника: слушатель click на кнопке
  assert.ok(inp.scripts.some((s) => s.type === 'event-listener' && /BUTTON#buy\.onclick/.test(s.invoker) && s.hasUrl), JSON.stringify(inp.scripts));
  await p.close();

  // --- Navigation и Resource Timing: TTFB, Server-Timing, Timing-Allow-Origin ---
  p = await open('/nav', `<img src="${other}/small.png" alt=""><img src="${other}/small.png?tao" alt="">`);
  const nav = await p.page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    const res = performance.getEntriesByType('resource').filter((r) => r.name.includes('small.png'))
      .map((r) => ({ tao: r.name.includes('tao'), transfer: r.transferSize, ttfb: Math.round(r.responseStart), duration: r.duration }));
    return { server: n.serverTiming.map((s) => [s.name, s.duration, s.description]), res };
  });
  assert.deepEqual(nav.server, [['db', 180, 'catalog'], ['render', 40, '']]);
  const noTao = nav.res.find((r) => !r.tao), withTao = nav.res.find((r) => r.tao);
  assert.deepEqual([noTao.transfer, noTao.ttfb], [0, 0]);              // чужой ресурс без заголовка — нули
  assert.ok(noTao.duration > 0);                                        // общая длительность видна всегда
  assert.ok(withTao.transfer > 0 && withTao.ttfb > 0);
  await p.close();
  // задержка сервера видна в TTFB
  const ctx = await browser.newContext();
  const pg = await ctx.newPage();
  pages.set('/ttfb', '<p>ok</p>');
  await pg.goto(`${base}/ttfb?d=300`);
  assert.ok((await pg.evaluate(() => performance.getEntriesByType('navigation')[0].responseStart)) >= 290);
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log('measure ok');
