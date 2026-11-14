// Глава 9.10 — «Фазы commit»: порядок рендеров и эффектов родителя и детей при монтировании,
// обновлении и размонтировании.
// run: node effects-order.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useEffect, useLayoutEffect } = React;

(async () => {
  const log = [];
  function make(name, kids = []) {
    return function C({ v }) {
      log.push(`render ${name}`);
      useLayoutEffect(() => { log.push(`layout ${name}`); return () => log.push(`layout cleanup ${name}`); }, [v]);
      useEffect(() => { log.push(`effect ${name}`); return () => log.push(`effect cleanup ${name}`); }, [v]);
      return h('div', null, kids.map((K, i) => h(K, { key: i, v })));
    };
  }
  const A = make('A'); const B = make('B');
  const Parent = make('P', [A, B]);
  const m = await mount(h(Parent, { v: 1 }));
  assert.deepEqual(log, ['render P', 'render A', 'render B', 'layout A', 'layout B', 'layout P', 'effect A', 'effect B', 'effect P']);
  log.length = 0;
  await m.render(h(Parent, { v: 2 }));
  assert.deepEqual(log, ['render P', 'render A', 'render B',
    'layout cleanup A', 'layout cleanup B', 'layout cleanup P', 'layout A', 'layout B', 'layout P',
    'effect cleanup A', 'effect cleanup B', 'effect cleanup P', 'effect A', 'effect B', 'effect P']);
  log.length = 0;
  await React.act(async () => m.root.unmount());
  console.log('unmount:', log.join(' | '));
  assert.deepEqual(log, ['layout cleanup P', 'layout cleanup A', 'layout cleanup B', 'effect cleanup P', 'effect cleanup A', 'effect cleanup B']);
})().catch((e) => { console.log(e); process.exit(1); });
