// Глава 9.05, разделы «Что такое эффект» и «Синхронизация, а не жизненный цикл»:
// ChatRoom держит соединение с комнатой; смена roomId = остановить старую синхронизацию и начать новую;
// классовая версия без componentDidUpdate остаётся в старой комнате.
// run: node sync.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, Component } = React;
const { log, createConnection } = require('./_chat.cjs');

const serverUrl = 'wss://chat.example';

function ChatRoom({ roomId }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('message', (msg) => setMessages((list) => [...list, msg]));
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);
  return h('ul', null, messages.map((m, i) => h('li', { key: i }, m)));
}

class ClassChatRoom extends Component {
  componentDidMount() {
    this.connection = createConnection(serverUrl, this.props.roomId);
    this.connection.connect();
  }
  // componentDidUpdate забыли
  componentWillUnmount() { this.connection.disconnect(); }
  render() { return null; }
}

(async () => {
  // эффект: mount general → travel → unmount
  const m = await mount(h(ChatRoom, { roomId: 'general' }));
  assert.deepEqual(log.splice(0), ['connect general @ wss://chat.example']);
  await m.render(h(ChatRoom, { roomId: 'travel' }));
  assert.deepEqual(log.splice(0), ['disconnect general @ wss://chat.example', 'connect travel @ wss://chat.example']);
  // рендер с тем же roomId — эффект не трогается
  await m.render(h(ChatRoom, { roomId: 'travel' }));
  assert.deepEqual(log.splice(0), []);
  await React.act(async () => m.root.unmount());
  assert.deepEqual(log.splice(0), ['disconnect travel @ wss://chat.example']);

  // класс без componentDidUpdate: при смене комнаты соединение остаётся старым
  const c = await mount(h(ClassChatRoom, { roomId: 'general' }));
  await c.render(h(ClassChatRoom, { roomId: 'travel' }));
  assert.deepEqual(log.splice(0), ['connect general @ wss://chat.example']);
  await React.act(async () => c.root.unmount());
  assert.deepEqual(log.splice(0), ['disconnect general @ wss://chat.example']);

  assert.deepEqual(errors, []);
  console.log('sync: ok');
})().catch((e) => { console.log(e); process.exit(1); });
