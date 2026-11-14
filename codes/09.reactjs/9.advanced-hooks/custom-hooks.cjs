// Глава 9.09 — «Кастомные хуки»: useTasks, стабильные функции, useDebouncedValue, useMediaQuery и useLocalStorage на useSyncExternalStore.
// run: node custom-hooks.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { renderToString } = require('react-dom/server');
const { hydrateRoot } = require('react-dom/client');
const { useState, useReducer, useCallback, useMemo, useEffect, useSyncExternalStore, useDeferredValue, useId } = React;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = (fn) => React.act(async () => fn());

// --- окружение: управляемый matchMedia и localStorage в памяти (в jsdom их нет) ---
let width = 1024;
const mqls = new Set();
window.matchMedia = (query) => {
  const max = Number(query.match(/max-width: (\d+)px/)[1]);
  const listeners = new Set();
  const mql = {
    get matches() { return width <= max; },
    addEventListener: (_, l) => { listeners.add(l); mqls.add(mql); },
    removeEventListener: (_, l) => listeners.delete(l),
    listeners,
  };
  return mql;
};
const resize = (w) => { width = w; for (const m of mqls) m.listeners.forEach((l) => l()); };
const data = new Map();
globalThis.localStorage = {
  getItem: (k) => (data.has(k) ? data.get(k) : null),
  setItem: (k, v) => data.set(k, String(v)),
};

// --- код из текста ---
const initialState = { tasks: [], status: 'idle', error: null };
function tasksReducer(state, action) {
  switch (action.type) {
    case 'load': return { ...state, status: 'loading', error: null };
    case 'loaded': return { tasks: action.tasks, status: 'idle', error: null };
    case 'failed': return { ...state, status: 'error', error: action.error };
    default: throw new Error(`Unknown action: ${action.type}`);
  }
}
let fetchTasks = async () => [{ id: 1 }];
function useTasks() {
  const [state, dispatch] = useReducer(tasksReducer, initialState);
  const load = useCallback(async () => {
    dispatch({ type: 'load' });
    try {
      dispatch({ type: 'loaded', tasks: await fetchTasks() });
    } catch (error) {
      dispatch({ type: 'failed', error });
    }
  }, []);
  return { ...state, load, dispatch };
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

const listeners = new Set();
function subscribe(onChange) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
function useLocalStorage(key, initialValue) {
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key), () => null);
  const value = useMemo(() => (raw === null ? initialValue : JSON.parse(raw)), [raw, initialValue]);
  const setValue = useCallback(
    (next) => {
      localStorage.setItem(key, JSON.stringify(next));
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, setValue];
}

(async () => {
  // useTasks: два компонента — независимые данные; load и dispatch стабильны между рендерами
  {
    const seen = { a: [], b: [] };
    let hookA;
    function Board({ name }) { const t = useTasks(); if (name === 'a') hookA = t; seen[name].push(t); return h('i', null, `${name}:${t.status}:${t.tasks.length}`); }
    const m = await mount(h('div', null, h(Board, { name: 'a' }), h(Board, { name: 'b' })));
    await tick(() => hookA.load());
    assert.equal(m.container.textContent, 'a:idle:1b:idle:0');
    assert.ok(seen.a.every((t) => t.load === seen.a[0].load && t.dispatch === seen.a[0].dispatch));
    assert.notEqual(seen.a.at(-1), seen.a[0], 'сам объект — новый на каждом рендере');

    fetchTasks = async () => { throw new Error('boom'); };
    await tick(() => hookA.load());
    assert.equal(m.container.textContent, 'a:error:1b:idle:0');
  }

  // что возвращать: новая функция из хука перезапускает эффект вызывающего на каждом рендере
  {
    function useUnstable() { return () => {}; }
    function useStable() { return useCallback(() => {}, []); }
    let unstableRuns = 0, stableRuns = 0, bump;
    function C() {
      const [, s] = useState(0); bump = s;
      const a = useUnstable(); const b = useStable();
      useEffect(() => { unstableRuns++; }, [a]);
      useEffect(() => { stableRuns++; }, [b]);
      return null;
    }
    await mount(h(C));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.deepEqual([unstableRuns, stableRuns], [3, 1]);
  }

  // useMediaQuery: значение из источника, перерисовка при change, подписка не пересоздаётся без смены query
  {
    let renders = 0, bump;
    function TaskBoard() { const [, s] = useState(0); bump = s; const isNarrow = useMediaQuery('(max-width: 600px)'); renders++; return h('i', null, String(isNarrow)); }
    width = 1024;
    const m = await mount(h(TaskBoard));
    assert.equal(m.container.textContent, 'false');
    const mql = [...mqls].at(-1);
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.equal(mql.listeners.size, 1, 'одна подписка на несколько рендеров');
    await tick(() => resize(500));
    assert.equal(m.container.textContent, 'true');
    const r = renders;
    await tick(() => resize(400)); // matches всё ещё true: boolean тот же — рендера нет
    assert.equal(renders, r);
  }

  // SSR: без getServerSnapshot серверный рендер падает; с ним — false на сервере, настоящее значение после гидратации
  {
    function NoServer() { useSyncExternalStore(() => () => {}, () => window.matchMedia('(max-width: 600px)').matches); return null; }
    assert.throws(() => renderToString(h(NoServer)), /Missing getServerSnapshot/);

    width = 500;
    const seen = [];
    function TaskBoard() { const v = useMediaQuery('(max-width: 600px)'); seen.push(v); return h('b', null, String(v)); }
    const html = renderToString(h(TaskBoard));
    assert.equal(html, '<b>false</b>');
    const c = document.createElement('div');
    c.innerHTML = html;
    document.body.appendChild(c);
    seen.length = 0;
    errors.length = 0;
    await React.act(async () => hydrateRoot(c, h(TaskBoard)));
    assert.deepEqual(seen, [false, true]);
    assert.equal(c.textContent, 'true');
    assert.deepEqual(errors, [], 'без hydration mismatch');
  }

  // useLocalStorage: снимок — строка, лишних рендеров нет; своя вкладка оповещается из setValue
  {
    const DEFAULT_SETTINGS = { sort: 'created', hideDone: false };
    let api, renders = 0;
    function Saved() { api = useLocalStorage('board-settings', DEFAULT_SETTINGS); renders++; return h('i', null, JSON.stringify(api[0])); }
    const m = await mount(h(Saved));
    assert.equal(api[0], DEFAULT_SETTINGS, 'пустое хранилище — initialValue');
    await tick(() => api[1]({ sort: 'created', hideDone: true }));
    assert.equal(m.container.textContent, '{"sort":"created","hideDone":true}');
    assert.equal(data.get('board-settings'), '{"sort":"created","hideDone":true}');
    const value = api[0];
    const r = renders;
    await tick(() => listeners.forEach((l) => l())); // оповещение без изменения: строка та же
    assert.equal(renders, r);
    assert.equal(api[0], value, 'JSON.parse не вызывался заново');

    // другая вкладка: меняет хранилище и присылает событие storage
    data.set('board-settings', '{"sort":"title","hideDone":false}');
    await tick(() => window.dispatchEvent(new window.Event('storage')));
    assert.equal(m.container.textContent, '{"sort":"title","hideDone":false}');
  }

  // initialValue-литерал: при пустом хранилище value — новый массив на каждом рендере
  {
    const values = [];
    let bump;
    function Lit() { const [, s] = useState(0); bump = s; values.push(useLocalStorage('empty-key', [])[0]); return null; }
    await mount(h(Lit));
    await tick(() => bump(1));
    assert.notEqual(values[0], values[1]);
    const EMPTY = [];
    const stable = [];
    function Const() { const [, s] = useState(0); bump = s; stable.push(useLocalStorage('empty-key', EMPTY)[0]); return null; }
    await mount(h(Const));
    await tick(() => bump(1));
    assert.equal(stable[0], stable[1]);
  }

  // JSON.parse объекта или массива в getSnapshot — новый объект на каждый вызов: бесконечный цикл
  {
    data.set('board-settings', '{"sort":"created","hideDone":true}');
    errors.length = 0;
    function Bad() { useSyncExternalStore(subscribe, () => JSON.parse(localStorage.getItem('board-settings'))); return null; }
    await assert.rejects(mount(h(Bad)), /Maximum update depth exceeded/);
    assert.ok(errors.some((e) => e.includes('The result of getSnapshot should be cached to avoid an infinite loop')));

    // примитив из JSON и пустое хранилище (JSON.parse(null) === null) равны по Object.is — цикла нет
    for (const [key, raw, want] of [['theme', '"dark"', 'dark'], ['missing', undefined, null]]) {
      if (raw !== undefined) data.set(key, raw);
      let v;
      function Prim() { v = useSyncExternalStore(subscribe, () => JSON.parse(localStorage.getItem(key))); return null; }
      await mount(h(Prim));
      assert.equal(v, want);
    }
  }

  // useDebouncedValue: cleanup отменяет прошлый таймер — значение меняется один раз после паузы
  {
    const requests = [];
    let setQuery;
    function Search({ delay }) {
      const [query, s] = useState(''); setQuery = s;
      const serverQuery = useDebouncedValue(query, delay);
      useEffect(() => { if (serverQuery) requests.push(serverQuery); }, [serverQuery]);
      return null;
    }
    await mount(h(Search, { delay: 30 }));
    await tick(() => setQuery('a'));
    await React.act(() => sleep(5));
    await tick(() => setQuery('ab'));
    await React.act(() => sleep(5));
    await tick(() => setQuery('abc'));
    assert.deepEqual(requests, [], 'во время ввода запросов нет');
    await React.act(() => sleep(60));
    assert.deepEqual(requests, ['abc'], 'один запрос после паузы');

    // без cleanup: каждый таймер доживает и выставляет своё значение — запрос на каждую букву, просто с задержкой
    const fired = [];
    function useDelayedNoCleanup(value, delay) {
      const [d, setD] = useState(value);
      useEffect(() => { setTimeout(() => { fired.push(value); setD(value); }, delay); }, [value, delay]);
      return d;
    }
    let setQ2;
    function Search2() { const [q, s] = useState(''); setQ2 = s; useDelayedNoCleanup(q, 30); return null; }
    await mount(h(Search2));
    for (const q of ['a', 'ab', 'abc']) { await tick(() => setQ2(q)); await React.act(() => sleep(5)); }
    await React.act(() => sleep(60));
    assert.deepEqual(fired, ['', 'a', 'ab', 'abc']);
  }

  // итоговый TaskBoard: у каждого значения один источник — задачи в useTasks, настройки в localStorage
  {
    data.clear();
    fetchTasks = async () => [{ id: 1, done: true }, { id: 2, done: false }];
    width = 500;
    const DEFAULT_SETTINGS = { sort: 'created', hideDone: false };
    let board;
    function TaskBoard() {
      const { tasks, status, load } = useTasks();
      const [settings, setSettings] = useLocalStorage('board-settings', DEFAULT_SETTINGS);
      const isNarrow = useMediaQuery('(max-width: 600px)');
      const [query, setQuery] = useState('');
      const deferredQuery = useDeferredValue(query);
      const searchId = useId();
      board = { load, setSettings, setQuery };
      const visible = settings.hideDone ? tasks.filter((t) => !t.done) : tasks;
      return h('i', null, `${status} ${visible.length} ${isNarrow ? 'compact' : 'full'} ${deferredQuery} ${typeof searchId}`);
    }
    const m = await mount(h(TaskBoard));
    await tick(() => board.load());
    assert.equal(m.container.textContent, 'idle 2 compact  string');
    await tick(() => board.setSettings({ ...DEFAULT_SETTINGS, hideDone: true }));
    assert.equal(m.container.textContent, 'idle 1 compact  string');
    assert.ok(!data.get('board-settings').includes('"id"'), 'задачи в хранилище не попадают');
    await tick(() => board.setQuery('x'));
    assert.equal(m.container.textContent, 'idle 1 compact x string');
  }

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
