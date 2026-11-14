// Глава 9.07 — «Практика»: что выведет вложенный контекст; вынесенный провайдер не рендерит потребителей при вводе.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { createContext, useContext, useState, useMemo, memo } = React;

(async () => {
  {
    const Theme = createContext('light');
    function Label() { return h('i', null, useContext(Theme)); }
    function App() {
      const theme = useContext(Theme);
      return h(Theme, { value: 'dark' }, h('b', null, theme), h(Label), h(Theme, { value: 'contrast' }, h(Label)));
    }
    const { container } = await mount(h(React.Fragment, null, h(App), h(Label)));
    assert.deepEqual([...container.querySelectorAll('b, i')].map((e) => e.textContent), ['light', 'dark', 'contrast', 'light']);
  }
  {
    const AppContext = createContext(null);
    let consumer = 0, typeQ;
    function Avatar() { consumer++; return h('i', null, useContext(AppContext).theme); }
    function Page({ query }) { return h('section', null, query, h(AvatarBox)); }
    const AvatarBox = memo(function AvatarBox() { return h(Avatar); });
    function AppProvider({ children }) {
      const [user, setUser] = useState(null);
      const [theme, setTheme] = useState('dark');
      const value = useMemo(() => ({ user, theme, setUser, setTheme }), [user, theme]);
      return h(AppContext, { value }, children);
    }
    function App() {
      const [query, setQuery] = useState('');
      typeQ = setQuery;
      return h(AppProvider, null, h(Page, { query }));
    }
    await mount(h(App));
    for (const q of ['a', 'ab', 'abc']) await React.act(async () => typeQ(q));
    assert.equal(consumer, 1);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
