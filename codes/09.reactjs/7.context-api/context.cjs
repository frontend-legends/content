// Глава 9.07 — механика контекста: ближайший провайдер, default, <Ctx> как провайдер в React 19,
// обновление проходит сквозь memo, объект-литерал в value, разделение контекстов, паттерн children,
// компонент не видит значение своего же провайдера.
// run: node context.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { createContext, useContext, useState, useMemo, useReducer, memo } = React;

(async () => {
  // ближайший провайдер, default без провайдера, <Ctx value> как провайдер
  {
    const Theme = createContext('light');
    assert.equal(Theme.Provider, Theme); // в React 19 Provider — это сам контекст
    function Label() { return h('i', null, useContext(Theme)); }
    const { container } = await mount(h('div', null,
      h(Label),
      h(Theme, { value: 'dark' }, h(Label), h(Theme.Provider, { value: 'contrast' }, h(Label)))));
    assert.deepEqual([...container.querySelectorAll('i')].map((i) => i.textContent), ['light', 'dark', 'contrast']);
  }

  // компонент, который рендерит провайдер, читает значение СВЕРХУ, а не своё
  {
    const Theme = createContext('light');
    function App() {
      const theme = useContext(Theme);
      return h(Theme, { value: 'dark' }, h('b', null, theme));
    }
    const { container } = await mount(h(App));
    assert.equal(container.textContent, 'light');
  }

  // обновление контекста проходит сквозь memo; не-потребители под memo и children не рендерятся
  {
    const Theme = createContext('light');
    const renders = { memoWrapper: 0, consumer: 0, plainMemo: 0, child: 0 };
    function Consumer() { renders.consumer++; return h('i', null, useContext(Theme)); }
    const MemoWrapper = memo(function MemoWrapper() { renders.memoWrapper++; return h(Consumer); });
    const PlainMemo = memo(function PlainMemo() { renders.plainMemo++; return null; });
    function Child() { renders.child++; return null; }
    let toggle;
    function ThemeProvider({ children }) {
      const [theme, setTheme] = useState('light');
      toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
      return h(Theme, { value: theme }, h(MemoWrapper), h(PlainMemo), children);
    }
    const { container } = await mount(h(ThemeProvider, null, h(Child)));
    await React.act(async () => toggle());
    assert.equal(container.querySelector('i').textContent, 'dark');
    assert.deepEqual(renders, { memoWrapper: 1, consumer: 2, plainMemo: 1, child: 1 });
  }

  // объект-литерал в value: каждый рендер провайдера — новые потребители; useMemo лечит
  for (const memoized of [false, true]) {
    const App = createContext(null);
    let consumerRenders = 0, typeKey;
    function UserName() { consumerRenders++; return h('i', null, useContext(App).user); }
    const Stable = memo(function Stable() { return h(UserName); });
    function Root() {
      const [user] = useState('Ann');
      const [theme] = useState('dark');
      const [, setQuery] = useState('');
      typeKey = (q) => setQuery(q);
      const literal = { user, theme };
      const memoValue = useMemo(() => ({ user, theme }), [user, theme]);
      return h(App, { value: memoized ? memoValue : literal }, h('input'), h(Stable));
    }
    await mount(h(Root));
    for (const q of ['a', 'ab', 'abc']) await React.act(async () => typeKey(q));
    assert.equal(consumerRenders, memoized ? 1 : 4);
  }

  // нет частичной подписки: читающий user рендерится при смене theme
  {
    const App = createContext(null);
    let userRenders = 0, setTheme;
    function UserName() { userRenders++; return h('i', null, useContext(App).user); }
    const Stable = memo(function Stable() { return h(UserName); });
    function Root() {
      const [theme, st] = useState('dark');
      setTheme = st;
      const value = useMemo(() => ({ user: 'Ann', theme }), [theme]);
      return h(App, { value }, h(Stable));
    }
    await mount(h(Root));
    await React.act(async () => setTheme('light'));
    assert.equal(userRenders, 2);
  }

  // разделение state и dispatch: компонент только с dispatch не рендерится при смене state
  {
    const State = createContext(0);
    const Dispatch = createContext(null);
    const renders = { counter: 0, button: 0 };
    function Counter() { renders.counter++; return h('b', null, useContext(State)); }
    function AddButton() { renders.button++; const d = useContext(Dispatch); return h('button', { onClick: () => d('add') }, '+'); }
    const Static = memo(function Static() { return h('div', null, h(Counter), h(AddButton)); });
    function Provider() {
      const [count, dispatch] = useReducer((s) => s + 1, 0);
      return h(State, { value: count }, h(Dispatch, { value: dispatch }, h(Static)));
    }
    const { container } = await mount(h(Provider));
    await React.act(async () => container.querySelector('button').click());
    await React.act(async () => container.querySelector('button').click());
    assert.equal(container.querySelector('b').textContent, '2');
    assert.deepEqual(renders, { counter: 3, button: 1 });
  }

  // «селектор вручную»: обёртка читает контекст и передаёт срез в memo-компонент
  {
    const App = createContext(null);
    let heavy = 0, setTheme;
    const HeavyUserCard = memo(function HeavyUserCard({ user }) { heavy++; return h('i', null, user); });
    function UserCard() { const { user } = useContext(App); return h(HeavyUserCard, { user }); }
    const Layout = memo(function Layout() { return h(UserCard); });
    function Root() {
      const [theme, st] = useState('dark');
      setTheme = st;
      const value = useMemo(() => ({ user: 'Ann', theme }), [theme]);
      return h(App, { value }, h(Layout));
    }
    await mount(h(Root));
    await React.act(async () => setTheme('light'));
    await React.act(async () => setTheme('dark'));
    assert.equal(heavy, 1);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
