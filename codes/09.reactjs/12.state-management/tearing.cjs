// Глава 9.12 — «Tearing»: при прерываемом рендере компоненты, читающие внешний стор напрямую,
// показывают разные версии данных; useSyncExternalStore заставляет React перерендерить синхронно.
// Без act, с настоящим планировщиком.
// run: node tearing.cjs
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.navigator = dom.window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const React = require('react');
const { createRoot } = require('react-dom/client');
const h = React.createElement;

const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end); };
const store = { value: 0, listeners: new Set() };
const subscribe = (l) => { store.listeners.add(l); return () => store.listeners.delete(l); };
const getSnapshot = () => store.value;

async function run(mode) {
  store.value = 0;
  const container = document.createElement('div');
  const root = createRoot(container);
  function Cell() {
    const v = mode === 'uses' ? React.useSyncExternalStore(subscribe, getSnapshot) : store.value; // наивное чтение
    busy(2);
    return h('span', null, v);
  }
  function App({ n }) { return h('div', null, Array.from({ length: n }, (_, i) => h(Cell, { key: i }))); }
  React.startTransition(() => root.render(h(App, { n: 30 })));
  setTimeout(() => { store.value = 1; store.listeners.forEach((l) => l()); }, 10); // стор меняется посреди рендера
  await new Promise((r) => setTimeout(r, 400));
  const values = [...container.querySelectorAll('span')].map((s) => s.textContent);
  root.unmount();
  return [...new Set(values)];
}

(async () => {
  const naive = await run('naive');
  const uses = await run('uses');
  console.log('значения на экране — наивное чтение:', naive.join(','), '| useSyncExternalStore:', uses.join(','));
  assert.deepEqual(naive.sort(), ['0', '1']); // половина экрана с одной версией, половина с другой
  assert.deepEqual(uses, ['1']);
})().catch((e) => { console.log(e); process.exit(1); });
