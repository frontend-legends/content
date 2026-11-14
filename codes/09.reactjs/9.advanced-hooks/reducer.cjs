// Глава 9.09 — «useState или useReducer»: редьюсер в рендере, bailout, init, стабильный dispatch, два контекста.
// run: node reducer.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { flushSync } = require('react-dom');
const tick = (fn) => React.act(async () => fn());

// редьюсер из текста
const initialState = { tasks: [], status: 'idle', error: null };
function tasksReducer(state, action) {
  switch (action.type) {
    case 'load':
      return { ...state, status: 'loading', error: null };
    case 'loaded':
      return { tasks: action.tasks, status: 'idle', error: null };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'added':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'toggled':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)) };
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
}

(async () => {
  // редьюсер тестируется без React; повторная загрузка сбрасывает ошибку — невозможного состояния нет
  {
    let s = tasksReducer(initialState, { type: 'failed', error: 'boom' });
    assert.deepEqual(s, { tasks: [], status: 'error', error: 'boom' });
    s = tasksReducer(s, { type: 'load' });
    assert.equal(s.error, null);
    s = tasksReducer(s, { type: 'loaded', tasks: [{ id: 1, done: false }] });
    s = tasksReducer(s, { type: 'toggled', id: 1 });
    assert.deepEqual(s, { tasks: [{ id: 1, done: true }], status: 'idle', error: null });
    assert.throws(() => tasksReducer(s, { type: 'oops' }), /Unknown action: oops/);
  }

  // с тремя useState забытый setError(null) даёт свежие задачи вместе со старой ошибкой
  {
    let load;
    function Board({ fetchTasks }) {
      const [tasks, setTasks] = React.useState([]);
      const [status, setStatus] = React.useState('idle');
      const [error, setError] = React.useState(null);
      load = async () => {
        setStatus('loading');
        try { setTasks(await fetchTasks()); setStatus('idle'); } catch (e) { setError(e.message); setStatus('error'); }
      };
      return h('i', null, `${tasks.length} ${status} ${error}`);
    }
    let fail = true;
    const m = await mount(h(Board, { fetchTasks: async () => { if (fail) throw new Error('boom'); return [1, 2]; } }));
    await tick(() => load());
    fail = false;
    await tick(() => load());
    assert.equal(m.container.textContent, '2 idle boom');
  }

  // dispatch кладёт действие в очередь; редьюсер вызывается в рендере; state после dispatch — старый
  {
    const log = [];
    let dispatch;
    function reducer(s, a) { log.push('reducer'); return s + 1; }
    function C() { const [s, d] = React.useReducer(reducer, 0); dispatch = d; log.push('render ' + s); return null; }
    await mount(h(C));
    await tick(() => { dispatch({ type: 'added' }); log.push('after dispatch'); });
    assert.deepEqual(log, ['render 0', 'after dispatch', 'reducer', 'render 1']);
  }

  // редьюсер, объявленный в компоненте, видит props того рендера, где применяется очередь
  {
    let dispatch;
    const seen = [];
    function Counter({ step }) { const [n, d] = React.useReducer((n) => n + step, 0); dispatch = d; seen.push(n); return null; }
    const m = await mount(h(Counter, { step: 1 }));
    await m.render(h(Counter, { step: 10 }));
    await tick(() => dispatch());
    assert.equal(seen.at(-1), 10);
  }

  // тот же state: useState не вызывает компонент (eager bailout), useReducer вызывает, но детей не трогает
  {
    let setS, dispatch, sRenders = 0, rRenders = 0, rChild = 0;
    function WithState() { const [v, s] = React.useState(1); setS = s; sRenders++; return null; }
    function Child() { rChild++; return null; }
    function WithReducer() { const [v, d] = React.useReducer((s) => s, 1); dispatch = d; rRenders++; return h(Child); }
    await mount(h(WithState));
    await mount(h(WithReducer));
    await tick(() => setS(1));
    await tick(() => dispatch());
    await tick(() => dispatch());
    assert.equal(sRenders, 1, 'useState: компонент не вызван');
    assert.equal(rRenders, 3, 'useReducer: компонент вызван на каждый dispatch');
    assert.equal(rChild, 1, 'дети не перерисованы');

    // условие eager bailout: на fiber нет ожидающих апдейтов. Сразу после смены значения
    // первый set с тем же значением всё же вызывает компонент, следующий — уже нет
    await tick(() => setS(2));
    assert.equal(sRenders, 2);
    await tick(() => setS(2));
    assert.equal(sRenders, 3, 'сразу после апдейта: компонент вызван');
    await tick(() => setS(2));
    assert.equal(sRenders, 3, 'дальше eager bailout срабатывает');
  }

  // StrictMode: редьюсер вызывается дважды, мутация задваивает задачу (и React ругается на повтор key)
  {
    let dispatch, calls = 0;
    const shown = [];
    function mutating(state, action) { calls++; state.tasks.push(action.task); return { ...state }; }
    function List() {
      const [s, d] = React.useReducer(mutating, { tasks: [] });
      dispatch = d;
      shown.push(JSON.stringify(s.tasks));
      return h('ul', null, s.tasks.map((t) => h('li', { key: t }, t)));
    }
    await mount(h(React.StrictMode, null, h(List)));
    errors.length = 0;
    await tick(() => dispatch({ type: 'added', task: 'a' }));
    assert.equal(calls, 2);
    assert.equal(shown.at(-1), '["a","a"]');
    assert.ok(errors.some((e) => e.includes('Encountered two children with the same key')));

    // чистый редьюсер в StrictMode: тоже два вызова, но результат верный
    let d2;
    const shown2 = [];
    function Pure() { const [s, d] = React.useReducer(tasksReducer, initialState); d2 = d; shown2.push(JSON.stringify(s.tasks)); return null; }
    await mount(h(React.StrictMode, null, h(Pure)));
    await tick(() => d2({ type: 'added', task: 'a' }));
    assert.equal(shown2.at(-1), '["a"]');
  }

  // без StrictMode: перепроигрывание очереди после срочного апдейта тоже задваивает мутацию
  {
    let dispatch;
    const shown = [];
    function r(state, a) {
      if (a.type === 'added') { state.tasks.push(a.task); return { ...state }; }
      return { ...state, n: state.n + 1 };
    }
    function T() { const [s, d] = React.useReducer(r, { tasks: [], n: 0 }); dispatch = d; shown.push(JSON.stringify(s.tasks)); return null; }
    await mount(h(T));
    await tick(() => {
      React.startTransition(() => dispatch({ type: 'bump' })); // низкий приоритет
      flushSync(() => dispatch({ type: 'added', task: 'a' })); // срочный, после него
    });
    assert.deepEqual(shown, ['[]', '["a"]', '["a","a"]']);
  }

  // init: init(initialArg) — только при монтировании; выражение в аргументе — на каждом рендере
  {
    let calls = 0, bump;
    const createInitialState = (tasks) => { calls++; return { tasks, status: 'idle', error: null }; };
    let eager, lazy;
    function I({ initialTasks }) {
      const [, s] = React.useState(0); bump = s;
      [eager] = React.useReducer(tasksReducer, createInitialState(initialTasks));
      return null;
    }
    function L({ initialTasks }) {
      const [, s] = React.useState(0); bump = s;
      [lazy] = React.useReducer(tasksReducer, initialTasks, createInitialState);
      return null;
    }
    const initialTasks = [{ id: 1, done: false }];
    await mount(h(I, { initialTasks }));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.equal(calls, 3, 'createInitialState(initialTasks) — на каждом рендере');
    calls = 0;
    await mount(h(L, { initialTasks }));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.equal(calls, 1, 'init — только при монтировании');
    assert.deepEqual(lazy, eager);
    assert.equal(lazy.tasks, initialTasks);

    // в StrictMode init вызывается дважды
    let strictInits = 0;
    function SI() { React.useReducer((s) => s, 0, (a) => { strictInits++; return a; }); return null; }
    await mount(h(React.StrictMode, null, h(SI)));
    assert.equal(strictInits, 2);
  }

  // сброс через init: case 'reset': return init(action.payload)
  {
    const init = (count) => ({ count });
    const reducer = (s, a) => (a.type === 'reset' ? init(a.payload) : { count: s.count + 1 });
    let dispatch, state;
    function R() { [state, dispatch] = React.useReducer(reducer, 5, init); return null; }
    await mount(h(R));
    await tick(() => dispatch({ type: 'inc' }));
    assert.deepEqual(state, { count: 6 });
    await tick(() => dispatch({ type: 'reset', payload: 0 }));
    assert.deepEqual(state, { count: 0 });
  }

  // dispatch — одна и та же функция на всех рендерах
  {
    const ds = [];
    let dispatch;
    function D() { const [, d] = React.useReducer(tasksReducer, initialState); dispatch = d; ds.push(d); return null; }
    await mount(h(D));
    await tick(() => dispatch({ type: 'load' }));
    await tick(() => dispatch({ type: 'added', task: 1 }));
    assert.equal(ds.length, 3);
    assert.ok(ds.every((d) => d === ds[0]));
  }

  // два контекста: кнопка читает только dispatch и не перерисовывается при новом state
  {
    const TasksContext = React.createContext(null);
    const TasksDispatchContext = React.createContext(null);
    let buttonRenders = 0, listRenders = 0, dispatch;
    function TasksProvider({ children }) {
      const [state, d] = React.useReducer(tasksReducer, initialState);
      dispatch = d;
      return h(TasksContext, { value: state }, h(TasksDispatchContext, { value: d }, children));
    }
    function AddButton() { React.useContext(TasksDispatchContext); buttonRenders++; return null; }
    function List() { React.useContext(TasksContext); listRenders++; return null; }
    await mount(h(TasksProvider, null, h(AddButton), h(List)));
    await tick(() => dispatch({ type: 'added', task: 1 }));
    await tick(() => dispatch({ type: 'added', task: 2 }));
    assert.equal(buttonRenders, 1);
    assert.equal(listRenders, 3);

    // один контекст с { state, dispatch } — кнопка перерисовывается на каждое действие
    const Both = React.createContext(null);
    let both = 0, d2;
    function OneProvider({ children }) { const [state, d] = React.useReducer(tasksReducer, initialState); d2 = d; return h(Both, { value: { state, dispatch: d } }, children); }
    function AddButton2() { React.useContext(Both); both++; return null; }
    await mount(h(OneProvider, null, h(AddButton2)));
    await tick(() => d2({ type: 'added', task: 1 }));
    await tick(() => d2({ type: 'added', task: 2 }));
    assert.equal(both, 3);
  }

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
