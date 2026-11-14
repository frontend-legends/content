// Глава 9.05, раздел «Гонки запросов»:
// ответ старой комнаты, пришедший позже, перетирает новую; флаг ignore и AbortController это чинят;
// fetch с отменённым signal отклоняется с AbortError; на сервере эффект не выполняется.
// run: node races.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect } = React;
const { renderToString } = require('react-dom/server');
const { controlledServer } = require('./_chat.cjs');

const variants = {
  naive: (fetchHistory, setMessages, roomId) => {
    fetchHistory(roomId).then(setMessages);
  },
  ignore: (fetchHistory, setMessages, roomId) => {
    let ignore = false;
    fetchHistory(roomId).then((data) => {
      if (!ignore) setMessages(data);
    });
    return () => { ignore = true; };
  },
  abort: (fetchHistory, setMessages, roomId, aborted) => {
    const controller = new AbortController();
    fetchHistory(roomId, { signal: controller.signal })
      .then(setMessages)
      .catch((e) => {
        if (e.name !== 'AbortError') throw e;
        aborted.push(roomId);
      });
    return () => controller.abort();
  },
};

(async () => {
  for (const [name, body] of Object.entries(variants)) {
    const server = controlledServer();
    const aborted = [];
    function History({ roomId }) {
      const [messages, setMessages] = useState([]);
      useEffect(() => body(server.fetchHistory, setMessages, roomId, aborted), [roomId]);
      return h('p', null, messages.join(','));
    }
    const m = await mount(h(History, { roomId: 'general' }));
    await m.render(h(History, { roomId: 'travel' })); // быстро переключились
    await React.act(async () => server.respond('travel'));  // travel ответил первым
    await React.act(async () => server.respond('general')); // general — позже
    const screen = m.container.textContent;
    if (name === 'naive') assert.equal(screen, 'general: привет'); // под комнатой travel — история general
    else assert.equal(screen, 'travel: привет');
    if (name === 'abort') assert.deepEqual(aborted, ['general']);
  }

  // настоящий fetch: отменённый signal → AbortError
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetch('data:,hello', { signal: controller.signal }), { name: 'AbortError' });

  // на сервере эффекты не выполняются: HTML уходит без данных
  let ran = false;
  function ServerHistory() {
    const [messages, setMessages] = useState([]);
    useEffect(() => { ran = true; setMessages(['x']); }, []);
    return h('p', null, messages.length ? messages.join(',') : 'Загрузка…');
  }
  assert.equal(renderToString(h(ServerHistory)), '<p>Загрузка…</p>');
  assert.equal(ran, false);

  assert.deepEqual(errors, []);
  console.log('races: ok');
})().catch((e) => { console.log(e); process.exit(1); });
