// Глава 9.10 — «Практика»: порядок эффектов и cleanup родителя и двух детей.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useEffect } = React;

(async () => {
  const log = [];
  function Child({ name }) {
    useEffect(() => { log.push(`effect ${name}`); return () => log.push(`cleanup ${name}`); }, []);
    return null;
  }
  function Parent() {
    useEffect(() => { log.push('effect Parent'); return () => log.push('cleanup Parent'); }, []);
    return h(React.Fragment, null, h(Child, { name: 'A' }), h(Child, { name: 'B' }));
  }
  const { root } = await mount(h(Parent));
  await React.act(async () => root.unmount());
  assert.deepEqual(log, ['effect A', 'effect B', 'effect Parent', 'cleanup Parent', 'cleanup A', 'cleanup B']);
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
