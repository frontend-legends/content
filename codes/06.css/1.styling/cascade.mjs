// Проверки к 6.01 в Chromium: шаги каскада (важность, Shadow DOM, атрибут style, слои, специфичность, порядок),
// !important в слоях, анимация против обычного и важного объявления, наследование и ключевые слова,
// вычисленные значения (em, rem, line-height, проценты) и блочная модель.
// Запуск: cd codes && node run.mjs 06.css/1.styling
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

const BASE = 'http://fl.test';
const files = new Map();
const serve = async (page, routes) => {
  for (const [path, body] of Object.entries(routes)) files.set(path, body);
  await page.route(`${BASE}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = files.get(path);
    if (body === undefined) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: path.endsWith('.css') ? 'text/css' : 'text/html', body });
  });
};

await withPage(async (page) => {
  const bg = (sel = '#buy') => page.$eval(sel, (el) => getComputedStyle(el).backgroundColor);
  const color = (sel = '#buy') => page.$eval(sel, (el) => getComputedStyle(el).color);
  const RED = 'rgb(255, 0, 0)', GREEN = 'rgb(0, 128, 0)', GRAY = 'rgb(128, 128, 128)', BLUE = 'rgb(0, 0, 255)';
  const html = (css, body = '<div class="card"><button id="buy" class="btn btn-primary">Купить</button></div>') =>
    page.setContent(`<!doctype html><style>${css}</style>${body}`);

  // --- сквозной пример: id сильнее двух классов, хотя правило с классами ниже ---
  await html(`#buy { background: gray; } .card .btn-primary { background: green; }`);
  assert.equal(await bg(), GRAY);

  // --- специфичность сравнивается по столбцам, без переноса: 1 id сильнее 11 классов ---
  const eleven = '.btn'.repeat(11);
  await html(`#buy { color: red; } ${eleven} { color: green; }`, '<button id="buy" class="btn">Купить</button>');
  assert.equal(await color(), RED);
  // [id="buy"] выбирает тот же элемент, но это атрибут: (0,1,0) против (1,0,0)
  await html(`#buy { color: red; } [id="buy"][id="buy"] { color: green; }`);
  assert.equal(await color(), RED);
  // равная специфичность — побеждает последнее
  await html(`.btn { color: red; } .btn-primary { color: green; }`);
  assert.equal(await color(), GREEN);

  // :where() — ноль, проигрывает даже селектору типа; :is() берёт самый специфичный аргумент,
  // даже если элемент совпал по другому аргументу
  await html(`:where(#buy) { color: red; } button { color: green; }`);
  assert.equal(await color(), GREEN);
  await html(`:is(#nope, .btn) { color: red; } .btn.btn-primary { color: green; }`);
  assert.equal(await color(), RED);                      // (1,0,0) против (0,2,0)
  await html(`.btn:not(#nope) { color: red; } .btn.btn-primary.btn { color: green; }`);
  assert.equal(await color(), RED);                      // :not(#id) тоже даёт (1,…)
  await html(`#buy { color: red; } :nth-child(1 of #buy) { color: green; }`);
  assert.equal(await color(), GREEN);                    // псевдокласс + аргумент после of: (1,1,0) против (1,0,0)
  // практика «что выведет»: :where обнуляет всё внутри, но не то, что снаружи
  await html(`
    :where(.card) .btn { color: red; }
    .card :where(.btn) { color: blue; }
    :is(.card, #main) button { color: green; }`);
  assert.equal(await color(), GREEN);                   // (1,0,1) против (0,1,0) и (0,1,0)

  // --- атрибут style сильнее любого селектора; !important в правиле сильнее обычного style ---
  await html(`#buy#buy { color: red; }`, '<button id="buy" style="color: green">Купить</button>');
  assert.equal(await color(), GREEN);
  await html(`.btn { color: red !important; }`, '<button id="buy" class="btn" style="color: green">Купить</button>');
  assert.equal(await color(), RED);
  await html(`#buy { color: red !important; }`, '<button id="buy" style="color: green !important">Купить</button>');
  assert.equal(await color(), GREEN);                    // оба важные — атрибут style снова сильнее

  // --- !important сильнее специфичности ---
  await html(`button { color: red !important; } #buy.btn.btn-primary { color: green; }`);
  assert.equal(await color(), RED);

  // --- слои: порядок слоёв сильнее специфичности, вне слоёв — сильнее всех слоёв ---
  await html(`
    @layer reset, components, utilities;
    @layer components { #buy.btn { color: red; } }
    @layer utilities { .btn { color: green; } }`);
  assert.equal(await color(), GREEN);                    // поздний слой с (0,1,0) побеждает (1,1,0) в раннем
  await html(`
    @layer components { #buy.btn.btn-primary { color: red; } }
    button { color: green; }`);
  assert.equal(await color(), GREEN);                    // стили вне слоёв сильнее любого слоя
  // порядок задаёт первое упоминание слоя, а не место блока в файле
  await html(`
    @layer base, theme;
    @layer theme { .btn { color: green; } }
    @layer base { .btn { color: red; } }`);
  assert.equal(await color(), GREEN);

  // !important переворачивает порядок слоёв: важное в раннем слое сильнее важного в позднем и вне слоёв
  await html(`
    @layer reset, utilities;
    @layer reset { .btn { color: red !important; } }
    @layer utilities { .btn { color: blue !important; } }
    #buy { color: green !important; }`);
  assert.equal(await color(), RED);

  // revert-layer откатывает к значению из предыдущего слоя
  await html(`
    @layer base, components;
    @layer base { .btn { color: green; } }
    @layer components { .btn { color: red; } .btn-primary { color: revert-layer; } }`);
  assert.equal(await color(), GREEN);

  // --- стили библиотеки в слое: @import … layer(vendor) ---
  await serve(page, {
    '/vendor.css': '.lib-table td.lib-cell { color: red; font-weight: 700; }',
    '/nolayer.html': `<!doctype html><style>@import url("/vendor.css");
      .price { color: green; }</style><table class="lib-table"><tr><td id="p" class="lib-cell price">990 ₽</td></tr></table>`,
    '/layered.html': `<!doctype html><style>@import url("/vendor.css") layer(vendor);
      .price { color: green; }</style><table class="lib-table"><tr><td id="p" class="lib-cell price">990 ₽</td></tr></table>`,
  });
  await page.goto(`${BASE}/nolayer.html`);
  assert.equal(await color('#p'), RED);                  // (0,2,2) библиотеки сильнее (0,1,0)
  await page.goto(`${BASE}/layered.html`);
  assert.equal(await color('#p'), GREEN);                // библиотека в слое — свой стиль вне слоёв сильнее
  assert.equal(await page.$eval('#p', (el) => getComputedStyle(el).fontWeight), '700'); // остальное от библиотеки осталось

  // --- анимация сильнее обычных объявлений автора, но слабее важных; !important внутри @keyframes игнорируется ---
  await html(`
    @keyframes fade { from, to { opacity: 0.5; } }
    @keyframes bad { from, to { color: red !important; } }
    #a { opacity: 1; animation: fade 10s paused; }
    #b { opacity: 1 !important; animation: fade 10s paused; }
    #c { color: green; animation: bad 10s paused; }`, '<p id="a">a</p><p id="b">b</p><p id="c">c</p>');
  assert.equal(await page.$eval('#a', (el) => getComputedStyle(el).opacity), '0.5');
  assert.equal(await page.$eval('#b', (el) => getComputedStyle(el).opacity), '1');
  assert.equal(await color('#c'), GREEN);

  // --- Shadow DOM: из обычных объявлений побеждает внешнее, из важных — внутреннее ---
  await html('', '<x-card id="host"></x-card><x-card id="host2"></x-card>');
  const shadowColors = await page.evaluate(() => {
    for (const [id, inner] of [['host', ':host { color: blue; }'], ['host2', ':host { color: blue !important; }']]) {
      const root = document.getElementById(id).attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${inner}</style><span>в тени</span>`;
    }
    const style = document.createElement('style');
    style.textContent = '#host { color: red; } #host2 { color: red !important; }';
    document.head.append(style);
    return ['host', 'host2'].map((id) => getComputedStyle(document.getElementById(id)).color);
  });
  assert.deepEqual(shadowColors, [RED, BLUE]);

  // --- наследование и ключевые слова ---
  await html(`
    .card { color: green; border: 2px solid red; }
    .card p { border: inherit; }
    .initial { display: initial; } .revert { display: revert; } .unset-c { color: unset; } .unset-d { display: unset; }
    .card span { border-width: 0; }`,
  '<div class="card"><p id="p">p</p><span id="s">s</span><div id="i" class="initial">i</div><div id="r" class="revert">r</div><b id="u" class="unset-c">u</b><div id="ud" class="unset-d">ud</div></div>');
  const cs = (sel, prop) => page.$eval(sel, (el, p) => getComputedStyle(el)[p], prop);
  assert.equal(await cs('#s', 'color'), GREEN);                  // color наследуется
  assert.equal(await cs('#s', 'borderTopStyle'), 'none');        // border — нет
  assert.equal(await cs('#p', 'borderTopColor'), RED);           // inherit заставляет
  assert.equal(await cs('#i', 'display'), 'inline');             // initial — начальное значение свойства, а не стиль браузера
  assert.equal(await cs('#r', 'display'), 'block');              // revert — стиль браузера для div
  assert.equal(await cs('#u', 'color'), GREEN);                  // unset для наследуемого = inherit
  assert.equal(await cs('#ud', 'display'), 'inline');            // unset для ненаследуемого = initial

  // --- вычисленные значения: em накапливается, rem — нет; getComputedStyle отдаёт пиксели ---
  await html(`
    html { font-size: 16px; }
    .menu { font-size: 1.2em; }
    .menu-rem { font-size: 1.2rem; }
    .pad { font-size: 20px; padding: 0.5em; }`,
  `<ul class="menu"><li><ul class="menu"><li><ul class="menu"><li id="deep">пункт</li></ul></li></ul></li></ul>
   <ul class="menu-rem"><li><ul class="menu-rem"><li><ul class="menu-rem"><li id="deep-rem">пункт</li></ul></li></ul></li></ul>
   <button class="pad" id="pad">ок</button>`);
  assert.equal(await cs('#deep', 'fontSize'), '27.648px');       // 16 × 1.2³
  assert.equal(await cs('#deep-rem', 'fontSize'), '19.2px');     // 16 × 1.2 на любой глубине
  assert.equal(await cs('#pad', 'paddingTop'), '10px');          // em в padding — от своего font-size

  // line-height: множитель наследуется как множитель, а em и % — уже посчитанными пикселями
  await html(`
    .a { font-size: 16px; line-height: 1.5; } .b { font-size: 16px; line-height: 1.5em; } .c { font-size: 16px; line-height: 150%; }
    h2 { font-size: 32px; margin: 0; }`,
  '<div class="a"><h2 id="a">A</h2></div><div class="b"><h2 id="b">B</h2></div><div class="c"><h2 id="c">C</h2></div>');
  assert.equal(await cs('#a', 'lineHeight'), '48px');
  assert.equal(await cs('#b', 'lineHeight'), '24px');            // строки заголовка налезают друг на друга
  assert.equal(await cs('#c', 'lineHeight'), '24px');

  // проценты считаются от разного: padding-top — от ширины контейнера, а не от высоты
  await html(`
    .box { width: 400px; height: 100px; }
    .box > div { padding-top: 50%; height: 0; }`, '<div class="box"><div id="pct"></div></div>');
  assert.equal(await cs('#pct', 'paddingTop'), '200px');

  // --- блочная модель: content-box прибавляет padding и border, border-box — нет ---
  await html(`
    .c, .b { width: 200px; padding: 20px; border: 2px solid; margin: 10px; }
    .b { box-sizing: border-box; }`, '<div class="c" id="cb">c</div><div class="b" id="bb">b</div>');
  const w = (sel) => page.$eval(sel, (el) => el.getBoundingClientRect().width);
  assert.equal(await w('#cb'), 244);                             // 200 + 2×20 + 2×2
  assert.equal(await w('#bb'), 200);
  assert.equal(await cs('#bb', 'width'), '200px');
  assert.equal(await page.$eval('#bb', (el) => el.clientWidth), 196); // контент 156 + padding 40
});

console.log('cascade ok');
