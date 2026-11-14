// Глава 9.09 — «Практика»: три задачи и их решения.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useEffect, useCallback, useMemo, useSyncExternalStore } = React;
const tick = (fn) => React.act(async () => fn());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const data = new Map();
globalThis.localStorage = { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };

(async () => {
  // 1. Задача добавляется дважды: мутация в редьюсере + StrictMode
  {
    function buggy(state, action) {
      switch (action.type) {
        case 'added':
          state.tasks.push(action.task);
          return { ...state };
        default:
          return state;
      }
    }
    function fixed(state, action) {
      switch (action.type) {
        case 'added':
          return { ...state, tasks: [...state.tasks, action.task] };
        default:
          return state;
      }
    }
    for (const [reducer, want] of [[buggy, ['a', 'a']], [fixed, ['a']]]) {
      let dispatch, tasks;
      function Board() { const [s, d] = React.useReducer(reducer, { tasks: [] }); dispatch = d; tasks = s.tasks; return null; }
      await mount(h(React.StrictMode, null, h(Board)));
      assert.deepEqual(tasks, []);
      await tick(() => dispatch({ type: 'added', task: 'a' }));
      assert.deepEqual(tasks, want);
    }
  }

  // 2. useLocalStorage падает: JSON.parse в getSnapshot; subscribe в рендере
  {
    function useBad(key, initialValue) {
      return useSyncExternalStore(
        (onChange) => { window.addEventListener('storage', onChange); return () => window.removeEventListener('storage', onChange); },
        () => JSON.parse(localStorage.getItem(key)) ?? initialValue,
      );
    }
    const DEFAULTS = { sort: 'created', hideDone: false };
    // пока хранилище пустое, снимок — initialValue (одна ссылка в пределах рендера): не падает
    let shown;
    function Empty() { shown = useBad('board-settings', DEFAULTS); return null; }
    await mount(h(Empty));
    assert.equal(shown, DEFAULTS);
    // примитив из JSON равен сам себе — тоже не падает
    data.set('theme', '"dark"');
    function Prim() { shown = useBad('theme', 'light'); return null; }
    await mount(h(Prim));
    assert.equal(shown, 'dark');

    // настройки уже сохранены (объект) — падает при первом рендере
    data.set('board-settings', '{"sort":"title","hideDone":true}');
    function Bad() { useBad('board-settings', DEFAULTS); return null; }
    errors.length = 0;
    await assert.rejects(mount(h(Bad)), /Maximum update depth exceeded/);
    assert.ok(errors.some((e) => e.includes('The result of getSnapshot should be cached to avoid an infinite loop')));

    let subs = 0;
    function subscribe(onChange) {
      subs++;
      window.addEventListener('storage', onChange);
      return () => window.removeEventListener('storage', onChange);
    }
    function useLocalStorage(key, initialValue) {
      const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
      return useMemo(() => (raw === null ? initialValue : JSON.parse(raw)), [raw, initialValue]);
    }
    const values = [];
    let bump;
    function Good() { const [, s] = useState(0); bump = s; values.push(useLocalStorage('board-settings', DEFAULTS)); return null; }
    await mount(h(Good));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.deepEqual(values[0], { sort: 'title', hideDone: true });
    assert.ok(values.every((v) => v === values[0]), 'тот же объект между рендерами');
    assert.equal(subs, 1, 'одна подписка');
  }

  // 3. Бесконечные запросы: хук возвращает новый объект на каждом рендере
  {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return { json: async () => [{ id: calls }] }; };
    const TaskList = () => null;

    function useApiBad(baseUrl) {
      const get = (path) => fetch(baseUrl + path).then((r) => r.json());
      return { get };
    }
    function TasksBad() {
      const api = useApiBad('/api');
      const [tasks, setTasks] = useState([]);
      useEffect(() => {
        if (calls >= 10) return; // предохранитель проверки: в браузере цикл не останавливается
        api.get('/tasks').then(setTasks);
      }, [api]);
      return h(TaskList, { tasks });
    }
    const bad = await mount(h(TasksBad));
    await React.act(() => sleep(50));
    assert.equal(calls, 10);
    await React.act(async () => bad.root.unmount());

    calls = 0;
    function useApi(baseUrl) {
      const get = useCallback((path) => fetch(baseUrl + path).then((r) => r.json()), [baseUrl]);
      return useMemo(() => ({ get }), [get]);
    }
    let seenUrl = [];
    globalThis.fetch = async (url) => { calls++; seenUrl.push(url); return { json: async () => [{ id: calls }] }; };
    function Tasks({ baseUrl = '/api' }) {
      const { get } = useApi(baseUrl);
      const [tasks, setTasks] = useState([]);
      useEffect(() => {
        get('/tasks').then(setTasks);
      }, [get]);
      return h(TaskList, { tasks });
    }
    const good = await mount(h(Tasks));
    await React.act(() => sleep(50));
    assert.equal(calls, 1);
    await good.render(h(Tasks, { baseUrl: '/v2' }));
    await React.act(() => sleep(20));
    assert.deepEqual(seenUrl, ['/api/tasks', '/v2/tasks']);
  }

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
