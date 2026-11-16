// Проверки к 6.08 в Chromium: CSS-переменные (наследование, запасное значение, недопустимое при вычислении → unset,
// склейка с единицей, проникновение в Shadow DOM, setProperty), @property (тип, inherits: false, недопустимое → initial,
// em вычисляется там, где задана переменная), вложенность (& и :is(), относительные селекторы без &, @media внутри,
// &__title не работает), цвета (светлота HSL и OKLCH, color-mix, относительный синтаксис, light-dark и color-scheme,
// currentColor), якорное позиционирование с переворотом, accent-color, appearance и field-sizing.
// Запуск: cd codes && node run.mjs 06.css/8.modern-css
import assert from 'node:assert/strict';
import { withPage } from '../../_lib/browser.mjs';

await withPage(async (page) => {
  const set = (css, body) => page.setContent(`<!doctype html><html lang="ru"><style>body{margin:0}${css}</style><body>${body}</body></html>`);
  const cs = (sel, prop) => page.$eval(sel, (el, p) => (p.startsWith('--') ? getComputedStyle(el).getPropertyValue(p).trim() : getComputedStyle(el)[p]), prop);
  const GREEN = 'rgb(0, 128, 0)', BLUE = 'rgb(0, 0, 255)', RED = 'rgb(255, 0, 0)';

  // --- переменные: наследуются, переопределяются в поддереве, запасное значение ---
  await set(`
    :root { --accent: rgb(0, 0, 255); }
    .sale { --accent: rgb(255, 0, 0); }
    .btn { color: var(--accent); background: var(--missing, rgb(0, 128, 0)); }`,
  '<button class="btn" id="b1">Купить</button><section class="sale"><button class="btn" id="b2">Купить</button></section>');
  assert.equal(await cs('#b1', 'color'), BLUE);
  assert.equal(await cs('#b2', 'color'), RED);
  assert.equal(await cs('#b1', 'backgroundColor'), GREEN);
  await page.evaluate(() => document.documentElement.style.setProperty('--accent', 'rgb(0, 128, 0)'));
  assert.equal(await cs('#b1', 'color'), GREEN);                       // одно присваивание перекрасило всё

  // --- недопустимое при вычислении значение: свойство становится unset, предыдущее объявление не спасает ---
  await set(`
    .card { color: rgb(0, 128, 0); }
    .price { --size: 20px; color: blue; color: var(--size); }
    .badge { background: blue; background: var(--size); }`,
  '<div class="card"><span class="price" id="p">990 ₽</span><span class="badge" id="bd">−20%</span></div>');
  assert.equal(await cs('#p', 'color'), GREEN);                         // color наследуемый: unset = inherit
  assert.equal(await cs('#bd', 'backgroundColor'), 'rgba(0, 0, 0, 0)'); // background — нет: unset = initial, а не blue

  // --- переменная — последовательность токенов: var(--n)px не склеивается ---
  await set(`.a { --n: 120; width: var(--n)px; } .b { --n: 120; width: calc(var(--n) * 1px); } div { display: inline-block; height: 10px; }`,
    '<div class="a" id="a"></div><div class="b" id="b"></div>');
  assert.equal(await cs('#a', 'width'), '0px');                          // 120 px — два токена, ширина недопустима → auto
  assert.equal(await cs('#b', 'width'), '120px');

  // --- переменные проникают в Shadow DOM: так темизируют веб-компоненты ---
  await set(`x-rating { --star: rgb(255, 0, 0); }`, '<x-rating id="host"></x-rating>');
  const shadow = await page.evaluate(() => {
    const root = document.getElementById('host').attachShadow({ mode: 'open' });
    root.innerHTML = '<style>span { color: var(--star, black); }</style><span>★</span>';
    return getComputedStyle(root.querySelector('span')).color;
  });
  assert.equal(shadow, RED);

  // --- @property: тип, начальное значение, inherits: false ---
  await set(`
    @property --brand { syntax: "<color>"; inherits: false; initial-value: rgb(0, 0, 255); }
    .parent { --brand: rgb(255, 0, 0); }
    .child { color: var(--brand); }
    .bad { --brand: 20px; color: var(--brand); }`,
  '<div class="parent"><p class="child" id="c">ребёнок</p></div><p class="bad" id="bad">ошибка</p>');
  assert.equal(await cs('#c', 'color'), BLUE);                            // не унаследовал красный — взял initial-value
  assert.equal(await cs('#bad', '--brand'), BLUE);                        // 20px — не цвет: начальное значение

  // em в зарегистрированной <length> вычисляется у того, кто задал; незарегистрированная — у того, кто использует
  await set(`
    @property --pad { syntax: "<length>"; inherits: true; initial-value: 0px; }
    .reg { font-size: 10px; --pad: 2em; } .raw { font-size: 10px; --raw: 2em; }
    .item { font-size: 20px; } .reg .item { padding: var(--pad); } .raw .item { padding: var(--raw); }`,
  '<div class="reg"><p class="item" id="ri">чай</p></div><div class="raw"><p class="item" id="wi">чай</p></div>');
  assert.equal(await cs('#ri', 'paddingTop'), '20px');                     // 2 × 10px родителя
  assert.equal(await cs('#wi', 'paddingTop'), '40px');                     // 2 × 20px самого элемента
  assert.equal(await cs('#ri', '--pad'), '20px');
  assert.equal(await cs('#wi', '--raw'), '2em');                           // хранится как написано

  // --- вложенность ---
  await set(`
    .card {
      padding: 16px;
      &:hover { outline: 1px solid; }
      .title { font-weight: 700; }
      p { margin: 0; }
      &.featured { border: 2px solid; }
      @media (width >= 600px) { padding: 24px; }
      &__title { color: rgb(255, 0, 0); }
    }`,
  '<div class="card featured" id="card"><h3 class="title" id="t">Улун</h3><p id="p">описание</p><h3 class="card__title" id="bem">БЭМ</h3></div>');
  assert.equal(await cs('#t', 'fontWeight'), '700');
  assert.equal(await cs('#p', 'marginTop'), '0px');                       // селектор типа без & — работает
  assert.equal(await cs('#card', 'borderTopWidth'), '2px');
  assert.equal(await cs('#card', 'paddingTop'), '24px');                  // @media внутри правила (окно 1280px)
  assert.notEqual(await cs('#bem', 'color'), RED);                        // &__title из Sass не склеивается в .card__title

  // вложенность разворачивается в :is() — у всего списка специфичность самого сильного селектора
  await set(`
    .catalog, #promo { .price { color: rgb(255, 0, 0); } }
    .catalog .price.price.sale { color: rgb(0, 128, 0); }`,
  '<div class="catalog"><span class="price sale" id="pr">990 ₽</span></div>');
  assert.equal(await cs('#pr', 'color'), RED);                            // :is(.catalog, #promo) .price — (1,1,0) против (0,4,0)

  // --- цвета ---
  await set(`
    #y { color: oklch(from hsl(60 100% 50%) l c h); } #bl { color: oklch(from hsl(240 100% 50%) l c h); }
    #mix { color: color-mix(in srgb, rgb(255, 0, 0) 50%, rgb(0, 0, 255)); }
    #rel { --brand: oklch(0.6 0.2 15); color: oklch(from var(--brand) calc(l + 0.1) c h); }
    #cc { color: rgb(0, 128, 0); border: 2px solid currentColor; }`,
  '<p id="y">y</p><p id="bl">b</p><p id="mix">m</p><p id="rel">r</p><p id="cc">c</p>');
  const L = async (sel) => parseFloat((await cs(sel, 'color')).slice(6));
  assert.ok(await L('#y') > 0.95 && await L('#bl') < 0.46);               // одинаковые 50% в HSL — разная видимая светлота
  assert.equal(await cs('#mix', 'color'), 'color(srgb 0.5 0 0.5)');           // результат color-mix сериализуется в color()
  assert.equal(await cs('#rel', 'color'), 'oklch(0.7 0.2 15)');           // светлее на 0.1, тон и насыщенность те же
  assert.equal(await cs('#cc', 'borderTopColor'), GREEN);

  // light-dark() работает только при color-scheme, в котором есть обе темы
  await page.emulateMedia({ colorScheme: 'dark' });
  await set(`
    .on { color-scheme: light dark; color: light-dark(rgb(0, 0, 255), rgb(255, 0, 0)); }
    .off { color: light-dark(rgb(0, 0, 255), rgb(255, 0, 0)); }
    .forced { color-scheme: light; color: light-dark(rgb(0, 0, 255), rgb(255, 0, 0)); }`,
  '<p class="on" id="on">тема</p><p class="off" id="off">тема</p><p class="forced" id="forced">тема</p>');
  assert.equal(await cs('#on', 'color'), RED);                            // система тёмная — второй цвет
  assert.equal(await cs('#off', 'color'), BLUE);                          // без color-scheme — всегда светлый
  assert.equal(await cs('#forced', 'color'), BLUE);                       // принудительно светлая часть страницы
  await page.emulateMedia({ colorScheme: 'light' });

  // --- якорное позиционирование: подсказка над кнопкой, у верхнего края — переворачивается вниз ---
  const tooltip = async (top) => {
    await set(`
      .buy { anchor-name: --buy; position: absolute; left: 100px; top: ${top}px; width: 120px; height: 40px; }
      .tip { position: absolute; position-anchor: --buy; bottom: anchor(top); left: anchor(left); width: 160px; height: 30px; margin: 0;
             position-try-fallbacks: flip-block; }`,
    '<button class="buy" id="buy">В корзину</button><div class="tip" id="tip">Доставка завтра</div>');
    const b = await page.$eval('#buy', (el) => el.getBoundingClientRect().toJSON());
    const t = await page.$eval('#tip', (el) => el.getBoundingClientRect().toJSON());
    return { above: Math.round(t.bottom) === Math.round(b.top), below: Math.round(t.top) === Math.round(b.bottom), left: Math.round(t.left) === Math.round(b.left) };
  };
  assert.deepEqual(await tooltip(300), { above: true, below: false, left: true });
  assert.deepEqual(await tooltip(5), { above: false, below: true, left: true });     // сверху места нет — flip-block

  // --- формы: accent-color, appearance, field-sizing ---
  await set(`
    .agree { accent-color: rgb(233, 69, 96); }
    .custom { appearance: none; width: 20px; height: 20px; border: 2px solid; }
    textarea { font: 16px/20px sans-serif; width: 300px; padding: 0; border: 0; }
    .grow { field-sizing: content; min-height: 2lh; max-height: 6lh; }`,
  `<input type="checkbox" class="agree" id="agree" checked><input type="checkbox" class="custom" id="custom">
   <textarea id="fixed" rows="2"></textarea><textarea class="grow" id="grow"></textarea>`);
  assert.equal(await cs('#agree', 'accentColor'), 'rgb(233, 69, 96)');
  assert.equal(await cs('#custom', 'appearance'), 'none');
  const height = (sel) => page.$eval(sel, (el) => el.getBoundingClientRect().height);
  assert.equal(await height('#grow'), 40);                                   // min-height: 2 строки
  await page.fill('#grow', 'Позвонить\nза час\nдо доставки\nкод 1234');
  assert.equal(await height('#grow'), 80);                                    // выросло под 4 строки
  await page.fill('#grow', 'строка\n'.repeat(12));
  assert.equal(await height('#grow'), 120);                                   // упёрлось в max-height: 6 строк
  await page.fill('#fixed', 'Позвонить\nза час\nдо доставки\nкод 1234');
  assert.equal(await height('#fixed'), 40);                                   // обычное поле не растёт

  // настраиваемый select: в Chromium есть appearance: base-select и ::picker(select)
  await set(`select, ::picker(select) { appearance: base-select; }`, '<select id="sel"><option>Курьер</option><option>Самовывоз</option></select>');
  assert.equal(await cs('#sel', 'appearance'), 'base-select');
});

console.log('modern ok');
