// Проверки к 6.06 в Chromium на настоящем HTTP-сервере со шрифтом Inter (@fontsource-variable/inter):
// шрифт качается, только когда нужен; unicode-range и пробел из латиницы; font-display block/swap/optional
// по пикселям скриншота; preload без crossorigin качает дважды; size-adjust и ascent-override;
// вариативный вес, синтез жирного и font-synthesis; font-variation-settings не складывается;
// tabular-nums; перенос длинных строк, многоточие, line-clamp, text-wrap: balance.
// Запуск: cd codes && node run.mjs 06.css/6.typography
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

const require = createRequire(import.meta.url);
const fontDir = join(dirname(require.resolve('@fontsource-variable/inter/package.json')), 'files');
const FONT = {
  '/latin.woff2': readFileSync(join(fontDir, 'inter-latin-wght-normal.woff2')),
  '/cyrillic.woff2': readFileSync(join(fontDir, 'inter-cyrillic-wght-normal.woff2')),
  '/cyrillic-opsz.woff2': readFileSync(join(fontDir, 'inter-cyrillic-opsz-normal.woff2')),
};
const ranges = JSON.parse(readFileSync(join(dirname(fontDir), 'unicode.json'), 'utf8'));

const hits = new Map();
let delay = 0;
let varyOrigin = false;
const pages = new Map();
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  hits.set(path, (hits.get(path) ?? 0) + 1);
  if (FONT[path]) {
    return setTimeout(() => {
      const vary = varyOrigin ? { vary: 'Origin' } : {};
      res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'max-age=3600', 'access-control-allow-origin': '*', ...vary });
      res.end(FONT[path]);
    }, delay);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(pages.get(path) ?? '');
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const face = (family, file, extra = '') => `@font-face { font-family: "${family}"; src: url("${file}") format("woff2"); font-weight: 100 900; ${extra} }`;
const html = (css, body, head = '') => `<!doctype html><html lang="ru"><head><meta charset="utf-8">${head}<style>body{margin:0;font:32px/1.2 sans-serif}${css}</style></head><body>${body}</body></html>`;

const browser = await chromium.launch({ executablePath: findChromium() });
const fresh = async () => (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const ink = async (page, sel) => {                               // тёмные пиксели в боксе элемента
  const r = await page.$eval(sel, (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
  // снимок через CDP: page.screenshot в Playwright ждёт загрузки шрифтов, а нам нужен кадр «во время»
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...r, scale: 1 } });
  await cdp.detach();
  const png = PNG.sync.read(Buffer.from(data, 'base64'));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i] < 128 && png.data[i + 1] < 128 && png.data[i + 2] < 128) n++;
  return n;
};
const width = (page, sel) => page.$eval(sel, (el) => el.getBoundingClientRect().width);

try {
  // --- @font-face сам ничего не качает: файл грузится, когда шрифт нужен тексту ---
  hits.clear();
  pages.set('/unused', html(face('Inter', '/latin.woff2'), '<p>Каталог</p>'));
  let p = await fresh();
  await p.goto(`${base}/unused`);
  await p.evaluate(() => document.fonts.ready);
  assert.equal(hits.get('/latin.woff2') ?? 0, 0);
  await p.evaluate(() => { const s = document.createElement('p'); s.style.fontFamily = 'Inter'; s.textContent = 'Tea'; document.body.append(s); });
  await p.evaluate(() => document.fonts.ready);
  assert.equal(hits.get('/latin.woff2'), 1);

  // --- unicode-range: качается только поднабор с нужными символами; пробел — из латиницы ---
  const subsets = `${face('Inter', '/latin.woff2', `unicode-range: ${ranges.latin};`)} ${face('Inter', '/cyrillic.woff2', `unicode-range: ${ranges.cyrillic};`)} p { font-family: Inter, sans-serif; }`;
  const loaded = async (text) => {
    hits.clear();
    pages.set('/subset', html(subsets, `<p>${text}</p>`));
    const pg = await fresh();
    await pg.goto(`${base}/subset`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.context().close();
    return ['/latin.woff2', '/cyrillic.woff2'].filter((f) => hits.get(f));
  };
  assert.deepEqual(await loaded('Tea'), ['/latin.woff2']);
  assert.deepEqual(await loaded('Доставка'), ['/cyrillic.woff2']);
  assert.deepEqual(await loaded('Доставка завтра'), ['/latin.woff2', '/cyrillic.woff2']); // пробел U+0020 — в латинском поднаборе

  // --- font-display: что видно, пока шрифт грузится 1,5 с ---
  delay = 1500;
  const during = async (display) => {
    pages.set(`/fd-${display}`, html(`${face('Inter', '/latin.woff2', `font-display: ${display};`)} h1 { font: 700 40px Inter, sans-serif; margin: 0; display: inline-block; }`, '<h1 id="h">Free delivery</h1>'));
    const pg = await fresh();
    await pg.goto(`${base}/fd-${display}`, { waitUntil: 'commit' });
    await pg.waitForSelector('#h');
    await pg.waitForTimeout(400);
    const early = { ink: await ink(pg, '#h'), w: await width(pg, '#h') };
    await pg.waitForTimeout(1700);                                  // шрифт уже пришёл
    const late = { ink: await ink(pg, '#h'), w: await width(pg, '#h'), loaded: await pg.evaluate(() => document.fonts.check('700 40px Inter')) };
    return { pg, early, late };
  };
  const block = await during('block');
  assert.equal(block.early.ink, 0);                                 // текста не видно…
  assert.ok(block.early.w > 0);                                     // …но место под него уже занято запасным шрифтом
  assert.ok(block.late.ink > 0);
  const swap = await during('swap');
  assert.ok(swap.early.ink > 0);                                    // сразу виден запасной
  assert.notEqual(Math.round(swap.early.w), Math.round(swap.late.w)); // после загрузки ширина сменилась — текст сдвинулся
  const optional = await during('optional');
  assert.ok(optional.early.ink > 0);
  assert.equal(Math.round(optional.late.w), Math.round(optional.early.w)); // шрифт пришёл, но в этот визит не применён
  assert.equal(Math.round(optional.late.w), Math.round(swap.early.w));     // остался запасной
  // следующий визит: файл в кеше, optional его берёт сразу
  // из кеша файл обычно успевает за 100 мс; на нагруженной машине иногда нет — тогда снова запасной, даём три попытки
  hits.delete('/latin.woff2');
  let applied = false;
  for (let i = 0; i < 3 && !applied; i++) {
    await optional.pg.goto(`${base}/fd-optional`);
    applied = Math.round(await width(optional.pg, '#h')) === Math.round(swap.late.w);
  }
  assert.equal(hits.get('/latin.woff2') ?? 0, 0);                    // сервер не спрашивали — HTTP-кеш
  assert.ok(applied);
  for (const x of [block, swap, optional]) await x.pg.context().close();
  delay = 0;

  // --- preload без crossorigin не подходит шрифту: шрифты всегда грузятся в режиме CORS ---
  // шрифт с другого origin (127.0.0.1 против localhost), как с CDN
  const cdn = base.replace('localhost', '127.0.0.1');
  const preloadRun = async (attr) => {
    hits.clear();
    pages.set('/preload', html(`${face('Inter', `${cdn}/latin.woff2`)} p { font-family: Inter; }`, '<p>Tea</p>', `<link rel="preload" href="${cdn}/latin.woff2" as="font" type="font/woff2" ${attr}>`));
    const pg = await fresh();
    const warnings = [];
    pg.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await pg.goto(`${base}/preload`);
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(300);
    await pg.context().close();
    return { hits: hits.get('/latin.woff2'), mismatch: warnings.some((w) => /credentials mode does not match/.test(w)) };
  };
  // предзагрузка не использована; повторный запрос взят из HTTP-кеша, потому что ответ кешируемый
  assert.deepEqual(await preloadRun(''), { hits: 1, mismatch: true });
  // а если ответ различается по Origin, как часто бывает у CDN со шрифтами, — две загрузки
  varyOrigin = true;
  assert.deepEqual(await preloadRun(''), { hits: 2, mismatch: true });
  assert.deepEqual(await preloadRun('crossorigin'), { hits: 1, mismatch: false });
  varyOrigin = false;

  // --- метрики: size-adjust масштабирует глифы, ascent-override меняет высоту строки ---
  p = await fresh();
  pages.set('/metrics', html(`
    ${face('Inter', '/latin.woff2')} ${face('Inter Half', '/latin.woff2', 'size-adjust: 50%;')} ${face('Inter Tall', '/latin.woff2', 'ascent-override: 150%;')}
    span { font-size: 40px; line-height: normal; display: inline-block; } .a { font-family: Inter; } .b { font-family: "Inter Half"; } .c { font-family: "Inter Tall"; }`,
  '<span class="a" id="a">Delivery</span><br><span class="b" id="b">Delivery</span><br><span class="c" id="c">Delivery</span>'));
  await p.goto(`${base}/metrics`);
  await p.evaluate(() => document.fonts.ready);
  const [wa, wb] = [await width(p, '#a'), await width(p, '#b')];
  assert.ok(Math.abs(wb / wa - 0.5) < 0.01);
  const h = (sel) => p.$eval(sel, (el) => el.getBoundingClientRect().height);
  assert.ok(await h('#c') > await h('#a') + 10);

  // --- вариативный шрифт: любой вес из одного файла; синтез жирного у одиночного начертания ---
  pages.set('/weights', html(`
    ${face('Inter', '/latin.woff2')}
    @font-face { font-family: "Inter Regular"; src: url("/latin.woff2") format("woff2"); font-weight: 400; }
    span { font-size: 40px; display: inline-block; }
    .w4 { font: 400 40px Inter; } .w65 { font: 650 40px Inter; } .w9 { font: 900 40px Inter; }
    .fv { font-family: Inter; font-variation-settings: "wght" 650; }
    .faux { font: 700 40px "Inter Regular"; } .nofaux { font: 700 40px "Inter Regular"; font-synthesis: none; } .reg { font: 400 40px "Inter Regular"; }`,
  ['w4', 'w65', 'w9', 'fv', 'faux', 'nofaux', 'reg'].map((c) => `<span class="${c}" id="${c}">Delivery</span><br>`).join('')));
  await p.goto(`${base}/weights`);
  await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load())); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  assert.equal(hits.get('/latin.woff2') > 0, true);
  const [w4, w65, w9, fv] = await Promise.all(['#w4', '#w65', '#w9', '#fv'].map((s) => width(p, s)));
  assert.ok(w4 < w65 && w65 < w9);                                  // промежуточный вес 650 существует
  assert.equal(Math.round(fv), Math.round(w65));                    // то же через ось wght
  const [iFaux, iNo, iReg] = [await ink(p, '#faux'), await ink(p, '#nofaux'), await ink(p, '#reg')]; // снимки по очереди
  assert.ok(iFaux > iReg * 1.05);                                   // браузер дорисовал жирный сам…
  assert.equal(Math.round(await width(p, '#faux')), Math.round(await width(p, '#reg'))); // …но ширины букв не изменил
  assert.ok(w65 > await width(p, '#faux'));                         // настоящий жирный шире
  assert.equal(iNo, iReg);                                          // font-synthesis: none — честно обычный

  // --- font-variation-settings не складывается: новая запись затирает оси родителя ---
  pages.set('/fvs', html(`
    @font-face { font-family: "InterO"; src: url("/cyrillic-opsz.woff2") format("woff2"); font-weight: 100 900; }
    div { font-family: InterO; font-size: 40px; } span { display: inline-block; }
    .parent { font-variation-settings: "wght" 800; } .child { font-variation-settings: "opsz" 32; }
    .wparent { font-weight: 800; } .wchild { font-variation-settings: "opsz" 32; }`,
  `<div class="parent"><span id="pv">Доставка</span><br><span class="child" id="cv">Доставка</span></div>
   <div class="wparent"><span class="wchild" id="cw">Доставка</span></div><div><span id="plain" style="font-variation-settings:'opsz' 32">Доставка</span></div>`));
  await p.goto(`${base}/fvs`);
  await p.evaluate(() => document.fonts.ready);
  const [pv, cv, cw, plain] = [await ink(p, '#pv'), await ink(p, '#cv'), await ink(p, '#cw'), await ink(p, '#plain')];
  assert.ok(cv < pv * 0.9);                                         // ребёнок потерял вес 800
  assert.ok(Math.abs(cv - plain) / plain < 0.02);                   // и стал обычным
  assert.ok(cw > plain * 1.2);                                      // font-weight и opsz живут вместе

  // --- цифры одной ширины ---
  pages.set('/nums', html(`${face('Inter', '/latin.woff2')} span { font: 40px Inter; display: inline-block; } .t { font-variant-numeric: tabular-nums; }`,
    '<span id="p1">1111</span><br><span id="p8">8888</span><br><span class="t" id="t1">1111</span><br><span class="t" id="t8">8888</span>'));
  await p.goto(`${base}/nums`);
  await p.evaluate(() => document.fonts.ready);
  assert.ok(await width(p, '#p8') - await width(p, '#p1') > 10);    // пропорциональные: 1 уже 8
  assert.equal(Math.round(await width(p, '#t1')), Math.round(await width(p, '#t8')));

  // --- перенос, многоточие, line-clamp, balance и pretty — на Inter, чтобы ширины не зависели от системных шрифтов ---
  const url = 'https://example.com/catalog?utm_source=newsletter_autumn_tea_sale_utm_campaign=subscribers';
  const subsetFaces = `${face('Inter', '/latin.woff2', `unicode-range: ${ranges.latin};`)} ${face('Inter', '/cyrillic.woff2', `unicode-range: ${ranges.cyrillic};`)}`;
  pages.set('/wrap', html(`
    ${subsetFaces}
    body { font: 16px/20px Inter, sans-serif; }
    .row { display: flex; width: 300px; } .row > p { margin: 0; }
    .bw { overflow-wrap: break-word; } .any { overflow-wrap: anywhere; }
    .pre { white-space: pre-line; width: 600px; }
    .ell { width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .clamp { width: 200px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
    h2 { width: 320px; font: 24px/30px Inter; margin: 0; } .bal { text-wrap: balance; }
    .para { width: 280px; font: 24px/30px Inter; margin: 0; } .pretty { text-wrap: pretty; }`,
  `<div class="row"><p class="bw" id="bw">${url}</p></div>
   <div class="row"><p class="any" id="any">${url}</p></div>
   <p class="pre" id="pre">Самовывоз:    пункт
   на Тверской</p>
   <p class="ell" id="ell">Бесплатная доставка по всей России при заказе от 3000 ₽</p>
   <p class="clamp" id="clamp">${'Чай улун с мягким молочным вкусом и сливочным послевкусием. '.repeat(4)}</p>
   <h2 id="nb">Новые сорта улуна уже в каталоге</h2><h2 class="bal" id="bal">Новые сорта улуна уже в каталоге</h2>
   <p class="para" id="np">Бесплатная доставка заказов от трёх тысяч рублей</p><p class="para pretty" id="pp">Бесплатная доставка заказов от трёх тысяч рублей</p>`));
  await p.goto(`${base}/wrap`);
  await p.evaluate(async () => { await Promise.all([...document.fonts].map((f) => f.load())); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  assert.ok(await width(p, '#bw') > 300);                           // break-word не уменьшает минимальную ширину: flex-элемент вылез
  assert.ok(await width(p, '#any') <= 300);                         // anywhere — уменьшает
  assert.equal(await p.$eval('#pre', (el) => el.innerText), 'Самовывоз: пункт\nна Тверской'); // пробелы схлопнуты, перевод строки сохранён
  assert.ok(await p.$eval('#ell', (el) => el.scrollWidth > el.clientWidth));
  assert.equal(await p.$eval('#clamp', (el) => el.getBoundingClientRect().height), 60); // три строки по 20px
  const lines = (sel) => p.$eval(sel, (el) => {
    const r = document.createRange(); r.selectNodeContents(el);
    const rows = new Map();
    for (const b of r.getClientRects()) rows.set(Math.round(b.top), Math.max(rows.get(Math.round(b.top)) ?? 0, b.right) - el.getBoundingClientRect().left);
    return [...rows.values()].map(Math.round);
  });
  const nb = await lines('#nb'), bal = await lines('#bal');
  assert.equal(nb.length, bal.length);                              // строк столько же
  assert.ok(Math.max(...bal) - Math.min(...bal) < Math.max(...nb) - Math.min(...nb)); // но длины ровнее
  assert.ok(nb[1] < nb[0] / 2);                                     // без balance вторая строка — огрызок
  const np = await lines('#np'), pp = await lines('#pp');
  assert.equal(np.length, pp.length);
  assert.ok(pp.at(-1) > np.at(-1) * 1.5);                           // pretty не оставил одно слово на последней строке
} finally {
  await browser.close();
  server.close();
}

console.log('fonts ok');
