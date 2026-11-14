// Глава 9.06 — «Хранить или вычислять»: копия объекта в state устаревает, id — нет;
// useState(prop) не следит за prop; эффект для производного значения даёт лишний рендер.
// run: node structure.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, useEffect } = React;

(async () => {
  // копия выбранного объекта против id
  for (const mode of ['object', 'id']) {
    let rename, select;
    function Shop() {
      const [products, setProducts] = useState([{ id: 1, title: 'Чайник' }, { id: 2, title: 'Кружка' }]);
      const [selectedObj, setSelectedObj] = useState(null);
      const [selectedId, setSelectedId] = useState(null);
      const selected = mode === 'object' ? selectedObj : products.find((p) => p.id === selectedId);
      select = (p) => (mode === 'object' ? setSelectedObj(p) : setSelectedId(p.id));
      rename = () => setProducts((list) => list.map((p) => (p.id === 1 ? { ...p, title: 'Чайник 2.0' } : p)));
      return h('div', null, h('ul', null, products.map((p) => h('li', { key: p.id }, p.title))), h('aside', null, selected?.title ?? '—'));
    }
    const { container } = await mount(h(Shop));
    await React.act(async () => select({ id: 1, title: 'Чайник' }));
    await React.act(async () => rename());
    const list = container.querySelector('li').textContent;
    const aside = container.querySelector('aside').textContent;
    assert.equal(list, 'Чайник 2.0');
    assert.equal(aside, mode === 'object' ? 'Чайник' : 'Чайник 2.0');
  }

  // useState(prop): начальное значение читается один раз
  {
    function Price({ initial }) { const [v] = useState(initial); return h('b', null, v); }
    const m = await mount(h(Price, { initial: 10 }));
    await m.render(h(Price, { initial: 20 }));
    assert.equal(m.container.textContent, '10');
  }

  // производное значение через эффект: лишний рендер и commit со старым значением
  for (const mode of ['effect', 'render']) {
    const committed = [];
    function Filtered({ items, query }) {
      const [visible, setVisible] = useState([]);
      useEffect(() => { if (mode === 'effect') setVisible(items.filter((i) => i.includes(query))); }, [items, query]);
      const shown = mode === 'effect' ? visible : items.filter((i) => i.includes(query));
      useEffect(() => { committed.push(shown.join(',')); });
      return h('i', null, shown.join(','));
    }
    const items = ['apple', 'banana', 'avocado'];
    const m = await mount(h(Filtered, { items, query: 'a' }));
    committed.length = 0;
    await m.render(h(Filtered, { items, query: 'av' }));
    assert.deepEqual(committed, mode === 'effect' ? ['apple,banana,avocado', 'avocado'] : ['avocado']);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
