// Глава 9.11 — «Структура вместо мемоизации»: state, спущенный вниз, рендерит только своё поддерево;
// children, созданные снаружи, не рендерятся при обновлении обёртки; разделённый контекст будит только своих.
// run: node structure.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, createContext, useContext, memo } = React;

(async () => {
  // 1. state вниз: query живёт в SearchBox, Chart рядом не рендерится
  {
    let type, chart = 0, box = 0;
    function Chart() { chart++; return null; }
    function SearchBox() { const [q, setQ] = useState(''); type = setQ; box++; return h('input', { value: q, onChange() {} }); }
    function App() { return h('div', null, h(SearchBox), h(Chart)); }
    await mount(h(App));
    for (const q of ['a', 'ab']) await React.act(async () => type(q));
    assert.deepEqual([box, chart], [3, 1]);
  }

  // 2. children как props: Panel хранит state, но HeavyTree создан в App и не рендерится
  {
    let toggle, heavy = 0, panel = 0;
    function HeavyTree() { heavy++; return null; }
    function Panel({ children }) {
      const [open, setOpen] = useState(true);
      toggle = () => setOpen((o) => !o);
      panel++;
      return h('section', { hidden: !open }, children);
    }
    function App() { return h(Panel, null, h(HeavyTree)); }
    await mount(h(App));
    await React.act(async () => toggle());
    await React.act(async () => toggle());
    assert.deepEqual([panel, heavy], [3, 1]);
  }

  // 3. разделённый контекст: смена user не будит тех, кто читает только theme
  {
    const UserCtx = createContext(null), ThemeCtx = createContext('light');
    let setUser; const r = { user: 0, theme: 0 };
    const UserBadge = memo(function UserBadge() { useContext(UserCtx); r.user++; return null; });
    const ThemeButton = memo(function ThemeButton() { useContext(ThemeCtx); r.theme++; return null; });
    function App() {
      const [user, s] = useState('Ann'); setUser = s;
      return h(UserCtx.Provider, { value: user }, h(ThemeCtx.Provider, { value: 'dark' }, h(UserBadge), h(ThemeButton)));
    }
    await mount(h(App));
    await React.act(async () => setUser('Bob'));
    assert.deepEqual(r, { user: 2, theme: 1 });
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
