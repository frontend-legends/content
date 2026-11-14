// Глава 9.13 — Suspense для данных: компонент пишет только «счастливый путь», загрузку показывает Suspense,
// ошибку — граница ошибок; два запроса под одним Suspense стартуют последовательно, если читаются в одном компоненте.
// run: node suspense.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { Suspense } = React;
const { QueryClient, QueryClientProvider, useSuspenseQuery } = require('@tanstack/react-query');
const wait = (ms) => React.act(async () => new Promise((r) => setTimeout(r, ms)));

class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? h('b', null, `ошибка: ${this.state.error.message}`) : this.props.children; }
}

(async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function User() {
    const { data } = useSuspenseQuery({ queryKey: ['user'], queryFn: () => new Promise((r) => setTimeout(() => r('Ann'), 20)) });
    return h('i', null, data);
  }
  function Broken() {
    const { data } = useSuspenseQuery({ queryKey: ['broken'], queryFn: () => new Promise((_, rej) => setTimeout(() => rej(new Error('500')), 20)) });
    return h('i', null, data);
  }
  const ui = h(QueryClientProvider, { client },
    h(Boundary, null, h(Suspense, { fallback: h('s', null, 'загрузка') }, h(User))),
    h(Boundary, null, h(Suspense, { fallback: h('s', null, 'загрузка') }, h(Broken))));
  const orig = console.error; console.error = () => {};
  const { container } = await mount(ui);
  assert.equal(container.textContent, 'загрузказагрузка');
  await wait(60);
  console.error = orig;
  assert.equal(container.textContent, 'Annошибка: 500');

  // два useSuspenseQuery в одном компоненте — водопад: второй запрос стартует после первого
  const starts = [];
  const c2 = new QueryClient();
  const q = (k) => () => { starts.push([k, Math.round(performance.now())]); return new Promise((r) => setTimeout(() => r(k), 40)); };
  function Both() {
    const a = useSuspenseQuery({ queryKey: ['a'], queryFn: q('a') }).data;
    const b = useSuspenseQuery({ queryKey: ['b'], queryFn: q('b') }).data;
    return h('i', null, a + b);
  }
  const m = await mount(h(QueryClientProvider, { client: c2 }, h(Suspense, { fallback: 'x' }, h(Both))));
  // act копит работу React до своего конца, поэтому ждём короткими шагами
  for (let i = 0; i < 40 && m.container.textContent !== 'ab'; i++) await wait(10);
  assert.equal(m.container.textContent, 'ab');
  assert.ok(starts[1][1] - starts[0][1] >= 35, 'b стартовал только после a');
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
