// Глава 9.04 — «Каждый рендер — снимок» и «Чистота»: stale closure, useEffectEvent, двойные вызовы StrictMode.
// run: node snapshot.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('./_env.cjs');
const { useState, useEffect, useMemo, useEffectEvent, StrictMode } = React;

(async () => {
  // stale closure: эффект с [] замкнул первый рендер, count + 1 всегда 1
  {
    let tick;
    function Timer() {
      const [count, setCount] = useState(0);
      useEffect(() => { tick = () => setCount(count + 1); }, []);
      return h('b', null, count);
    }
    const { container } = await mount(h(Timer));
    for (let i = 0; i < 3; i++) await React.act(async () => tick());
    assert.equal(container.textContent, '1');
  }
  // апдейтер не зависит от замыкания
  {
    let tick;
    function Timer() {
      const [count, setCount] = useState(0);
      useEffect(() => { tick = () => setCount((c) => c + 1); }, []);
      return h('b', null, count);
    }
    const { container } = await mount(h(Timer));
    for (let i = 0; i < 3; i++) await React.act(async () => tick());
    assert.equal(container.textContent, '3');
  }
  // useEffectEvent: свежая theme без переподключения; вызов в рендере — ошибка
  {
    const log = [];
    let fire;
    function ChatRoom({ roomId, theme }) {
      const onConnected = useEffectEvent(() => log.push(`event ${roomId} ${theme}`));
      useEffect(() => {
        log.push(`connect ${roomId}`);
        fire = () => onConnected();
        return () => log.push(`disconnect ${roomId}`);
      }, [roomId]);
      return null;
    }
    const m = await mount(h(ChatRoom, { roomId: 'a', theme: 'light' }));
    await m.render(h(ChatRoom, { roomId: 'a', theme: 'dark' }));
    await React.act(async () => fire());
    assert.deepEqual(log, ['connect a', 'event a dark']);

    // возвращённая функция новая на каждом рендере — в deps её не кладут
    const fns = new Set();
    let bump;
    function Ids() { const [n, setN] = useState(0); bump = setN; fns.add(useEffectEvent(() => n)); return null; }
    await mount(h(Ids));
    await React.act(async () => bump(1));
    assert.equal(fns.size, 2);

    function K() { const ev = useEffectEvent(() => 1); ev(); return null; }
    let thrown;
    try { await mount(h(K)); } catch (e) { thrown = e.message; }
    assert.equal(thrown, "A function wrapped in useEffectEvent can't be called during rendering.");
  }
  // StrictMode (dev): тело, инициализатор и useMemo — по два раза; эффект: setup → cleanup → setup
  {
    const log = [];
    let body = 0, init = 0, memo = 0;
    function L() {
      body++;
      useState(() => { init++; return 0; });
      useMemo(() => { memo++; return 1; }, []);
      useEffect(() => { log.push('setup'); return () => log.push('cleanup'); }, []);
      return null;
    }
    await mount(h(StrictMode, null, h(L)));
    assert.deepEqual([body, init, memo], [2, 2, 2]);
    assert.deepEqual(log, ['setup', 'cleanup', 'setup']);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
