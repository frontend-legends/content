// Глава 9.11 — «Практика»: (1) memo-список рендерится на каждую букву из-за новых ссылок, фикс — стабильные ссылки;
// (2) поле, которым управляет state из transition, откатывается к старому значению; фикс — срочный state для поля.
// Задача про ключи проверяется в lists.cjs.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, useCallback, memo, startTransition } = React;

async function typeInto(container, letters) {
  const input = container.querySelector('input');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  for (const v of letters) {
    await React.act(async () => { setValue.call(input, v); input.dispatchEvent(new window.Event('input', { bubbles: true })); });
  }
  return input;
}

(async () => {
  // 1. memo не помогает
  for (const fixed of [false, true]) {
    let renders = 0;
    const ProductList = memo(function ProductList() { renders++; return null; });
    const DEFAULT_FILTERS = { inStock: true };
    function Page({ products }) {
      const [query, setQuery] = useState('');
      const [selected, setSelected] = useState(null);
      const onSelectFixed = useCallback((id) => setSelected(id), []);
      return h('div', null,
        h('input', { value: query, onChange: (e) => setQuery(e.target.value) }),
        fixed
          ? h(ProductList, { items: products, filters: DEFAULT_FILTERS, onSelect: onSelectFixed })
          : h(ProductList, { items: products, filters: { inStock: true }, onSelect: (id) => setSelected(id) }),
      );
    }
    const products = [];
    const { container } = await mount(h(Page, { products }));
    await typeInto(container, ['p', 'ph', 'pho']);
    assert.equal(renders, fixed ? 1 : 4);
  }

  // 2. поле под управлением transition-state: после события DOM откатывается к старому value
  {
    let shownDuringEvent;
    function Search() {
      const [query, setQuery] = useState('');
      return h('input', { value: query, onChange: (e) => startTransition(() => setQuery(e.target.value)) });
    }
    const { container } = await mount(h(Search));
    const input = container.querySelector('input');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await React.act(async () => {
      setValue.call(input, 'a');
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
      shownDuringEvent = input.value; // сразу после события, до рендера transition
    });
    assert.equal(shownDuringEvent, ''); // контролируемое поле вернуло старое значение
    assert.equal(input.value, 'a');     // а потом transition докоммитился

    // фикс: поле — срочный state, тяжёлое — отдельный transition-state
    let listQ;
    function Fixed() {
      const [text, setText] = useState('');
      const [query, setQuery] = useState('');
      listQ = query;
      return h('input', { value: text, onChange: (e) => { setText(e.target.value); startTransition(() => setQuery(e.target.value)); } });
    }
    const f = await mount(h(Fixed));
    const fi = f.container.querySelector('input');
    let during;
    await React.act(async () => {
      setValue.call(fi, 'a');
      fi.dispatchEvent(new window.Event('input', { bubbles: true }));
      during = fi.value;
    });
    assert.equal(during, 'a');
    assert.equal(listQ, 'a');
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
