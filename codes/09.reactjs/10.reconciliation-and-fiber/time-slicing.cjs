// Глава 9.10 — «Прерываемый рендер»: рендер в transition уступает поток (таймер успевает выполниться
// между компонентами), синхронный рендер — нет. Без act, с настоящим планировщиком.
// run: node time-slicing.cjs
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><div id="root"></div>');
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.navigator = dom.window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const React = require('react');
const { createRoot } = require('react-dom/client');
const { flushSync } = require('react-dom');
const h = React.createElement;

function busy(ms) { const end = performance.now() + ms; while (performance.now() < end); }

async function run(mode) {
  const events = [];
  const root = createRoot(document.createElement('div'));
  function Slow({ i }) { busy(2); events.push(`r${i}`); return null; }
  const tree = h(React.Fragment, null, Array.from({ length: 40 }, (_, i) => h(Slow, { key: i, i })));
  setTimeout(() => events.push('TIMER'), 0);
  if (mode === 'transition') React.startTransition(() => root.render(tree));
  else flushSync(() => root.render(tree));
  await new Promise((r) => setTimeout(r, 300));
  const timerAt = events.indexOf('TIMER');
  root.unmount();
  return { timerAt, total: events.length - 1 };
}

(async () => {
  const sync = await run('sync');
  const tr = await run('transition');
  console.log(`таймер выполнился после ${sync.timerAt} из 40 рендеров (sync) и после ${tr.timerAt} из 40 (transition)`);
  assert.equal(sync.timerAt, 40);       // синхронный рендер не уступает
  assert.ok(tr.timerAt > 0 && tr.timerAt < 40); // transition: работа порезана на кусочки
})().catch((e) => { console.log(e); process.exit(1); });
