// Глава 9.11 — «Сначала измерь»: <Profiler onRender> сообщает phase, actualDuration и baseDuration;
// с memo-ребёнком actualDuration падает, а baseDuration продолжает считать его стоимость.
// run: node profiler.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo, Profiler } = React;

const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end); };

(async () => {
  const log = [];
  let set;
  const Chart = memo(function Chart() { busy(20); return null; });
  function App() { const [n, setN] = useState(0); set = setN; return h('div', null, n, h(Chart)); }
  await mount(h(Profiler, { id: 'App', onRender: (id, phase, actual, base) => log.push({ id, phase, actual, base }) }, h(App)));
  await React.act(async () => set(1));

  assert.deepEqual(log.map((e) => `${e.id}:${e.phase}`), ['App:mount', 'App:update']);
  const [mountE, update] = log;
  assert.ok(mountE.actual >= 20);             // mount: Chart честно отрендерился
  assert.ok(update.actual < 5);               // update: Chart пропущен memo
  assert.ok(update.base >= 20);               // base: «сколько стоило бы без оптимизаций»
  console.log('mount', mountE.actual.toFixed(1), 'update actual', update.actual.toFixed(1), 'base', update.base.toFixed(1));
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
