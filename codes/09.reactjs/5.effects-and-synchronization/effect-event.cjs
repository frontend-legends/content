// Глава 9.05, раздел «useEffectEvent: прочитать, но не реагировать»:
// soundEnabled в deps переподключает чат; useEffectEvent читает свежее значение без переподключения;
// спрятанный в Effect Event roomId — эффект не переподключается при смене комнаты (баг);
// функция новая на каждом рендере; вызов в рендере — ошибка;
// Effect Event видит последний закоммиченный рендер (переход, ждущий данных, не попадает), а ref, записанный в рендере, — попадает;
// ячейка обновляется до всех layout-эффектов, а useLatest на useLayoutEffect отдаёт ребёнку прошлую версию.
// run: node effect-event.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, useEffectEvent } = React;
const { log, live, createConnection } = require('./_chat.cjs');

(async () => {
  for (const withEvent of [false, true]) {
    const sounds = [];
    const playSound = () => sounds.push('ding');
    const fns = new Set();
    let renders = 0;
    function ChatRoom({ roomId, soundEnabled }) {
      const [messages, setMessages] = useState([]);
      renders++;
      if (withEvent) {
        const onMessage = useEffectEvent((msg) => {
          setMessages((list) => [...list, msg]);
          if (soundEnabled) playSound();
        });
        fns.add(onMessage);
        useEffect(() => {
          const connection = createConnection(null, roomId);
          connection.on('message', (msg) => onMessage(msg));
          connection.connect();
          return () => connection.disconnect();
        }, [roomId]);
      } else {
        useEffect(() => {
          const connection = createConnection(null, roomId);
          connection.on('message', (msg) => {
            setMessages((list) => [...list, msg]);
            if (soundEnabled) playSound();
          });
          connection.connect();
          return () => connection.disconnect();
        }, [roomId, soundEnabled]);
      }
      return h('p', null, messages.join(','));
    }
    const m = await mount(h(ChatRoom, { roomId: 'general', soundEnabled: true }));
    await React.act(async () => live().at(-1).emit('message', 'a'));
    log.length = 0;
    await m.render(h(ChatRoom, { roomId: 'general', soundEnabled: false })); // выключили звук
    assert.deepEqual(log.splice(0), withEvent ? [] : ['disconnect general', 'connect general']);
    await React.act(async () => live().at(-1).emit('message', 'b'));
    assert.deepEqual(sounds, ['ding']); // свежее значение: после выключения звука нет
    assert.equal(m.container.textContent, 'a,b');
    if (withEvent) assert.equal(fns.size, renders); // на каждом рендере — новая функция: в deps её не кладут
    await React.act(async () => m.root.unmount());
    log.length = 0;
  }

  // ошибка: roomId спрятан в Effect Event, deps пустые — смена комнаты не переподключает
  {
    function ChatRoom({ roomId }) {
      const onMount = useEffectEvent(() => {
        const connection = createConnection(null, roomId);
        connection.connect();
        return () => connection.disconnect();
      });
      useEffect(() => onMount(), []);
      return null;
    }
    const m = await mount(h(ChatRoom, { roomId: 'general' }));
    await m.render(h(ChatRoom, { roomId: 'travel' }));
    assert.deepEqual(log.splice(0), ['connect general']); // остались в general
    await React.act(async () => m.root.unmount());
    log.length = 0;
  }

  // вызов в рендере
  function Bad() { const f = useEffectEvent(() => {}); f(); return null; }
  let thrown;
  try { await mount(h(Bad)); } catch (e) { thrown = e.message; }
  assert.equal(thrown, "A function wrapped in useEffectEvent can't be called during rendering.");
  assert.deepEqual(errors, []);

  // без act: переход, который ждёт данных и не коммитится
  const settle = () => new Promise((r) => setTimeout(r, 30));
  await settle(); // дать доработать тому, что запланировано под act
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const { useRef, useLayoutEffect, startTransition, Suspense, use } = React;
  const { createRoot } = require('react-dom/client');
  {
    const seen = [];
    let setV, fire;
    const never = new Promise(() => {});
    function Data({ v }) { if (v === 2) use(never); return h('p', null, v); }
    function Panel() {
      const [v, set] = useState(1);
      setV = set;
      const onTick = useEffectEvent(() => seen.push('effect event: v=' + v));
      const latest = useRef(null);
      latest.current = () => seen.push('ref из рендера: v=' + v); // запись в рендере — так делать нельзя
      useEffect(() => { fire = () => { onTick(); latest.current(); }; }, []);
      return h(Suspense, { fallback: '...' }, h(Data, { v }));
    }
    const c = document.createElement('div');
    createRoot(c).render(h(Panel));
    await settle();
    startTransition(() => setV(2)); // рендер с v=2 прошёл, но не закоммичен: ждёт данных
    await settle();
    assert.equal(c.textContent, '1');
    fire();
    assert.deepEqual(seen, ['effect event: v=1', 'ref из рендера: v=2']);
  }
  // useLatest на useLayoutEffect против useEffectEvent
  {
    const seen = [];
    let setV;
    function useLatest(fn) {
      const ref = useRef(fn);
      useLayoutEffect(() => { ref.current = fn; });
      return useRef((...args) => ref.current(...args)).current;
    }
    function Child({ onReady, v }) {
      useLayoutEffect(() => { onReady(); }, [v]); // layout-эффект ребёнка — раньше родительского
      return null;
    }
    function Parent() {
      const [v, set] = useState(1);
      setV = set;
      const onReady = useLatest(() => seen.push('useLatest: v=' + v));
      const onEvent = useEffectEvent(() => seen.push('effect event: v=' + v));
      useLayoutEffect(() => { onEvent(); }, [v]);
      return h(Child, { onReady, v });
    }
    const c = document.createElement('div');
    createRoot(c).render(h(Parent));
    await settle();
    seen.length = 0;
    setV(2);
    await settle();
    assert.deepEqual(seen, ['useLatest: v=1', 'effect event: v=2']); // ребёнок получил прошлую версию
  }

  assert.deepEqual(errors, []);
  console.log('effect-event: ok');
})().catch((e) => { console.log(e); process.exit(1); });
