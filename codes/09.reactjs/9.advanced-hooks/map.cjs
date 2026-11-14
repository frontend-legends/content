// Глава 9.09 — «Карта встроенных хуков»: грабли из таблиц, которые видно в коде (React 19 dev, jsdom).
// run: node map.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const ReactDOM = require('react-dom');
globalThis.FormData = window.FormData; // react-dom собирает FormData формы jsdom

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = (fn) => React.act(async () => fn());

(async () => {
  // «в пакете react 18 хуков и API use, в react-dom — useFormStatus»
  const fromReact = Object.keys(React).filter((k) => /^use/.test(k));
  assert.equal(fromReact.length, 19);
  assert.ok(fromReact.includes('use'));
  assert.ok('useFormStatus' in ReactDOM);

  // useState: начальное значение — только при монтировании; мутация объекта не запускает рендер
  {
    let renders = 0, set, obj;
    function S({ init }) { const [v, s] = React.useState(init); set = s; obj = v; renders++; return h('i', null, v.n); }
    const m = await mount(h(S, { init: { n: 1 } }));
    await m.render(h(S, { init: { n: 2 } }));
    assert.equal(m.container.textContent, '1');
    const before = renders;
    await tick(() => { obj.n = 5; set(obj); });
    assert.equal(renders, before, 'та же ссылка — рендера нет');
    assert.equal(m.container.textContent, '1');
  }

  // useContext: объект-литерал в value — читатель под memo перерисовывается на каждом рендере провайдера
  {
    const Ctx = React.createContext(null);
    let reads = 0, bump;
    const Reader = React.memo(function Reader() { React.useContext(Ctx); reads++; return null; });
    function App() { const [n, s] = React.useState(0); bump = s; return h(Ctx, { value: { user: 'ann' } }, h(Reader)); }
    await mount(h(App));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.equal(reads, 3);
  }

  // useEffect: объект из рендера в deps перезапускает эффект на каждом рендере
  {
    let runs = 0, bump;
    function E() { const [, s] = React.useState(0); bump = s; const filters = { status: 'open' }; React.useEffect(() => { runs++; }, [filters]); return null; }
    await mount(h(E));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.equal(runs, 3);
  }

  // useLayoutEffect раньше useEffect; useInsertionEffect раньше layout, ref на первом запуске ещё null
  {
    const log = [];
    function L({ n }) {
      const ref = React.useRef(null);
      React.useEffect(() => { log.push('effect'); });
      React.useLayoutEffect(() => { log.push('layout'); });
      React.useInsertionEffect(() => { log.push('insertion ref=' + (ref.current === null ? 'null' : 'node')); });
      return h('i', { ref }, n);
    }
    const m = await mount(h(L, { n: 1 }));
    assert.deepEqual(log, ['insertion ref=null', 'layout', 'effect']);
    log.length = 0;
    await m.render(h(L, { n: 2 }));
    assert.deepEqual(log, ['insertion ref=node', 'layout', 'effect']);
  }

  // useInsertionEffect: setState внутри запрещён
  {
    errors.length = 0;
    function I() { const [s, set] = React.useState(0); React.useInsertionEffect(() => { if (s === 0) set(1); }); return null; }
    await mount(h(I));
    assert.ok(errors.some((e) => e.includes('useInsertionEffect must not schedule updates')));
  }

  // useEffectEvent: вызов в рендере бросает ошибку
  {
    function EE() { const f = React.useEffectEvent(() => 1); f(); return null; }
    await assert.rejects(mount(h(EE)), /A function wrapped in useEffectEvent can't be called during rendering/);
  }

  // useRef: изменение current не перерисовывает
  {
    let renders = 0, ref;
    function R() { ref = React.useRef(0); renders++; return null; }
    await mount(h(R));
    await tick(() => { ref.current = 10; });
    assert.equal(renders, 1);
  }

  // useCallback: ребёнок без memo перерисуется в любом случае
  {
    let childRenders = 0, bump;
    function Child() { childRenders++; return null; }
    function P() { const [, s] = React.useState(0); bump = s; const onClick = React.useCallback(() => {}, []); return h(Child, { onClick }); }
    await mount(h(P));
    await tick(() => bump(1));
    assert.equal(childRenders, 2);
  }

  // useSyncExternalStore: новый объект из getSnapshot — бесконечный цикл
  {
    errors.length = 0;
    function Bad() { React.useSyncExternalStore(() => () => {}, () => ({ a: 1 })); return null; }
    await assert.rejects(mount(h(Bad)), /Maximum update depth exceeded/);
    assert.ok(errors.some((e) => e.includes('The result of getSnapshot should be cached to avoid an infinite loop')));
  }

  // useSyncExternalStore: subscribe, созданный в рендере, переподписывается на каждом рендере
  {
    let subs = 0, unsubs = 0, bump;
    function Sub() { const [, s] = React.useState(0); bump = s; React.useSyncExternalStore(() => { subs++; return () => unsubs++; }, () => 1); return null; }
    await mount(h(Sub));
    await tick(() => bump(1));
    await tick(() => bump(2));
    assert.deepEqual([subs, unsubs], [3, 2]);
  }

  // useId: свой id у каждого экземпляра, стабилен между рендерами
  {
    const ids = [];
    function Field() { ids.push(React.useId()); return null; }
    const m = await mount(h('div', null, h(Field), h(Field)));
    await m.render(h('div', null, h(Field), h(Field)));
    assert.notEqual(ids[0], ids[1]);
    assert.deepEqual(ids.slice(2), ids.slice(0, 2));
  }

  // use: промис, созданный в рендере, приостанавливает компонент снова и снова; стабильный — нет
  {
    let renders = 0;
    function U() { renders++; return h('i', null, React.use(new Promise((r) => setTimeout(() => r('x'), 1)))); }
    const m = await mount(h(React.Suspense, { fallback: 'wait' }, h(U)));
    for (let i = 0; i < 3; i++) await React.act(() => sleep(20));
    assert.equal(m.container.textContent, 'wait');
    assert.ok(renders >= 4, `рендеров ${renders}`);

    const p = Promise.resolve('y');
    function S() { return h('i', null, React.use(p)); }
    const m2 = await mount(h(React.Suspense, { fallback: 'wait' }, h(S)));
    await React.act(() => sleep(20));
    assert.equal(m2.container.textContent, 'y');
  }

  // useActionState: dispatch вне формы и startTransition — предупреждение про isPending
  {
    let dispatch;
    function A() { const [s, d] = React.useActionState(async (prev) => prev + 1, 0); dispatch = d; return h('i', null, s); }
    await mount(h(A));
    errors.length = 0;
    await tick(() => dispatch());
    assert.ok(errors.some((e) => e.includes('called outside of a transition') && e.includes('isPending will not update correctly')));
  }

  // useOptimistic: откатывается после конца action; вне transition — предупреждение
  {
    let setO, resolve;
    const seen = [];
    function O() { const [o, s] = React.useOptimistic(1); setO = s; seen.push(o); return null; }
    await mount(h(O));
    await tick(() => React.startTransition(async () => { setO(5); await new Promise((r) => (resolve = r)); }));
    assert.equal(seen.at(-1), 5);
    await tick(() => resolve());
    assert.equal(seen.at(-1), 1);
    errors.length = 0;
    await tick(() => setO(7));
    assert.ok(errors.some((e) => e.includes('An optimistic state update occurred outside a transition or action')));
  }

  // useFormStatus: видит только родительскую форму
  {
    const log = [];
    let release;
    function SubmitButton() { const { pending } = ReactDOM.useFormStatus(); log.push('button ' + pending); return h('button', { type: 'submit' }, 'go'); }
    function AddTask() {
      const { pending } = ReactDOM.useFormStatus(); // компонент, который рендерит форму
      log.push('form ' + pending);
      return h('form', { action: async () => { await new Promise((r) => (release = r)); } }, h(SubmitButton));
    }
    const m = await mount(h(AddTask));
    await tick(() => m.container.querySelector('form').requestSubmit());
    await tick(() => release());
    assert.deepEqual(log, ['form false', 'button false', 'button true', 'button false']);
  }

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
