// Проверки к 6.02 в Chromium: селекторы атрибутов, :nth-child и «of S», :nth-of-type, :empty, :focus-visible,
// :user-invalid, :has() (в том числе предыдущий сосед и запрет вложенного :has), прощающие списки :is/:where,
// падение всего правила из-за одного неизвестного селектора, псевдоэлементы и content, текст ::before в доступном имени,
// @supports, @scope с нижней границей и близостью области.
// Запуск: cd codes && node run.mjs 06.css/2.css-rules
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

const RED = 'rgb(255, 0, 0)', GREEN = 'rgb(0, 128, 0)', BLACK = 'rgb(0, 0, 0)', WHITE = 'rgb(255, 255, 255)';

await withPage(async (page) => {
  const set = (css, body) => page.setContent(`<!doctype html><html lang="ru"><style>${css}</style><body>${body}</body></html>`);
  const cs = (sel, prop = 'color', pseudo = null) => page.$eval(sel, (el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
  const matches = (sel, s) => page.$eval(sel, (el, s) => el.matches(s), s);

  // --- атрибуты: начало, конец, слово, флаг i ---
  await set(`
    a[href^="https://"] { color: green; }
    a[href$=".pdf" i] { font-weight: 700; }
    [data-state~="open"] { text-decoration: underline; }`,
  `<a id="ext" href="https://example.com/doc.PDF">отчёт</a><a id="int" href="/cart">корзина</a>
   <div id="st" data-state="visible open">панель</div>`);
  assert.equal(await cs('#ext'), GREEN);
  assert.equal(await cs('#int'), 'rgb(0, 0, 238)');                       // ссылка по умолчанию
  assert.equal(await cs('#ext', 'fontWeight'), '700');                    // .PDF совпал благодаря флагу i
  assert.match(await cs('#st', 'textDecorationLine'), /underline/);

  // --- :nth-child считает всех соседей; of S — только подходящих; :nth-of-type — по тегу, а не по классу ---
  await set(`
    tr:nth-child(even) { color: red; }
    tr:nth-child(even of :not([hidden])) { background: rgb(0, 128, 0); }
    li:nth-child(-n + 3) { font-weight: 700; }`,
  `<table><tr id="r1"><td>1</td></tr><tr id="r2" hidden><td>2</td></tr><tr id="r3"><td>3</td></tr><tr id="r4"><td>4</td></tr></table>
   <ul><li id="l1">1</li><li id="l2">2</li><li id="l3">3</li><li id="l4">4</li></ul>`);
  // видимые строки 1, 3, 4: «чётной» по счёту среди всех оказалась скрытая 2 и видимая 4 — полосы съехали
  assert.equal(await cs('#r3'), BLACK);
  assert.equal(await cs('#r4'), RED);
  // с of :not([hidden]) чётная среди видимых — строка 3
  assert.equal(await cs('#r3', 'backgroundColor'), GREEN);
  assert.equal(await cs('#r4', 'backgroundColor'), 'rgba(0, 0, 0, 0)');
  assert.deepEqual(await Promise.all(['#l1', '#l2', '#l3', '#l4'].map((s) => cs(s, 'fontWeight'))), ['700', '700', '700', '400']);

  await set(`.item:nth-of-type(2) { color: red; }`,
    `<div><h3>Заголовок</h3><p class="intro">вводный</p><p class="item" id="a">первый товар</p><p class="item" id="b">второй товар</p></div>`);
  assert.equal(await cs('#a'), RED);                                       // второй <p> среди соседей, а не второй .item
  assert.equal(await cs('#b'), BLACK);

  // --- :empty: пробел или перевод строки — уже не пусто ---
  await set(`.msg:empty { display: none; }`, `<div class="msg" id="e1"></div><div class="msg" id="e2"> </div><div class="msg" id="e3"><!-- нет --></div>`);
  assert.equal(await cs('#e1', 'display'), 'none');
  assert.equal(await cs('#e2', 'display'), 'block');
  assert.equal(await cs('#e3', 'display'), 'none');                      // комментарий не мешает

  // --- :focus-visible: клик мышью по кнопке — нет, Tab — да, поле ввода — да при любом фокусе ---
  await set(``, `<button id="b1">Купить</button><input id="i1"><button id="b2">Отмена</button>`);
  await page.click('#b1');
  assert.equal(await matches('#b1', ':focus'), true);
  assert.equal(await matches('#b1', ':focus-visible'), false);
  await page.click('#i1');
  assert.equal(await matches('#i1', ':focus-visible'), true);
  await page.keyboard.press('Tab');
  assert.equal(await matches('#b2', ':focus-visible'), true);
  // стиль браузера по умолчанию уже рисует кольцо только для :focus-visible
  await page.click('#b1');
  assert.equal(await cs('#b1', 'outlineStyle'), 'none');
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  assert.notEqual(await cs('#b1', 'outlineStyle'), 'none');

  // --- :invalid против :user-invalid: ошибка не горит до взаимодействия ---
  await set(`input:invalid { outline: 2px solid red; } input:user-invalid { border-color: red; }`,
    `<form><input id="email" type="email" required><button>Отправить</button></form>`);
  assert.equal(await matches('#email', ':invalid'), true);                 // пустое обязательное поле — сразу невалидно
  assert.equal(await matches('#email', ':user-invalid'), false);           // но пользователь ещё ничего не сделал
  await page.fill('#email', 'не почта');
  await page.press('#email', 'Tab');
  assert.equal(await matches('#email', ':user-invalid'), true);

  // --- :has(): родитель по потомку, предыдущий сосед, количество; обновляется сам при изменении DOM ---
  await set(`
    .card:has(img) { display: grid; }
    form:has(:user-invalid) button { opacity: 0.5; }
    h2:has(+ p) { margin-bottom: 4px; }
    ul:has(> li:nth-child(4)) { columns: 2; }`,
  `<div class="card" id="c1"><img alt=""></div><div class="card" id="c2">без картинки</div>
   <form id="f"><input id="q" required><button id="send">ок</button></form>
   <h2 id="h">Заголовок</h2><p>текст</p><h2 id="h2">Одинокий</h2>
   <ul id="u3"><li>1</li><li>2</li><li>3</li></ul><ul id="u4"><li>1</li><li>2</li><li>3</li><li>4</li></ul>`);
  assert.equal(await cs('#c1', 'display'), 'grid');
  assert.equal(await cs('#c2', 'display'), 'block');
  assert.equal(await cs('#h', 'marginBottom'), '4px');
  assert.notEqual(await cs('#h2', 'marginBottom'), '4px');
  assert.equal(await cs('#u3', 'columnCount'), 'auto');
  assert.equal(await cs('#u4', 'columnCount'), '2');
  assert.equal(await cs('#send', 'opacity'), '1');
  await page.fill('#q', 'x'); await page.fill('#q', ''); await page.press('#q', 'Tab');
  assert.equal(await cs('#send', 'opacity'), '0.5');                       // без единой строки JavaScript в стилях
  await page.$eval('#c2', (el) => el.append(document.createElement('img')));
  assert.equal(await cs('#c2', 'display'), 'grid');

  // :has внутри :has и псевдоэлемент внутри :has — недопустимы, правило отбрасывается
  await set(`.a:has(.b:has(.c)) { color: red; } .a:has(::before) { color: red; }`, `<div class="a" id="nest"><div class="b"><div class="c"></div></div></div>`);
  assert.equal(await cs('#nest'), BLACK);

  // --- один неизвестный селектор в списке убивает всё правило; :is() и :where() прощают ---
  await set(`
    .price, .price::-moz-range-thumb { color: red; }
    :is(.old, .old:unknown-thing) { color: green; }
    .new { color: green; }`,
  `<p class="price" id="p">990 ₽</p><p class="old" id="o">старая цена</p><p class="new" id="n">новая</p>`);
  assert.equal(await cs('#p'), BLACK);                                     // в Chromium нет ::-moz-range-thumb — правило выброшено целиком
  assert.equal(await cs('#o'), GREEN);                                     // :is() просто пропустил неизвестный аргумент

  // --- псевдоэлементы: без content не существуют; одно двоеточие только у четырёх старых ---
  await set(`
    .req::after { color: red; width: 10px; display: inline-block; }
    .req2::after { content: " *"; color: red; }
    .old:before { content: "→ "; }
    li:marker { color: red; }
    li::marker { color: green; }`,
  `<label class="req" id="r1">Почта</label><label class="req2" id="r2">Почта</label><p class="old" id="ob">ок</p><ul><li id="li">пункт</li></ul>`);
  assert.equal(await cs('#r1', 'content', '::after'), 'none');            // нет content — нет бокса
  assert.equal(await cs('#r2', 'content', '::after'), '" *"');
  assert.equal(await cs('#ob', 'content', '::before'), '"→ "');            // :before работает как ::before
  assert.equal(await cs('#li', 'color', '::marker'), GREEN);               // li:marker — невалидный селектор

  // текст из content попадает в доступное имя; после «/» — альтернативный текст
  await set(`.del::before { content: "×"; } .del2::before { content: "×" / "Удалить"; }`,
    `<button class="del" id="d1"></button><button class="del2" id="d2"></button>`);
  assert.equal(await page.locator('#d1').ariaSnapshot(), '- button "×"');
  assert.equal(await page.locator('#d2').ariaSnapshot(), '- button "Удалить"');

  // --- @supports: свойство, значение и селектор ---
  await set(`
    @supports (display: grid) { #s1 { color: green; } }
    @supports (display: nonsense) { #s2 { color: red; } }
    @supports selector(:has(a)) { #s3 { color: green; } }
    @supports not (backdrop-filter: blur(4px)) { #s4 { color: red; } }`,
  `<p id="s1">1</p><p id="s2">2</p><p id="s3">3</p><p id="s4">4</p>`);
  assert.deepEqual(await Promise.all(['#s1', '#s2', '#s3', '#s4'].map((s) => cs(s))), [GREEN, BLACK, GREEN, BLACK]);

  // --- @scope: нижняя граница («пончик») и близость области ---
  await set(`
    @scope (.card) to (.card-slot) { p { color: green; } }`,
  `<div class="card"><p id="own">своё</p><div class="card-slot"><p id="slot">чужое</p></div></div>`);
  assert.equal(await cs('#own'), GREEN);
  assert.equal(await cs('#slot'), BLACK);                                  // внутри .card-slot правило не действует

  // специфичность внутри @scope не растёт от корня: #card не добавляет id к p
  await set(`@scope (#card) { p { color: red; } } .t { color: green; }`, `<div id="card"><p class="t" id="sp">текст</p></div>`);
  assert.equal(await cs('#sp'), GREEN);

  // вложенные темы: обычные селекторы — побеждает последний в коде, @scope — ближайший корень
  const themes = `<div class="light"><div class="dark"><p id="t1">в тёмном</p><div class="light"><p id="t2">в светлом</p></div></div></div>`;
  await set(`.light p { color: black; } .dark p { color: white; }`, themes);
  assert.equal(await cs('#t2'), WHITE);                                    // светлый блок внутри тёмного стал белым
  await set(`@scope (.light) { p { color: black; } } @scope (.dark) { p { color: white; } }`, themes);
  assert.equal(await cs('#t1'), WHITE);
  assert.equal(await cs('#t2'), BLACK);                                    // ближайший корень области сильнее порядка
});

console.log('selectors ok');
