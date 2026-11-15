// Проверки к 15.08 в Chromium: нативные замены библиотек — dialog, popover, :has, контейнерные запросы,
// вложенность CSS, привязка к якорю, View Transitions, structuredClone и Object.groupBy; статусы Baseline из web-features.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codesDir } from '../../_lib/project.mjs';
import { features } from 'web-features';
import { withPage } from '../../_lib/browser.mjs';

const webFeaturesVersion = JSON.parse(readFileSync(join(codesDir, 'node_modules/web-features/package.json'), 'utf8')).version;

await withPage(async (page) => {
  await page.setContent(`<!doctype html><html><body>
    <style>
      .card { padding: 16px; } .card:has(img) { padding: 0; }
      .wrap { container-type: inline-size; width: 300px; } .wrap.wide { width: 600px; }
      .title { font-size: 14px; } @container (min-width: 400px) { .title { font-size: 24px; } }
      .menu { color: black; & .item { color: rgb(255, 0, 0); } }
      #anchor { anchor-name: --cart; position: absolute; top: 200px; left: 50px; width: 80px; height: 30px; }
      #tip { position: absolute; position-anchor: --cart; top: anchor(bottom); left: anchor(left); margin: 0; }
    </style>
    <button id="open">Оформить</button>
    <dialog id="dlg"><input id="name" autofocus><button id="close">Закрыть</button></dialog>
    <button popovertarget="pop" id="toggle">Фильтры</button><div popover id="pop">панель фильтров</div>
    <div class="card" id="c1"><img alt=""></div><div class="card" id="c2">текст</div>
    <div class="wrap" id="w"><h2 class="title" id="t">Пуэр</h2></div>
    <nav class="menu"><a class="item" id="item">Каталог</a></nav>
    <div id="anchor">корзина</div><div id="tip">3 товара</div>
  </body></html>`);

  // --- dialog: модальность, фокус внутрь, Escape закрывает, фокус возвращается ---
  await page.focus('#open');
  await page.evaluate(() => document.getElementById('dlg').showModal());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
  assert.equal(await page.evaluate(() => document.getElementById('dlg').matches(':modal')), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('dlg').open, document.activeElement.id]), [false, 'open']);

  // --- popover: открытие кнопкой без JS и закрытие по клику снаружи ---
  await page.click('#toggle');
  assert.equal(await page.evaluate(() => document.getElementById('pop').matches(':popover-open')), true);
  await page.mouse.click(5, 400);
  assert.equal(await page.evaluate(() => document.getElementById('pop').matches(':popover-open')), false);

  // --- CSS: :has, контейнерные запросы, вложенность ---
  const css = await page.evaluate(() => {
    const s = (id, p) => getComputedStyle(document.getElementById(id))[p];
    const narrow = s('t', 'fontSize');
    document.getElementById('w').classList.add('wide');
    return { withImg: s('c1', 'paddingTop'), withoutImg: s('c2', 'paddingTop'), narrow, wide: s('t', 'fontSize'), nested: s('item', 'color') };
  });
  assert.deepEqual(css, { withImg: '0px', withoutImg: '16px', narrow: '14px', wide: '24px', nested: 'rgb(255, 0, 0)' });

  // --- привязка к якорю: подсказка стоит под корзиной без JS-расчётов ---
  const anchor = await page.evaluate(() => {
    const a = document.getElementById('anchor').getBoundingClientRect();
    const t = document.getElementById('tip').getBoundingClientRect();
    return { top: t.top - a.bottom, left: t.left - a.left, supported: CSS.supports('anchor-name: --x') };
  });
  assert.deepEqual(anchor, { top: 0, left: 0, supported: true });

  // --- View Transitions и JS-замены утилит ---
  const js = await page.evaluate(async () => {
    const vt = typeof document.startViewTransition === 'function';
    let updated = false;
    if (vt) await document.startViewTransition(() => { updated = true; }).updateCallbackDone;
    const order = { at: new Date('2026-11-15'), items: new Map([[7, 2]]) };
    const copy = structuredClone(order);
    return {
      vt, updated,
      cloneDeep: copy.at instanceof Date && copy.items.get(7) === 2 && copy.items !== order.items,
      grouped: Object.keys(Object.groupBy([{ s: 'paid' }, { s: 'new' }, { s: 'paid' }], (o) => o.s)),
      last: [1, 2, 3].at(-1),
      temporal: typeof Temporal,
    };
  });
  assert.equal(js.vt, true);
  assert.equal(js.updated, true);
  assert.equal(js.cloneDeep, true);
  assert.deepEqual(js.grouped, ['paid', 'new']);
  assert.equal(js.last, 3);
  console.log(`  Temporal в проверочном Chromium: ${js.temporal}`);
});

// --- Baseline: данные web-features; «широко доступно» наступает через 30 месяцев после «впервые во всех» ---
const status = (id) => features[id].status;
assert.equal(status('has').baseline, 'high');
assert.equal(status('dialog').baseline, 'high');
assert.equal(status('container-queries').baseline, 'high');
assert.equal(status('anchor-positioning').baseline, false); // в Chromium работает, но ещё не во всех основных браузерах
assert.equal(status('temporal').baseline, false);
const plus30 = (d) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + 30); return x.toISOString().slice(0, 10); };
for (const id of ['has', 'container-queries', 'nesting', 'dialog']) assert.equal(status(id).baseline_high_date, plus30(status(id).baseline_low_date), id);
console.log(`  web-features ${webFeaturesVersion}: popover ${status('popover').baseline}, view-transitions ${status('view-transitions').baseline}`);

console.log('platform ok');
