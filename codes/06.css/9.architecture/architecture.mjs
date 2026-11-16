// Проверки к 6.09: изоляция стилей настоящими инструментами.
// CSS Modules — сборка Vite: классы хешируются, селекторы типа остаются глобальными, :global не трогается, composes даёт несколько классов.
// Vue scoped — vue/compiler-sfc и монтирование: атрибут data-v на селекторах, корень дочернего компонента получает стили родителя, :deep.
// Shadow DOM, слои для легаси и токены в три уровня — в Chromium.
// Запуск: cd codes && node run.mjs 06.css/9.architecture
import '../../_lib/vue.mjs';                    // jsdom для монтирования Vue — раньше самого 'vue'
import { h, createApp } from 'vue';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { compileStyle } from 'vue/compiler-sfc';
import { project, read, list } from '../../_lib/project.mjs';
import { withPage } from '../../_lib/browser.mjs';

// --- CSS Modules ---
const dir = project({
  'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
  'src/shared.module.css': '.base { padding: 16px; border-radius: 8px; }\n',
  'src/card.module.css': `.card { composes: base from './shared.module.css'; background: white; }
.featured { composes: card; border: 2px solid; }
.title { font-weight: 700; }
p { margin: 0; }
:global(.is-open) .title { color: red; }
`,
  'src/main.js': "import s from './card.module.css';\nwindow.__classes = s;\ndocument.body.innerHTML = `<article class=\"${s.featured}\"><h3 class=\"${s.title}\">Улун</h3><p>описание</p></article>`;\n",
});
await build({ root: dir, logLevel: 'silent' });
const css = read(dir, 'dist/' + list(dir, 'dist').find((f) => f.endsWith('.css')));
const js = read(dir, 'dist/' + list(dir, 'dist').find((f) => f.endsWith('.js')));
assert.match(css, /\._title_[\w-]+\{font-weight:700\}/);              // класс получил уникальное имя
assert.match(css, /(^|\})p\{margin:0\}/);                              // а селектор типа остался глобальным: все p на странице
assert.match(css, /\.is-open \._title_[\w-]+\{color:red\}/);           // :global оставил имя как есть
const featured = js.match(/[`"'](_featured_[\w-]+(?: _[\w-]+)+)[`"']/)?.[1];
assert.ok(featured, 'в бандле есть строка классов featured');
assert.deepEqual(featured.split(' ').map((c) => c.split('_')[1]), ['featured', 'card', 'base']); // composes — несколько классов на элементе

// --- Vue scoped: что делает компилятор ---
const scoped = compileStyle({
  source: '.label { color: red; } .child { border: 2px solid; } .wrap :deep(.label) { font-weight: 700; } p { margin: 0; }',
  id: 'data-v-7ba5bd90', scoped: true, filename: 'Parent.vue',
}).code.replace(/\s+/g, ' ');
assert.match(scoped, /\.label\[data-v-7ba5bd90\] \{ color: red;/);
assert.match(scoped, /\.child\[data-v-7ba5bd90\]/);
assert.match(scoped, /\.wrap\[data-v-7ba5bd90\] \.label/);            // :deep — атрибут уходит на предка
assert.match(scoped, /p\[data-v-7ba5bd90\]/);                          // в отличие от CSS Modules, и селектор типа

// --- Vue scoped: что получает DOM — корень ребёнка помечен атрибутом родителя, его потомки — нет ---
const Child = { render: () => h('div', { class: 'child' }, [h('span', { class: 'label', id: 'inner' }, 'внутри ребёнка')]) };
const Parent = { __scopeId: 'data-v-7ba5bd90', render: () => h('section', { class: 'wrap' }, [h('span', { class: 'label', id: 'own' }, 'своё'), h(Child)]) };
const host = document.createElement('div');
createApp(Parent).mount(host);
const markup = host.innerHTML;
const scopedAttr = (sel) => host.querySelector(sel).hasAttribute('data-v-7ba5bd90');
assert.equal(scopedAttr('.wrap'), true);
assert.equal(scopedAttr('#own'), true);
assert.equal(scopedAttr('.child'), true);                             // корень ребёнка — с атрибутом родителя
assert.equal(scopedAttr('#inner'), false);                            // внутренности ребёнка — без

await withPage(async (page) => {
  const cs = (sel, prop) => page.$eval(sel, (el, p) => getComputedStyle(el)[p], prop);

  // тот же скомпилированный CSS и та же разметка в браузере
  await page.setContent(`<!doctype html><style>${scoped}</style>${markup}`);
  assert.equal(await cs('#own', 'color'), 'rgb(255, 0, 0)');
  assert.equal(await cs('.child', 'borderTopWidth'), '2px');           // стиль родителя достал корень ребёнка
  assert.notEqual(await cs('#inner', 'color'), 'rgb(255, 0, 0)');      // а внутрь ребёнка — нет
  assert.equal(await cs('#inner', 'fontWeight'), '700');               // кроме :deep

  // --- Shadow DOM: внешние селекторы внутрь не проходят, наследование и переменные — проходят, ::part открывает дверь ---
  await page.setContent(`<!doctype html><style>
      .title { color: rgb(255, 0, 0); }
      pay-widget { color: rgb(0, 128, 0); --pay-accent: rgb(0, 0, 255); }
      pay-widget::part(button) { border-radius: 12px; }
    </style><pay-widget id="w"></pay-widget>`);
  const shadow = await page.evaluate(() => {
    const root = document.getElementById('w').attachShadow({ mode: 'open' });
    root.innerHTML = `<style>button { background: var(--pay-accent, black); }</style>
      <h3 class="title">Оплата</h3><button part="button">Оплатить</button>`;
    const st = (el) => getComputedStyle(el);
    const t = root.querySelector('.title'), b = root.querySelector('button');
    return { title: st(t).color, bg: st(b).backgroundColor, radius: st(b).borderTopLeftRadius };
  });
  assert.equal(shadow.title, 'rgb(0, 128, 0)');                         // .title снаружи не применился, цвет унаследован от хоста
  assert.equal(shadow.bg, 'rgb(0, 0, 255)');                            // переменная прошла внутрь
  assert.equal(shadow.radius, '12px');                                  // ::part — разрешённая точка стилизации

  // --- слои: легаси вне слоёв перебивает утилиты; в слое — нет ---
  const legacyCss = '.catalog h2 { margin-top: 24px; }';
  const layered = (wrapLegacy) => page.setContent(`<!doctype html><style>
      @layer reset, legacy, components, utilities;
      ${wrapLegacy ? `@layer legacy { ${legacyCss} }` : legacyCss}
      @layer utilities { .mt-0 { margin-top: 0; } }
    </style><div class="catalog"><h2 class="mt-0" id="h">Чай</h2></div>`);
  await layered(false);
  assert.equal(await cs('#h', 'marginTop'), '24px');
  await layered(true);
  assert.equal(await cs('#h', 'marginTop'), '0px');

  // --- токены в три уровня: компонент → смысл → палитра; тема меняет только смысловой уровень ---
  await page.setContent(`<!doctype html><style>
      :root {
        --blue-600: rgb(37, 99, 235); --red-600: rgb(220, 38, 38); --gray-50: rgb(249, 250, 251); --gray-900: rgb(17, 24, 39);
        --color-action: var(--blue-600); --color-surface: var(--gray-50);
      }
      [data-theme="sale"] { --color-action: var(--red-600); }
      .button { --button-bg: var(--color-action); background: var(--button-bg); }
      .link { color: var(--color-action); }
      .button.danger { --button-bg: var(--red-600); }
    </style>
    <button class="button" id="b">Купить</button><a class="link" id="l">Доставка</a><button class="button danger" id="d">Удалить</button>
    <section data-theme="sale"><button class="button" id="sb">Купить</button><a class="link" id="sl">Доставка</a></section>`);
  assert.equal(await cs('#b', 'backgroundColor'), 'rgb(37, 99, 235)');
  assert.equal(await cs('#l', 'color'), 'rgb(37, 99, 235)');
  assert.equal(await cs('#sb', 'backgroundColor'), 'rgb(220, 38, 38)');  // тема распродажи — одна строка
  assert.equal(await cs('#sl', 'color'), 'rgb(220, 38, 38)');
  assert.equal(await cs('#d', 'backgroundColor'), 'rgb(220, 38, 38)');   // вариант компонента — через его токен
});

console.log('architecture ok');
