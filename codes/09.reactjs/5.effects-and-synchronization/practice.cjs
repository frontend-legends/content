// Глава 9.05, раздел «Практика»: гонка в поиске (AbortController + debounce, AbortError не ошибка), переподключение на каждый символ, лишние эффекты в форме.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect } = React;
const { log, createConnection: createConnectionRaw } = require('./_chat.cjs');

(async () => {
  // ---- 1. гонка в поиске: ответ на «re» приходит после ответа на «react»
  const sleep = (ms) => React.act(async () => { await new Promise((r) => setTimeout(r, ms)); });
  for (const fixed of [false, true]) {
    const pending = new Map();
    const calls = [];
    globalThis.fetch = (url, { signal } = {}) => new Promise((resolve, reject) => {
      const q = new URL(url, 'http://x').searchParams.get('q');
      calls.push(q);
      pending.set(q, {
        ok: () => resolve({ json: async () => [`результат для ${q}`] }),
        fail: () => reject(new Error('500')),
      });
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    function SearchResults({ query }) {
      const [results, setResults] = useState([]);
      const [error, setError] = useState(null);
      useEffect(() => {
        if (!fixed) {
          fetch(`/api/search?q=${query}`).then((r) => r.json()).then(setResults);
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
          fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
              setResults(data);
              setError(null);
            })
            .catch((e) => {
              if (e.name !== 'AbortError') setError(e); // отмена — не ошибка
            });
        }, 300);
        return () => {
          clearTimeout(timer);
          controller.abort();
        };
      }, [query]);
      if (error) return h('p', null, 'Ошибка: ' + error.message);
      return h('ul', null, results.map((r) => h('li', { key: r }, r)));
    }
    if (!fixed) {
      const m = await mount(h(SearchResults, { query: 're' }));
      await m.render(h(SearchResults, { query: 'react' }));
      await React.act(async () => pending.get('react').ok());
      await React.act(async () => pending.get('re').ok());
      assert.equal(m.container.textContent, 'результат для re'); // самый медленный ответ победил
      assert.deepEqual(calls, ['re', 'react']);                 // и запрос на каждый символ
      continue;
    }
    // debounce: быстрый набор — один запрос
    const m = await mount(h(SearchResults, { query: 'r' }));
    for (const q of ['re', 'rea', 'reac']) await m.render(h(SearchResults, { query: q }));
    await sleep(350);
    assert.deepEqual(calls, ['reac']);
    // гонка: запрос на «reac» ещё идёт, а пользователь допечатал «react»
    await m.render(h(SearchResults, { query: 'react' }));
    await sleep(350);
    assert.deepEqual(calls, ['reac', 'react']);
    await React.act(async () => pending.get('react').ok());
    await React.act(async () => pending.get('reac').ok()); // уже отменён: промис отклонён с AbortError
    assert.equal(m.container.textContent, 'результат для react'); // и AbortError не показан как ошибка
    // настоящая ошибка попадает в state
    await m.render(h(SearchResults, { query: 'vue' }));
    await sleep(350);
    await React.act(async () => pending.get('vue').fail());
    assert.equal(m.container.textContent, 'Ошибка: 500');
    await React.act(async () => m.root.unmount());
  }

  // throw из catch промиса — unhandled rejection, Error Boundary его не ловит
  {
    const rejections = [];
    const onRejection = (e) => rejections.push(e.message);
    process.on('unhandledRejection', onRejection);
    class Boundary extends React.Component {
      state = { failed: false };
      static getDerivedStateFromError() { return { failed: true }; }
      render() { return this.state.failed ? 'boundary' : this.props.children; }
    }
    function Thrower() {
      useEffect(() => {
        Promise.reject(new Error('500')).catch((e) => { if (e.name !== 'AbortError') throw e; });
      }, []);
      return 'ok';
    }
    const m = await mount(h(Boundary, null, h(Thrower)));
    await sleep(10);
    assert.equal(m.container.textContent, 'ok');
    assert.deepEqual(rejections, ['500']);
    process.off('unhandledRejection', onRejection);
    await React.act(async () => m.root.unmount());
  }

  // ---- 2. переподключение на каждый символ в черновике
  const serverUrl = 'wss://chat.example';
  const createConnection = ({ serverUrl, roomId }) => createConnectionRaw(serverUrl, roomId);
  for (const fixed of [false, true]) {
    let type;
    function ChatRoom({ roomId }) {
      const [draft, setDraft] = useState('');
      type = setDraft;
      const options = { serverUrl, roomId };
      useEffect(() => {
        const connection = createConnection(fixed ? { serverUrl, roomId } : options);
        connection.connect();
        return () => connection.disconnect();
      }, fixed ? [roomId] : [options]);
      return h('input', { value: draft, onChange: () => {} });
    }
    const m = await mount(h(ChatRoom, { roomId: 'general' }));
    log.length = 0;
    for (const t of ['п', 'пр', 'при']) await React.act(async () => type(t));
    const reconnects = log.filter((l) => l.startsWith('connect')).length;
    assert.equal(reconnects, fixed ? 0 : 3);
    await React.act(async () => m.root.unmount());
    log.length = 0;
  }

  // ---- 3. лишние эффекты в форме профиля
  const ann = { id: 1, firstName: 'Ann', lastName: 'Lee' };
  const bob = { id: 2, firstName: 'Bob', lastName: 'Ray' };
  {
    let renders = 0;
    const changes = [];
    let editFirst;
    function Profile({ user, onChange }) {
      renders++;
      const [firstName, setFirstName] = useState(user.firstName);
      const [lastName, setLastName] = useState(user.lastName);
      const [fullName, setFullName] = useState('');
      editFirst = setFirstName;
      useEffect(() => { setFullName(firstName + ' ' + lastName); }, [firstName, lastName]);
      useEffect(() => { setFirstName(user.firstName); setLastName(user.lastName); }, [user.id]);
      useEffect(() => { onChange({ firstName, lastName }); }, [firstName, lastName]);
      return h('h2', null, fullName);
    }
    const m = await mount(h(Profile, { user: ann, onChange: (v) => changes.push(v.firstName) }));
    assert.deepEqual(changes, ['Ann']); // родителя «уведомили» без всякого изменения
    renders = 0;
    await React.act(async () => editFirst('Anna'));
    assert.equal(m.container.textContent, 'Anna Lee');
    assert.equal(renders, 2); // лишний рендер ради fullName
    await m.render(h(Profile, { user: bob, onChange: (v) => changes.push(v.firstName) }));
    assert.equal(m.container.textContent, 'Bob Ray');
    assert.deepEqual(changes, ['Ann', 'Anna', 'Bob']); // смена пользователя выдана за правку
  }
  {
    let renders = 0;
    const changes = [];
    let handleFirstName;
    function Profile({ user, onChange }) {
      renders++;
      const [firstName, setFirstName] = useState(user.firstName);
      const [lastName, setLastName] = useState(user.lastName);
      const fullName = firstName + ' ' + lastName;
      handleFirstName = (value) => {
        setFirstName(value);
        onChange({ firstName: value, lastName });
      };
      return h('h2', null, fullName);
    }
    const onChange = (v) => changes.push(v.firstName);
    const m = await mount(h(Profile, { key: ann.id, user: ann, onChange }));
    assert.equal(m.container.textContent, 'Ann Lee');
    assert.deepEqual(changes, []);
    renders = 0;
    await React.act(async () => handleFirstName('Anna'));
    assert.equal(m.container.textContent, 'Anna Lee');
    assert.equal(renders, 1);
    await m.render(h(Profile, { key: bob.id, user: bob, onChange }));
    assert.equal(m.container.textContent, 'Bob Ray');
    assert.deepEqual(changes, ['Anna']);
  }

  assert.deepEqual(errors, []);
  console.log('practice: ok');
})().catch((e) => { console.log(e); process.exit(1); });
