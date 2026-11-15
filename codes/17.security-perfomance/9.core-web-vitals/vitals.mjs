// Проверки к 17.09 в Chromium на настоящем HTTP-сервере: CLS (сдвиг от картинки без размеров против
// зарезервированного места, сдвиг после клика не считается), LCP (большой элемент и задержка блокирующим CSS),
// блокировка главного потока откладывает следующую отрисовку (суть INP). Пороги и 75-й перцентиль — арифметика.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { PNG } from 'pngjs';
import { withPage } from '../../_lib/browser.mjs';

// настоящая картинка 500×360 — чтобы браузер считал её кандидатом в LCP, а не плейсхолдером
const hero = (() => {
  const w = 500, h = 360, png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; png.data[i] = (x * 255 / w) | 0; png.data[i + 1] = (y * 255 / h) | 0; png.data[i + 2] = 140; png.data[i + 3] = 255; }
  return PNG.sync.write(png);
})();

const server = createServer((req, res) => {
  const url = req.url;
  if (url.startsWith('/hero')) { const d = +(/d=(\d+)/.exec(url)?.[1] ?? 200); return setTimeout(() => { res.setHeader('content-type', 'image/png'); res.end(hero); }, d); }
  if (url.startsWith('/block.css')) return setTimeout(() => { res.setHeader('content-type', 'text/css'); res.end('body{margin:8px}'); }, 300); // медленный блокирующий стиль
  const reserve = url.includes('reserve');
  const block = url.includes('block');
  const fast = url.includes('fast');                      // для теста LCP картинка грузится мгновенно, гейт — блокирующий CSS
  res.setHeader('content-type', 'text/html');
  res.end(`<!doctype html><html lang=ru><head><meta charset=utf-8>
  <style>body{margin:0;font:16px sans-serif}#hero{display:block;width:500px;height:auto}
  .slot{width:500px}${reserve ? '.slot{aspect-ratio:500/360}' : ''}</style>
  ${block ? '<link rel=stylesheet href="/block.css">' : ''}</head><body>
  <h1>Каталог</h1>
  <div class=slot><img id=hero src="/hero.png?d=${fast ? 15 : 200}"></div>
  <p id=below>Текст под изображением, на который целится пользователь.</p>
  <button id=act>Купить</button>
  </body></html>`);
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const measure = (page) => page.evaluate(async () => {
  const shifts = [];
  let lcp = null;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) shifts.push(e.value); }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver((l) => { const es = l.getEntries(); lcp = es[es.length - 1]; }).observe({ type: 'largest-contentful-paint', buffered: true });
  await new Promise((r) => setTimeout(r, 650));
  return { cls: +shifts.reduce((a, b) => a + b, 0).toFixed(3), shiftCount: shifts.length, lcpEl: lcp && (lcp.element?.id || lcp.element?.tagName), lcpSize: lcp && Math.round(lcp.size), lcpTime: lcp && Math.round(lcp.startTime) };
});

await withPage(async (page) => {
  // --- CLS: картинка без зарезервированного места сдвигает текст ---
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const loose = await measure(page);
  assert.ok(loose.cls > 0, `ожидали сдвиг, получили ${loose.cls}`);
  assert.equal(loose.shiftCount, 1);

  await page.goto(`${base}/?reserve`, { waitUntil: 'load' });
  const reserved = await measure(page);
  assert.equal(reserved.cls, 0);          // aspect-ratio держит место до загрузки картинки
  assert.equal(reserved.shiftCount, 0);

  // --- LCP: самый большой элемент — геройская картинка (500×360 = 180000) ---
  assert.equal(loose.lcpEl, 'hero');
  assert.equal(loose.lcpSize, 180000);

  // с быстрой картинкой LCP наступает рано; блокирующий стиль откладывает первую отрисовку, а с ней и LCP
  await page.goto(`${base}/?fast`, { waitUntil: 'load' });
  const quick = await measure(page);
  assert.equal(quick.lcpEl, 'hero');
  await page.goto(`${base}/?fast&block`, { waitUntil: 'load' });
  const blocked = await measure(page);
  assert.equal(blocked.lcpEl, 'hero');
  assert.ok(blocked.lcpTime > quick.lcpTime + 150, `LCP без блокировки ${quick.lcpTime} мс, с блокировкой ${blocked.lcpTime} мс`);

  // --- сдвиг после взаимодействия не учитывается в CLS (hadRecentInput) ---
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400))); // дать картинке загрузиться и раскладке устояться
  await page.evaluate(() => {
    window.__shifts = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ value: +e.value.toFixed(3), recentInput: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: false });
    document.getElementById('act').addEventListener('click', () => { document.getElementById('below').style.marginTop = '120px'; });
  });
  await page.click('#act');                                         // настоящий ввод через CDP — сдвиг как следствие действия
  await page.evaluate(() => new Promise((r) => setTimeout(r, 200)));
  const afterClick = await page.evaluate(() => window.__shifts);
  assert.equal(afterClick.length, 1);
  assert.equal(afterClick[0].recentInput, true);                    // помечен как вызванный вводом — в CLS не идёт

  // --- суть INP: блокировка главного потока откладывает следующую отрисовку ---
  const nextPaintGap = (blockMs) => page.evaluate(async (blockMs) => {
    await new Promise((r) => requestAnimationFrame(() => r()));
    const t0 = performance.now();
    if (blockMs) { const end = performance.now() + blockMs; while (performance.now() < end); } // тяжёлый обработчик
    const painted = await new Promise((r) => requestAnimationFrame((ts) => r(performance.now())));
    return Math.round(painted - t0);
  }, blockMs);
  const idle = await nextPaintGap(0);
  const busy = await nextPaintGap(150);
  assert.ok(idle < 50, `свободный поток рисует быстро: ${idle} мс`);
  assert.ok(busy >= 150, `занятый поток задержал отрисовку: ${busy} мс`);
});
server.close();

// --- пороги Core Web Vitals (с 2024 года три метрики, INP заменил FID) ---
const thresholds = { LCP: 2500, INP: 200, CLS: 0.1 };
const rate = (metric, value) => value <= thresholds[metric] ? 'good' : 'poor';
assert.equal(rate('LCP', 2200), 'good');
assert.equal(rate('INP', 350), 'poor');
assert.equal(rate('CLS', 0.05), 'good');

// --- «хорошо», если порог держит 75-й перцентиль, а не среднее ---
const p75 = (values) => { const s = [...values].sort((a, b) => a - b); return s[Math.ceil(s.length * 0.75) - 1]; };
// 80% пользователей быстрые (2000 мс), 20% медленные (6000 мс): среднее проходит, перцентиль — нет
const lcpSamples = [...Array(80).fill(2000), ...Array(20).fill(6000)];
const mean = lcpSamples.reduce((a, b) => a + b, 0) / lcpSamples.length;
assert.equal(mean, 2800);
assert.ok(mean > thresholds.LCP);               // среднее уже за порогом…
assert.equal(p75(lcpSamples), 2000);            // …а 75-й перцентиль внутри — по нему и считают
assert.equal(rate('LCP', p75(lcpSamples)), 'good');
// если медленных уже 30%, перцентиль проваливается
assert.equal(p75([...Array(70).fill(2000), ...Array(30).fill(6000)]), 6000);

console.log('vitals ok');
