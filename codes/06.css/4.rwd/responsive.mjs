// Проверки к 6.04 в Chromium: meta viewport на эмуляции телефона, пересечение min-width и max-width на границе,
// синтаксис диапазонов, медиафункции hover/pointer и prefers-*, container queries (контейнер не видит себя,
// container-type: size схлопывает высоту, единицы cqi), 100vw и полоса прокрутки, clamp() и зум,
// логические свойства в RTL, scroll snap и scroll-padding.
// Запуск: cd codes && node run.mjs 06.css/4.rwd
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium } from '../../_lib/browser.mjs';

// Playwright по умолчанию запускает с --hide-scrollbars: полоса прокрутки тогда не занимает места
const browser = await chromium.launch({ executablePath: findChromium(), ignoreDefaultArgs: ['--hide-scrollbars'] });
const page = async (opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => { throw e; });
  return p;
};
const doc = (head, css, body) => `<!doctype html><html lang="ru"><head>${head}<style>body{margin:0;font:16px sans-serif}${css}</style></head><body>${body}</body></html>`;
const cs = (p, sel, prop) => p.$eval(sel, (el, pr) => getComputedStyle(el)[pr], prop);
const box = (p, sel) => p.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });

try {
  // --- meta viewport: без него телефон раскладывает страницу на 980px и уменьшает ---
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  const mob = await page(phone);
  await mob.setContent(doc('', '', '<p>каталог</p>'));
  assert.equal(await mob.evaluate(() => innerWidth), 980);
  await mob.setContent(doc('<meta name="viewport" content="width=device-width, initial-scale=1">', '', '<p>каталог</p>'));
  assert.equal(await mob.evaluate(() => innerWidth), 390);
  // на телефоне нет наведения и точного указателя
  assert.deepEqual(await mob.evaluate(() => [matchMedia('(hover: none)').matches, matchMedia('(pointer: coarse)').matches]), [true, true]);

  const desk = await page();
  assert.deepEqual(await desk.evaluate(() => [matchMedia('(hover: hover)').matches, matchMedia('(pointer: fine)').matches]), [true, true]);

  // --- min-width и max-width с одним числом пересекаются на границе; диапазоны — нет ---
  const bp = (w) => page({ viewport: { width: w, height: 600 } });
  const overlap = doc('', `
    @media (max-width: 768px) { .nav { flex-direction: column; } .burger { display: block; } }
    @media (min-width: 768px) { .nav { display: flex; } .burger { display: none; } }
    @media (width < 768px) { .r-nav { flex-direction: column; } }
    @media (width >= 768px) { .r-nav { display: flex; } }`,
  '<nav class="nav" id="nav"><a>Каталог</a><a>Доставка</a></nav><button class="burger" id="burger">меню</button><nav class="r-nav" id="rnav"><a>Каталог</a></nav>');
  const at768 = await bp(768);
  await at768.setContent(overlap);
  assert.equal(await cs(at768, '#nav', 'display'), 'flex');
  assert.equal(await cs(at768, '#nav', 'flexDirection'), 'column');     // на 768 сработали оба запроса: колонка во flex
  assert.equal(await cs(at768, '#rnav', 'flexDirection'), 'row');
  assert.equal(await cs(at768, '#rnav', 'display'), 'flex');
  const at767 = await bp(767);
  await at767.setContent(overlap);
  assert.equal(await cs(at767, '#rnav', 'display'), 'block');

  // --- prefers-*: тёмная тема и уменьшение движения ---
  await desk.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await desk.setContent(doc('', `
    :root { --bg: white; } @media (prefers-color-scheme: dark) { :root { --bg: black; } }
    body { background: var(--bg); }
    .card { transition: transform 0.3s; } @media (prefers-reduced-motion: reduce) { .card { transition: none; } }`,
  '<div class="card" id="card">карточка</div>'));
  assert.equal(await cs(desk, 'body', 'backgroundColor'), 'rgb(0, 0, 0)');
  assert.equal(await cs(desk, '#card', 'transitionDuration'), '0s');
  await desk.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });

  // --- container queries: одна карточка — разная раскладка в сайдбаре и в основной колонке ---
  await desk.setContent(doc('', `
    .slot { container-type: inline-size; }
    .side { width: 300px; } .main { width: 800px; }
    .card { display: block; }
    @container (width > 500px) { .card { display: grid; grid-template-columns: 200px 1fr; } }
    .title { font-size: clamp(16px, 5cqi, 32px); }`,
  `<div class="slot side"><article class="card" id="c1"><h3 class="title" id="t1">Улун</h3></article></div>
   <div class="slot main"><article class="card" id="c2"><h3 class="title" id="t2">Улун</h3></article></div>`));
  assert.equal(await cs(desk, '#c1', 'display'), 'block');
  assert.equal(await cs(desk, '#c2', 'display'), 'grid');
  assert.equal(await cs(desk, '#t1', 'fontSize'), '16px');              // 5% от 300 = 15 → упёрлось в минимум
  assert.equal(await cs(desk, '#t2', 'fontSize'), '32px');              // 5% от 800 = 40 → упёрлось в максимум

  // контейнер не может запрашивать сам себя: правило действует только на потомков
  await desk.setContent(doc('', `
    .card { container-type: inline-size; width: 800px; display: block; }
    @container (width > 500px) { .card { display: grid; } .inner { color: rgb(0, 128, 0); } }`,
  '<article class="card" id="self"><p class="inner" id="inner">текст</p></article>'));
  assert.equal(await cs(desk, '#self', 'display'), 'block');
  assert.equal(await cs(desk, '#inner', 'color'), 'rgb(0, 128, 0)');

  // container-type: size без явной высоты — высота 0: размер больше не зависит от содержимого
  await desk.setContent(doc('', `.a { container-type: inline-size; } .b { container-type: size; }`,
    '<aside class="a" id="a"><p>фильтры</p><p>цена</p></aside><aside class="b" id="b"><p>фильтры</p><p>цена</p></aside>'));
  assert.ok((await box(desk, '#a')).h > 0);
  assert.equal((await box(desk, '#b')).h, 0);

  // inline-size тоже изолирует: ширина контейнера не зависит от детей, строчный блок без ширины сжимается в ноль
  await desk.setContent(doc('', `.chip { display: inline-block; } .cq { container-type: inline-size; }`,
    '<span class="chip" id="plain">длинное название фильтра</span><br><span class="chip cq" id="cq">длинное название фильтра</span>'));
  assert.ok((await box(desk, '#plain')).w > 100);
  assert.equal((await box(desk, '#cq')).w, 0);

  // запрос к стилю контейнера: вариант компонента по CSS-переменной предка
  await desk.setContent(doc('', `.card { padding: 16px; } .compact { --variant: compact; } @container style(--variant: compact) { .card { padding: 4px; } }`,
    '<div class="compact"><div class="card" id="cc">карточка</div></div><div><div class="card" id="cn">карточка</div></div>'));
  assert.deepEqual([await cs(desk, '#cc', 'paddingTop'), await cs(desk, '#cn', 'paddingTop')], ['4px', '16px']);

  // --- 100vw включает полосу прокрутки: на странице с вертикальной прокруткой даёт горизонтальную ---
  // в headless полосы прокрутки накладываются поверх; стилизованная ::-webkit-scrollbar занимает место, как классическая в Windows
  await desk.setContent(doc('', `::-webkit-scrollbar { width: 15px; background: #ddd; } .hero { width: 100vw; height: 100px; } .long { height: 3000px; }`, '<div class="hero" id="hero"></div><div class="long"></div>'));
  const sb = await desk.evaluate(() => innerWidth - document.documentElement.clientWidth);
  if (sb > 0) {                                                           // классические полосы прокрутки
    assert.ok(await desk.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
    await desk.addStyleTag({ content: '.hero { width: 100%; }' });
    assert.equal(await desk.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth), true);
  } else {
    console.log('полосы прокрутки накладываются поверх страницы — пропуск проверки 100vw');
  }
  // на десктопе все варианты высоты окна совпадают: разница только там, где панель браузера прячется
  await desk.setContent(doc('', `.v{height:100vh}.s{height:100svh}.l{height:100lvh}.d{height:100dvh}`, '<div class="v" id="v"></div><div class="s" id="s"></div><div class="l" id="l"></div><div class="d" id="d"></div>'));
  assert.deepEqual(await Promise.all(['#v', '#s', '#l', '#d'].map(async (s) => (await box(desk, s)).h)), [800, 800, 800, 800]);

  // --- clamp() и зум: эмулируем зум 200% — та же ширина окна в физических пикселях, вдвое больше плотность ---
  const fluid = doc('', `.vw { font-size: 4vw; } .mix { font-size: clamp(1rem, 0.75rem + 1.5vw, 3rem); } .rem { font-size: 1.5rem; }`,
    '<h1 class="vw" id="vw">Скидки</h1><h1 class="mix" id="mix">Скидки</h1><h1 class="rem" id="rem">Скидки</h1>');
  const physical = async (opts) => {
    const p = await page(opts);
    await p.setContent(fluid);
    const dpr = await p.evaluate(() => devicePixelRatio);
    return Object.fromEntries(await Promise.all(['vw', 'mix', 'rem'].map(async (id) => [id, parseFloat(await cs(p, `#${id}`, 'fontSize')) * dpr])));
  };
  const z100 = await physical({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const z200 = await physical({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });
  assert.equal(z100.vw, 51.2);
  assert.equal(z200.vw, 51.2);                                            // зум ничего не увеличил
  assert.equal(z100.rem, 24);
  assert.equal(z200.rem, 48);                                            // rem вырос вдвое
  assert.ok(z200.mix > z100.mix * 1.3);                                  // смесь rem и vw растёт с зумом
  // clamp на узком и широком экране упирается в пределы
  const narrow = await page({ viewport: { width: 320, height: 600 } });
  await narrow.setContent(fluid);
  assert.equal(await cs(narrow, '#mix', 'fontSize'), '16.8px');          // 12 + 4.8
  const wide = await page({ viewport: { width: 2560, height: 1200 } });
  await wide.setContent(fluid);
  assert.equal(await cs(wide, '#mix', 'fontSize'), '48px');              // 12 + 38.4 = 50.4 → максимум 48

  // --- логические свойства: в RTL начало строки справа ---
  await desk.setContent(doc('', `.card { width: 200px; margin-inline-start: 40px; border-inline-start: 4px solid; padding-inline: 10px 30px; }
                                .phys { width: 200px; margin-left: 40px; }`,
  '<div dir="ltr"><div class="card" id="l"></div></div><div dir="rtl"><div class="card" id="r"></div><div class="phys" id="pr"></div></div>'));
  assert.equal((await box(desk, '#l')).x, 40);
  assert.equal(await cs(desk, '#r', 'marginRight'), '40px');
  assert.equal(await cs(desk, '#r', 'borderRightWidth'), '4px');
  assert.equal(await cs(desk, '#r', 'paddingRight'), '10px');
  assert.equal(await cs(desk, '#pr', 'marginLeft'), '40px');             // физическое свойство не развернулось

  // --- scroll snap: прокрутка останавливается на точке; scroll-padding оставляет место под шапкой ---
  await desk.setContent(doc('', `
    .carousel { display: flex; width: 300px; overflow-x: auto; scroll-snap-type: x mandatory; }
    .slide { flex: none; width: 300px; height: 100px; scroll-snap-align: start; }
    html { scroll-padding-top: 80px; } header { position: fixed; top: 0; height: 80px; width: 100%; }
    section { height: 1000px; }`,
  `<div class="carousel" id="car">${'<div class="slide"></div>'.repeat(5)}</div>
   <header>шапка</header><section></section><h2 id="delivery">Доставка</h2><section></section>`));
  await desk.$eval('#car', (el) => el.scrollTo({ left: 420 }));
  await desk.waitForFunction(() => document.getElementById('car').scrollLeft % 300 === 0);
  assert.equal(await desk.$eval('#car', (el) => el.scrollLeft), 300);    // 420 ближе к 300, чем к 600
  await desk.$eval('#delivery', (el) => el.scrollIntoView());
  assert.equal((await box(desk, '#delivery')).y, 80);                    // заголовок не спрятался под шапкой
} finally {
  await browser.close();
}

console.log('responsive ok');
