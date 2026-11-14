// Глава 9.01 — код из раздела «Практика».
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState } = React;

(async () => {
  // P1: часы в родителе перерендеривают тяжёлый список каждую секунду; фикс — опустить состояние в Clock
  {
    let listRenders = 0, tick;
    function ExpensiveList() { listRenders++; return h('ul'); }
    function Page() {
      const [now, setNow] = useState(0);
      tick = () => setNow((t) => t + 1);
      return h('main', null, h('time', null, now), h(ExpensiveList));
    }
    await mount(h(Page));
    for (let i = 0; i < 3; i++) await React.act(async () => tick());
    assert.equal(listRenders, 4);

    let fixedRenders = 0, tick2;
    function List2() { fixedRenders++; return h('ul'); }
    function Clock() {
      const [now, setNow] = useState(0);
      tick2 = () => setNow((t) => t + 1);
      return h('time', null, now);
    }
    function Page2() { return h('main', null, h(Clock), h(List2)); }
    const { container } = await mount(h(Page2));
    for (let i = 0; i < 3; i++) await React.act(async () => tick2());
    assert.equal(fixedRenders, 1);
    assert.equal(container.querySelector('time').textContent, '3');
  }

  // P2: компонент, вызванный как функция, — его хуки становятся хуками родителя
  {
    function Avatar({ user }) {
      const [big] = useState(false);
      return h('img', { alt: user.name, width: big ? 96 : 32 });
    }
    function Header({ user }) {
      const [menuOpen] = useState(false);
      return h('header', { 'data-menu': menuOpen }, user ? Avatar({ user }) : 'Гость');
    }
    const m = await mount(h(Header, { user: { name: 'Ann' } }));
    let thrown;
    try { await m.render(h(Header, { user: null })); } catch (e) { thrown = e.message; }
    assert.equal(thrown, 'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.');

    function FixedHeader({ user }) {
      const [menuOpen] = useState(false);
      return h('header', { 'data-menu': menuOpen }, user ? h(Avatar, { user }) : 'Гость');
    }
    const f = await mount(h(FixedHeader, { user: { name: 'Ann' } }));
    await f.render(h(FixedHeader, { user: null }));
    await f.render(h(FixedHeader, { user: { name: 'Bob' } }));
    assert.equal(f.container.innerHTML, '<header data-menu="false"><img alt="Bob" width="32"></header>');
  }

  // P3: счётчик корзины в двух местах — в React оба места выводятся из одного состояния
  {
    let add;
    function Shop() {
      const [items, setItems] = useState([]);
      add = (item) => setItems((list) => [...list, item]);
      return h('div', null,
        h('span', { id: 'badge' }, items.length),
        h('button', { id: 'buy', disabled: items.length === 0 }, `Купить (${items.length})`));
    }
    const { container } = await mount(h(Shop));
    assert.equal(container.querySelector('#buy').disabled, true);
    await React.act(async () => add('book'));
    await React.act(async () => add('pen'));
    assert.equal(container.querySelector('#badge').textContent, '2');
    assert.equal(container.querySelector('#buy').textContent, 'Купить (2)');
    assert.equal(container.querySelector('#buy').disabled, false);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
