// Глава 9.06 — «Состояние живёт в позиции»: тот же тип на том же месте сохраняет state,
// другое место или тип — сбрасывает; компонент, объявленный внутри компонента, сбрасывается каждый рендер;
// корректировка state во время рендера вместо эффекта.
// run: node position.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState } = React;
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

function Field({ label }) {
  const [v, setV] = useState('');
  return h('label', null, label, h('input', { value: v, onChange: (e) => setV(e.target.value) }));
}
async function type(container, text) {
  const input = container.querySelector('input');
  setter.call(input, text);
  await React.act(async () => input.dispatchEvent(new window.Event('input', { bubbles: true })));
}
const val = (c) => c.querySelector('input').value;

(async () => {
  // тернарник: тот же тип на той же позиции — состояние сохраняется, хотя «это другой» Field
  {
    const view = (isCompany) => h('form', null, isCompany ? h(Field, { label: 'ИНН' }) : h(Field, { label: 'Паспорт' }));
    const m = await mount(view(false));
    await type(m.container, '1234');
    await m.render(view(true));
    assert.equal(val(m.container), '1234');
    // с разными key — сброс
    const keyed = (isCompany) => h('form', null, isCompany ? h(Field, { key: 'inn', label: 'ИНН' }) : h(Field, { key: 'pass', label: 'Паспорт' }));
    const k = await mount(keyed(false));
    await type(k.container, '1234');
    await k.render(keyed(true));
    assert.equal(val(k.container), '');
    // разные позиции (&& и &&) — тоже сброс
    const slots = (isCompany) => h('form', null, isCompany && h(Field, { label: 'ИНН' }), !isCompany && h(Field, { label: 'Паспорт' }));
    const s = await mount(slots(false));
    await type(s.container, '1234');
    await s.render(slots(true));
    assert.equal(val(s.container), '');
    // другой тип родителя на том же месте — сброс всего поддерева
    const wrap = (asSection) => h(asSection ? 'section' : 'div', null, h(Field, { label: 'x' }));
    const w = await mount(wrap(false));
    await type(w.container, 'kept?');
    await w.render(wrap(true));
    assert.equal(val(w.container), '');
  }

  // компонент, объявленный внутри другого: новая функция — новый тип — сброс на каждом рендере родителя
  {
    let bump;
    function Page() {
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      function Search() { const [q, setQ] = useState(''); return h('input', { value: q, onChange: (e) => setQ(e.target.value) }); }
      return h('div', null, h('span', null, n), h(Search));
    }
    const { container } = await mount(h(Page));
    await type(container, 'react');
    assert.equal(val(container), 'react');
    await React.act(async () => bump());
    assert.equal(val(container), '');
  }

  // корректировка state при смене props прямо в рендере: без эффекта и без кадра со старым выделением
  {
    const renders = [];
    const commits = [];
    function List({ items }) {
      const [prevItems, setPrevItems] = useState(items);
      const [selected, setSelected] = useState(items[0]);
      if (items !== prevItems) {
        setPrevItems(items);
        setSelected(null);
      }
      renders.push(String(selected));
      React.useLayoutEffect(() => { commits.push(String(selected)); });
      return null;
    }
    const m = await mount(h(List, { items: ['a', 'b'] }));
    await m.render(h(List, { items: ['c'] }));
    assert.deepEqual(renders, ['a', 'a', 'null']); // повторный вызов сразу, до commit
    assert.deepEqual(commits, ['a', 'null']);       // кадра со старым выделением нет
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
