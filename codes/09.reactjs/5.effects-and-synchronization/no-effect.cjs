// Глава 9.05, раздел «Когда эффект не нужен»:
// производное значение через эффект — лишний рендер и commit со старым числом; увидит ли его пользователь,
// зависит от причины апдейта: сеть или таймер — граница задачи между двумя commit, клик — оба commit в одной задаче;
// логика события в эффекте срабатывает не от той причины; сброс состояния — key, а не эффект.
// run: node no-effect.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, useLayoutEffect } = React;
const { live, createConnection } = require('./_chat.cjs');

(async () => {
  // 1. unread через эффект против вычисления в рендере
  for (const viaEffect of [true, false]) {
    let renders = 0;
    const committed = [];
    function Unread({ messages }) {
      renders++;
      let unread;
      if (viaEffect) {
        const [u, setUnread] = useState(0);
        useEffect(() => { setUnread(messages.filter((m) => !m.read).length); }, [messages]);
        unread = u;
      } else {
        unread = messages.filter((m) => !m.read).length;
      }
      useLayoutEffect(() => { committed.push(unread); }); // что попало в DOM на каждом commit
      return h('b', null, unread);
    }
    const m = await mount(h(Unread, { messages: [] }));
    renders = 0; committed.length = 0;
    await m.render(h(Unread, { messages: [{ read: false }, { read: false }] }));
    assert.equal(m.container.textContent, '2');
    assert.equal(renders, viaEffect ? 2 : 1);
    assert.deepEqual(committed, viaEffect ? [0, 2] : [2]); // через эффект сначала закоммичен старый 0
  }

  // 2. тост в эффекте срабатывает на чужое сообщение; в обработчике — только на отправку
  for (const viaEffect of [true, false]) {
    const toasts = [];
    const showToast = (t) => toasts.push(t);
    let handleSend;
    function Chat({ roomId }) {
      const [messages, setMessages] = useState([]);
      useEffect(() => {
        const connection = createConnection(null, roomId);
        connection.on('message', (msg) => setMessages((list) => [...list, msg]));
        connection.connect();
        return () => connection.disconnect();
      }, [roomId]);
      if (viaEffect) {
        useEffect(() => {
          if (messages.length > 0) showToast('Сообщение отправлено');
        }, [messages.length]);
      }
      handleSend = (text) => {
        setMessages((list) => [...list, text]);
        if (!viaEffect) showToast('Сообщение отправлено');
      };
      return null;
    }
    await mount(h(Chat, { roomId: 'general' }));
    await React.act(async () => handleSend('я'));
    await React.act(async () => live().at(-1).emit('message', 'собеседник'));
    assert.deepEqual(toasts, viaEffect ? ['Сообщение отправлено', 'Сообщение отправлено'] : ['Сообщение отправлено']);
    for (const c of live()) c.disconnect();
  }

  // 3. сброс сообщений при смене комнаты: без key старые остаются; эффект-сброс даёт commit со старыми,
  //    и эффекты новой комнаты (здесь markRead) выполняются с сообщениями general; key — сразу пусто
  for (const mode of ['none', 'effect', 'key']) {
    const committed = [];
    const marked = [];
    function ChatRoom({ roomId }) {
      const [messages, setMessages] = useState([]);
      if (mode === 'effect') useEffect(() => { setMessages([]); }, [roomId]);
      useEffect(() => { marked.push(roomId + ':' + messages.join(',')); }, [roomId]); // «отметить прочитанным»
      useEffect(() => {
        const connection = createConnection(null, roomId);
        connection.on('message', (msg) => setMessages((list) => [...list, msg]));
        connection.connect();
        return () => connection.disconnect();
      }, [roomId]);
      useLayoutEffect(() => { committed.push(roomId + ':' + messages.join(',')); });
      return h('p', null, messages.join(','));
    }
    const el = (roomId) => (mode === 'key' ? h(ChatRoom, { key: roomId, roomId }) : h(ChatRoom, { roomId }));
    const m = await mount(el('general'));
    await React.act(async () => live().at(-1).emit('message', 'hi'));
    committed.length = 0;
    await m.render(el('travel'));
    if (mode === 'none') assert.deepEqual(committed, ['travel:hi']);         // сообщения general под travel
    if (mode === 'effect') assert.deepEqual(committed, ['travel:hi', 'travel:']); // сначала commit со старыми
    if (mode === 'effect') assert.deepEqual(marked.at(-1), 'travel:hi');           // эффект новой комнаты увидел чужие сообщения
    if (mode === 'key') assert.deepEqual(marked.at(-1), 'travel:');
    if (mode === 'key') assert.deepEqual(committed, ['travel:']);
    await React.act(async () => m.root.unmount());
  }

  // 4. без act — настоящее расписание React. Маркер «task» ставится в каждом commit через setImmediate:
  //    если между двумя commit есть «task», браузер мог отрисовать первый.
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const { createRoot } = require('react-dom/client');
  const settle = () => new Promise((r) => setTimeout(r, 30));
  // unread: сообщения пришли из сети (таймер) против клика
  for (const trigger of ['network', 'click']) {
    const log = [];
    let receive;
    function Unread() {
      const [messages, setMessages] = useState([]);
      const [unread, setUnread] = useState(0);
      receive = () => setMessages([{ read: false }, { read: false }]);
      useEffect(() => { setUnread(messages.filter((m) => !m.read).length); }, [messages]);
      useLayoutEffect(() => {
        if (messages.length) { log.push('commit unread=' + unread); setImmediate(() => log.push('task')); }
      });
      return h('button', { onClick: receive }, unread);
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(Unread));
    await settle();
    if (trigger === 'network') setTimeout(receive);
    else c.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.deepEqual(log, trigger === 'network'
      ? ['commit unread=0', 'task', 'commit unread=2', 'task']  // между commit граница задачи: 0 может мигнуть
      : ['commit unread=0', 'commit unread=2', 'task', 'task']); // клик: оба commit в одной задаче, кадра с 0 нет
  }
  // сброс комнаты эффектом по клику: кадра со старыми сообщениями нет, но эффект новой комнаты их увидел
  {
    const log = [];
    let receive;
    function ChatRoom({ roomId }) {
      const [messages, setMessages] = useState([]);
      receive = (msg) => setMessages((list) => [...list, msg]);
      useEffect(() => { setMessages([]); }, [roomId]);
      useEffect(() => { log.push('markRead ' + roomId + ':' + messages.join(',')); }, [roomId]);
      useLayoutEffect(() => { log.push('commit ' + roomId + ':' + messages.join(',')); setImmediate(() => log.push('task')); });
      return null;
    }
    function App() {
      const [roomId, setRoomId] = useState('general');
      return h('div', null, h('button', { onClick: () => setRoomId('travel') }), h(ChatRoom, { roomId }));
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(App));
    await settle();
    setTimeout(() => receive('hi')); // сообщение из сети
    await settle();
    log.length = 0;
    c.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.deepEqual(log, ['commit travel:hi', 'markRead travel:hi', 'commit travel:', 'task', 'task']);
  }

  assert.deepEqual(errors, []);
  console.log('no-effect: ok');
})().catch((e) => { console.log(e); process.exit(1); });
