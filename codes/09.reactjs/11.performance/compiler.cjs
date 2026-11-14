// Глава 9.11 — «React Compiler»: на настоящем выводе компилятора (_compiled/page.cjs) ввод в поле
// не рендерит Chart, ProductList рендерится, только когда меняется visible, onSelect стабилен;
// компонент с нарушением правил компилятор пропустил — он ведёт себя как без компилятора.
// run: node compiler.cjs
const assert = require('node:assert/strict');
const { React, h, mount, fiberOf } = require('../../_lib/react.cjs');

(async () => {
  const counts = { chart: 0, list: 0 };
  const handlers = new Set();
  const Chart = () => { counts.chart++; return h('svg'); };
  const ProductList = ({ items, onSelect }) => { counts.list++; handlers.add(onSelect); return h('ul', null, items.length); };
  const { SearchPage, SkippedPage } = require('./_compiled/page.cjs')({ React, useState: React.useState, Chart, ProductList, track() {} });
  const products = [{ name: 'apple' }, { name: 'banana' }, { name: 'cherry' }];

  async function type(Page, letters) {
    counts.chart = counts.list = 0; handlers.clear();
    const { container } = await mount(h(Page, { products }));
    const input = container.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const q of letters) {
      await React.act(async () => {
        setter.call(input, q);
        input.dispatchEvent(new window.Event('input', { bubbles: true }));
      });
    }
    return { container, counts: { ...counts }, handlers: handlers.size };
  }

  // скомпилированный SearchPage: 3 буквы
  const compiled = await type(SearchPage, ['a', 'an', 'ana']);
  assert.equal(compiled.container.querySelector('ul').textContent, '1'); // banana
  assert.equal(compiled.counts.chart, 1);  // только mount: элемент <Chart data={products}/> взят из кеша
  assert.equal(compiled.counts.list, 4);   // mount + 'a' + 'an' + 'ana': visible каждый раз новый
  assert.equal(compiled.handlers, 1);      // onSelect вынесен из компонента в _temp — одна функция

  // кеш компилятора (useMemoCache) живёт на fiber компонента, а не в списке ячеек хуков
  const fiber = fiberOf(compiled.container.querySelector('div'));
  assert.equal(fiber.updateQueue.memoCache.data[0].length, 16); // _c(16)

  // пропущенный SkippedPage — обычный компонент: Chart и новая onSelect на каждый рендер
  const skipped = await type(SkippedPage, ['a', 'an', 'ana']);
  assert.equal(skipped.counts.chart, 4);
  assert.equal(skipped.counts.list, 4);
  assert.equal(skipped.handlers, 4);
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
