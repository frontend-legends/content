// Глава 9.05, раздел «useInsertionEffect: стили раньше всех»:
// insertion-эффекты всех компонентов выполняются раньше любого layout-эффекта; refs ещё не привязаны:
// при монтировании ref.current = null, при обновлении — узел с прошлого commit;
// setState внутри — предупреждение «useInsertionEffect must not schedule updates.»
// run: node insertion.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useRef, useInsertionEffect, useLayoutEffect, useEffect } = React;

(async () => {
  const log = [];
  function Box({ id }) {
    const ref = useRef(null);
    useInsertionEffect(() => { log.push(`insertion ${id}, ref=${ref.current}`); });
    useLayoutEffect(() => { log.push(`layout ${id}, ref=${ref.current.tagName}`); });
    useEffect(() => { log.push(`effect ${id}`); });
    return h('div', { ref });
  }
  const m = await mount(h('section', null, h(Box, { id: 'a' }), h(Box, { id: 'b' })));
  assert.deepEqual(log, [
    'insertion a, ref=null',
    'insertion b, ref=null',
    'layout a, ref=DIV',
    'layout b, ref=DIV',
    'effect a',
    'effect b',
  ]);
  // обновление: в ref уже узел с прошлого commit
  log.length = 0;
  await m.render(h('section', null, h(Box, { id: 'a' })));
  assert.deepEqual(log.slice(0, 1), ['insertion a, ref=[object HTMLDivElement]']);

  errors.length = 0;
  function Bad() {
    const [n, setN] = useState(0);
    useInsertionEffect(() => { if (n === 0) setN(1); });
    return null;
  }
  await mount(h(Bad));
  assert.deepEqual(errors, ['useInsertionEffect must not schedule updates.']);
  console.log('insertion: ok');
})().catch((e) => { console.log(e); process.exit(1); });
