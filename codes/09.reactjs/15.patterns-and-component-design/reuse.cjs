// Глава 9.15 — HOC и render props: коллизия props, статические методы теряются, ref в React 19 проходит через {...props},
// render prop как новая функция ломает memo.
// run: node reuse.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo, useRef, useEffect } = React;

(async () => {
  // два HOC кладут prop с одним именем: побеждает внешний, внутренний молча затёрт
  {
    const withUser = (C) => (props) => h(C, { ...props, data: 'user' });
    const withTheme = (C) => (props) => h(C, { data: 'theme', ...props });
    function Card({ data }) { return h('i', null, data); }
    const Enhanced = withTheme(withUser(Card));
    const { container } = await mount(h(Enhanced));
    assert.equal(container.textContent, 'user'); // theme пропал без ошибки
  }

  // статические методы компонента HOC не переносит
  {
    function Page() { return null; }
    Page.loadData = () => 'data';
    const withAuth = (C) => function WithAuth(props) { return h(C, props); };
    assert.equal(withAuth(Page).loadData, undefined);
  }

  // React 19: ref — обычный prop, поэтому {...props} в HOC пробрасывает его сам
  {
    function Input({ ref }) { return h('input', { ref }); }
    const withLog = (C) => function WithLog(props) { return h(C, props); };
    const LoggedInput = withLog(Input);
    let node;
    function App() { const r = useRef(null); useEffect(() => { node = r.current; }); return h(LoggedInput, { ref: r }); }
    await mount(h(App));
    assert.equal(node?.tagName, 'INPUT');
  }

  // render prop как новая функция на каждом рендере — memo-компонент рендерится каждый раз
  {
    let renders = 0, bump;
    const List = memo(function List({ renderItem }) { renders++; return h('ul', null, ['a'].map((x) => h('li', { key: x }, renderItem(x)))); });
    function App() {
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      return h('div', null, n, h(List, { renderItem: (x) => h('b', null, x) }));
    }
    await mount(h(App));
    await React.act(async () => bump());
    assert.equal(renders, 2);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
