// Глава 9.05, раздел «Cleanup: что он обязан убрать»:
// cleanup видит значения своего рендера; removeEventListener с другой функцией не снимает обработчик;
// async-функция в useEffect — предупреждение; StrictMode и Activity прогоняют cleanup;
// setState после размонтирования — без предупреждений.
// run: node cleanup.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, useLayoutEffect, StrictMode, Activity } = React;
const { log, createConnection } = require('./_chat.cjs');

const resize = () => window.dispatchEvent(new window.Event('resize'));

(async () => {
  // утечка обработчика: снимаем не ту функцию
  for (const fixed of [false, true]) {
    const calls = [];
    function Width({ unit }) {
      useEffect(() => {
        if (fixed) {
          const onResize = () => calls.push(unit);
          window.addEventListener('resize', onResize);
          return () => window.removeEventListener('resize', onResize);
        }
        window.addEventListener('resize', () => calls.push(unit));
        return () => window.removeEventListener('resize', () => calls.push(unit)); // другая функция
      }, [unit]);
      return null;
    }
    const m = await mount(h(Width, { unit: 'px' }));
    await m.render(h(Width, { unit: 'rem' }));
    resize();
    assert.deepEqual(calls, fixed ? ['rem'] : ['px', 'rem']); // старый обработчик продолжает работать
    await React.act(async () => m.root.unmount());
    calls.length = 0;
    resize();
    assert.deepEqual(calls, fixed ? [] : ['px', 'rem']); // и переживает размонтирование
  }
  window.dispatchEvent = () => {}; // глушим утёкшие обработчики

  // async-функция вместо эффекта
  errors.length = 0;
  function Bad() { useEffect(async () => {}, []); return null; }
  await mount(h(Bad));
  assert.match(errors[0], /^%s must not return anything besides a function[^]* useEffect /);
  assert.match(errors[0], /must not return anything besides a function, which is used for clean-up/);
  assert.match(errors[0], /It looks like you wrote useEffect\(async \(\) => \.\.\.\) or returned a Promise/);
  errors.length = 0;

  function ChatRoom({ roomId }) {
    const [count] = useState(() => 'state ' + roomId);
    useEffect(() => {
      const connection = createConnection(null, roomId);
      connection.connect();
      return () => connection.disconnect();
    }, [roomId]);
    return h('b', null, count);
  }

  // StrictMode в dev: setup → cleanup → setup на монтировании
  log.length = 0;
  const s = await mount(h(StrictMode, null, h(ChatRoom, { roomId: 'general' })));
  assert.deepEqual(log.splice(0), ['connect general', 'disconnect general', 'connect general']);
  await s.render(h(StrictMode, null, h(ChatRoom, { roomId: 'travel' })));
  assert.deepEqual(log.splice(0), ['disconnect general', 'connect travel']); // на обновлении повтора нет
  await React.act(async () => s.root.unmount());
  log.length = 0;

  // Activity: hidden — cleanup (и у layout-эффектов), state и DOM сохраняются; visible — setup снова
  function Measured() { useLayoutEffect(() => { log.push('layout setup'); return () => log.push('layout cleanup'); }, []); return null; }
  const a = await mount(h(Activity, { mode: 'visible' }, h(ChatRoom, { roomId: 'general' })));
  assert.deepEqual(log.splice(0), ['connect general']);
  await a.render(h(Activity, { mode: 'hidden' }, h(ChatRoom, { roomId: 'general' })));
  assert.deepEqual(log.splice(0), ['disconnect general']);
  const b = await mount(h(Activity, { mode: 'visible' }, h(Measured)));
  await b.render(h(Activity, { mode: 'hidden' }, h(Measured)));
  assert.deepEqual(log.splice(0), ['layout setup', 'layout cleanup']);
  assert.equal(a.container.innerHTML, '<b style="display: none;">state general</b>');
  await a.render(h(Activity, { mode: 'visible' }, h(ChatRoom, { roomId: 'general' })));
  assert.deepEqual(log.splice(0), ['connect general']);
  assert.equal(a.container.textContent, 'state general');

  // setState после размонтирования: предупреждения нет
  let setLater;
  function Late() { const [v, set] = useState(0); setLater = set; return h('i', null, v); }
  const l = await mount(h(Late));
  await React.act(async () => l.root.unmount());
  await React.act(async () => setLater(1));
  assert.deepEqual(errors, []);
  console.log('cleanup: ok');
})().catch((e) => { console.log(e); process.exit(1); });
