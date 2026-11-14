// Глава 9.04 — «Приоритеты: очередь переигрывается»: transition + срочный апдейт, на экране 1 → 10 → 20.
// run: node rebase.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('./_env.cjs');
const { flushSync } = require('react-dom');

(async () => {
  let set, timesTimes10 = 0;
  const seen = [];
  function C() { const [x, setX] = React.useState(1); set = setX; seen.push(x); return h('b', null, x); }
  const { container } = await mount(h(C));
  await React.act(async () => {
    React.startTransition(() => set((v) => v + 1)); // низкий приоритет
    flushSync(() => set((v) => { timesTimes10++; return v * 10; })); // срочный
  });
  console.log('на экране:', seen.join(' → '), '| апдейтер v * 10 вызван раз:', timesTimes10);
  assert.deepEqual(seen, [1, 10, 20]);
  assert.equal(container.textContent, '20');
  assert.equal(timesTimes10, 2);
})().catch((e) => { console.log(e); process.exit(1); });
