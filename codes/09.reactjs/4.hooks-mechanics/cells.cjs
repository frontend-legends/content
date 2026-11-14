// Глава 9.04 — «Что лежит в ячейке у каждого хука»: таблица из текста снята с настоящего fiber.
// run: node cells.cjs
const assert = require('node:assert/strict');
const { React, h, mount, fiberOf } = require('./_env.cjs');

const Ctx = React.createContext('ctx');
const ready = Promise.resolve('p');
Object.assign(ready, { status: 'fulfilled', value: 'p' }); // уже разрешённый промис, как из кеша

// хук → как он выглядит в списке fiber.memoizedState
const shape = (hook) => {
  const v = hook.memoizedState;
  if (v && typeof v === 'object' && 'create' in v && 'tag' in v) return `effect:${v.tag}`;
  if (Array.isArray(v)) return `[${typeof v[0]}, deps]`;
  if (v && typeof v === 'object') return `{${Object.keys(v)}}`;
  return typeof v + (hook.queue ? '+queue' : '');
};

async function cells(call, inspect = () => {}) {
  function Probe() { call(); return h('i', { id: 'x' }); }
  const { container, root } = await mount(h(Probe));
  const fiber = fiberOf(container.querySelector('#x'));
  const list = [];
  for (let hook = fiber.memoizedState; hook; hook = hook.next) list.push(shape(hook));
  inspect(fiber); // до unmount: после него React очищает fiber
  await React.act(async () => root.unmount());
  return { list };
}

(async () => {
  const store = { subscribe: () => () => {}, get: () => 42 };
  // флаги эффектов в исходниках React: HasEffect = 1, Insertion = 2, Layout = 4, Passive = 8
  const expected = {
    useState: [() => React.useState(1), ['number+queue']],
    useReducer: [() => React.useReducer((s) => s, 2), ['number+queue']],
    useRef: [() => React.useRef(3), ['{current}']],
    useMemo: [() => React.useMemo(() => 4, [1]), ['[number, deps]']],
    useCallback: [() => React.useCallback(() => 5, [1]), ['[function, deps]']],
    useEffect: [() => React.useEffect(() => {}, [1]), ['effect:9']], // Passive | HasEffect
    useLayoutEffect: [() => React.useLayoutEffect(() => {}, [1]), ['effect:5']], // Layout | HasEffect
    useInsertionEffect: [() => React.useInsertionEffect(() => {}, [1]), ['effect:3']], // Insertion | HasEffect
    useImperativeHandle: [() => React.useImperativeHandle({ current: null }, () => ({}), []), ['effect:5']], // это layout-эффект
    useContext: [() => React.useContext(Ctx), []],
    'use(context)': [() => React.use(Ctx), []],
    'use(promise)': [() => React.use(ready), []],
    useDebugValue: [() => React.useDebugValue('x'), []],
    useId: [() => React.useId(), ['string']],
    useDeferredValue: [() => React.useDeferredValue(7), ['number']],
    useTransition: [() => React.useTransition(), ['boolean+queue', 'function']],
    useSyncExternalStore: [() => React.useSyncExternalStore(store.subscribe, store.get), ['number+queue', 'effect:9']],
    useEffectEvent: [() => React.useEffectEvent(() => 8), ['{impl}']],
    useOptimistic: [() => React.useOptimistic(10), ['number+queue']],
    useActionState: [() => React.useActionState(async (s) => s, 9), ['number+queue', 'boolean+queue', 'function+queue']],
  };

  for (const [name, [call, want]] of Object.entries(expected)) {
    const { list } = await cells(call);
    console.log(`${name.padEnd(21)} ${list.length} ячейк(и): ${list.join(' | ') || '—'}`);
    assert.deepEqual(list, want, name);
  }

  // useCallback(fn, deps) хранит ровно то же, что useMemo(() => fn, deps)
  const fn = () => {};
  await cells(() => React.useCallback(fn, [1]), (f) => assert.equal(f.memoizedState.memoizedState[0], fn));

  // эффекты дополнительно собраны в кольцевой список на fiber.updateQueue — по нему идёт commit
  await cells(() => { React.useEffect(() => {}); React.useLayoutEffect(() => {}); }, (f) => {
    const last = f.updateQueue.lastEffect;
    assert.equal(last.next.next, last, 'два эффекта замкнуты в кольцо');
  });

  // флаг HasEffect ставится, только если зависимости изменились: без него commit эффект пропускает
  {
    let set;
    function P({ dep }) { const [, s] = React.useState(0); set = s; React.useEffect(() => {}, [dep]); return h('i', { id: 'x' }); }
    const m = await mount(h(P, { dep: 1 }));
    // текущее дерево — через корень: у DOM-узла может остаться ссылка на прошлую версию fiber
    const rootKey = Object.keys(m.container).find((k) => k.startsWith('__reactContainer$'));
    const tagNow = () => m.container[rootKey].stateNode.current.child.memoizedState.next.memoizedState.tag;
    await React.act(async () => set(1)); // рендер с теми же deps
    assert.equal(tagNow(), 8); // Passive без HasEffect
    await m.render(h(P, { dep: 2 })); // deps изменились
    assert.equal(tagNow(), 9); // Passive | HasEffect
  }

  // useContext ячейку не занимает: зависимость от контекста записана в fiber.dependencies
  await cells(() => React.useContext(Ctx), (f) => {
    const deps = f.dependencies ?? f.alternate?.dependencies;
    assert.equal(deps.firstContext.context, Ctx);
  });

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
