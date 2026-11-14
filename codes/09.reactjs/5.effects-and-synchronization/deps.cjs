// Глава 9.05, раздел «Зависимости описывают, с чем синхронизируемся»:
// пропущенный serverUrl — соединение со старым сервером; messages в deps — переподключение на каждое сообщение;
// функция setState и объект ref стабильны между рендерами.
// run: node deps.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, useRef } = React;
const { log, live, createConnection } = require('./_chat.cjs');

(async () => {
  // 1. serverUrl пропущен в deps
  for (const honest of [false, true]) {
    function ChatRoom({ roomId, serverUrl }) {
      useEffect(() => {
        const connection = createConnection(serverUrl, roomId);
        connection.connect();
        return () => connection.disconnect();
      }, honest ? [serverUrl, roomId] : [roomId]);
      return null;
    }
    const m = await mount(h(ChatRoom, { roomId: 'general', serverUrl: 'wss://eu.chat' }));
    await m.render(h(ChatRoom, { roomId: 'general', serverUrl: 'wss://us.chat' }));
    assert.deepEqual(log.splice(0), honest
      ? ['connect general @ wss://eu.chat', 'disconnect general @ wss://eu.chat', 'connect general @ wss://us.chat']
      : ['connect general @ wss://eu.chat']); // без serverUrl в deps остались на старом сервере
    await React.act(async () => m.root.unmount());
    log.length = 0;
  }

  // 2. messages в deps: каждое сообщение переподключает чат; апдейтер убирает зависимость
  for (const updater of [false, true]) {
    const setters = new Set();
    function ChatRoom({ roomId }) {
      const [messages, setMessages] = useState([]);
      setters.add(setMessages);
      useEffect(() => {
        const connection = createConnection(null, roomId);
        connection.on('message', (msg) => updater
          ? setMessages((list) => [...list, msg])
          : setMessages([...messages, msg]));
        connection.connect();
        return () => connection.disconnect();
      }, updater ? [roomId] : [roomId, messages]);
      return h('p', null, messages.join(','));
    }
    const m = await mount(h(ChatRoom, { roomId: 'general' }));
    log.length = 0;
    await React.act(async () => live().at(-1).emit('message', 'a'));
    await React.act(async () => live().at(-1).emit('message', 'b'));
    assert.equal(m.container.textContent, 'a,b');
    assert.deepEqual(log.splice(0), updater ? [] : ['disconnect general', 'connect general', 'disconnect general', 'connect general']);
    assert.equal(setters.size, 1); // setMessages — одна и та же функция на всех рендерах
    await React.act(async () => m.root.unmount());
    log.length = 0;
  }

  // 3. ref — один объект на все рендеры, а запись в ref.current эффект не перезапускает
  {
    const refs = new Set();
    let runs = 0;
    let rerender, bump, renders = 0;
    function C() {
      renders++;
      const ref = useRef(0);
      bump = () => { ref.current++; };
      const [, force] = useState(0);
      rerender = () => { ref.current++; force((x) => x + 1); };
      refs.add(ref);
      useEffect(() => { runs++; }, [ref]);
      return null;
    }
    await mount(h(C));
    await React.act(async () => rerender());
    await React.act(async () => rerender());
    assert.equal(refs.size, 1);
    assert.equal(runs, 1); // ref.current менялся, эффект — нет
    const before = renders;
    await React.act(async () => bump());
    assert.equal(renders, before); // запись в ref.current не вызывает рендер
  }

  assert.deepEqual(errors, []);
  console.log('deps: ok');
})().catch((e) => { console.log(e); process.exit(1); });
