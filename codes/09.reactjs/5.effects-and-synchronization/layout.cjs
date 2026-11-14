// Глава 9.05, раздел «useLayoutEffect: измерить до отрисовки»:
// setState в layout-эффекте даёт повторный рендер в той же задаче (до любой микрозадачи — браузеру негде нарисовать кадр),
// заодно выполняются оставшиеся useEffect; в useEffect неверная позиция переживает границу задачи;
// при клике useEffect выполняется синхронно в конце commit: подсказка на useEffect, открытая кликом, не мигает, а по hover и таймеру мигает;
// эффекты идут от детей к родителю; на сервере эффекты не выполняются и не предупреждают.
// run: node layout.cjs  (без act: проверяем настоящее расписание React)
const assert = require('node:assert/strict');
const { React, h, errors } = require('../../_lib/react.cjs');
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const { useState, useEffect, useLayoutEffect, useInsertionEffect, useRef } = React;
const { createRoot } = require('react-dom/client');
const { renderToString } = require('react-dom/server');

const settle = () => new Promise((r) => setTimeout(r, 30));
// jsdom не считает раскладку: высота подсказки — 40px
window.HTMLElement.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 40, height: 40, width: 100, left: 0, right: 100 });

async function run(useMeasureEffect) {
  const log = [];
  let show;
  function Tooltip({ anchor, children }) {
    const ref = useRef(null);
    const [height, setHeight] = useState(0);
    useMeasureEffect(() => {
      log.push('measure');
      queueMicrotask(() => log.push('microtask: top=' + ref.current.style.top));
      setHeight(ref.current.getBoundingClientRect().height);
    }, []);
    useEffect(() => { log.push('useEffect height=' + height); });
    const top = anchor.top - height < 0 ? anchor.bottom : anchor.top - height;
    log.push('render top=' + top);
    return h('div', { ref, style: { position: 'fixed', top } }, children);
  }
  function App() {
    const [open, setOpen] = useState(false);
    show = () => setOpen(true);
    return open ? h(Tooltip, { anchor: { top: 10, bottom: 30 } }, 'Подсказка') : null;
  }
  const c = document.createElement('div');
  document.body.appendChild(c);
  createRoot(c).render(h(App));
  await settle();
  setTimeout(show); // обычный (не дискретный) апдейт
  await settle();
  return { log, top: c.firstChild.style.top };
}

(async () => {
  const layout = await run(useLayoutEffect);
  assert.deepEqual(layout.log, [
    'render top=10',          // первый проход: высота ещё 0 — подсказка наезжает на якорь
    'measure',
    'useEffect height=0',     // setState в layout-эффекте: оставшиеся эффекты выполняются сразу
    'render top=30',          // повторный рендер — синхронно
    'useEffect height=40',
    'microtask: top=30px',    // первая микрозадача видит уже исправленный DOM: всё было в одной задаче
  ]);
  assert.equal(layout.top, '30px');

  const passive = await run(useEffect);
  assert.deepEqual(passive.log, [
    'render top=10',
    'measure',                // эффект выполнился отдельной задачей после commit
    'useEffect height=0',
    'microtask: top=10px',    // задача закончилась, а в DOM всё ещё неверная позиция — браузер может её нарисовать
    'render top=30',          // исправление — в следующей задаче
    'useEffect height=40',
  ]);
  assert.equal(passive.top, '30px');

  // момент между commit и useEffect: задача закончилась, а в DOM ещё неверный top
  {
    const log = [];
    let set;
    function T() {
      const [v, setV] = useState(0);
      set = setV;
      useLayoutEffect(() => { if (v) queueMicrotask(() => log.push('microtask: DOM=' + c.textContent)); }, [v]);
      useEffect(() => { if (v) log.push('useEffect: DOM=' + c.textContent); }, [v]);
      return h('p', null, v ? 'top=10' : '');
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(T));
    await settle();
    setTimeout(() => set(1));
    await settle();
    assert.deepEqual(log, ['microtask: DOM=top=10', 'useEffect: DOM=top=10']); // микрозадачи успели пройти до эффекта
  }

  // обычный апдейт против клика: когда выполняется useEffect относительно микрозадач
  for (const kind of ['update', 'click']) {
    const log = [];
    let set;
    function B() {
      const [v, setV] = useState(0);
      set = setV;
      useLayoutEffect(() => { if (v) { log.push('layout'); queueMicrotask(() => log.push('microtask')); } }, [v]);
      useEffect(() => { if (v) log.push('effect'); }, [v]);
      return h('button', { onClick: () => setV(1) }, v);
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(B));
    await settle();
    if (kind === 'update') setTimeout(() => set(1));
    else c.querySelector('button').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await settle();
    assert.deepEqual(log, kind === 'click'
      ? ['layout', 'effect', 'microtask']   // дискретное событие: useEffect синхронно в конце commit
      : ['layout', 'microtask', 'effect']); // обычный апдейт: useEffect — отдельной задачей
  }

  // подсказка на useEffect: мигание зависит от того, чем её открыли.
  // Маркер «task» ставится в первом commit через setImmediate: что в DOM на границе задачи, где браузер может рисовать.
  for (const trigger of ['click', 'mouseover', 'timer']) {
    const log = [];
    let show;
    function Tip({ anchor }) {
      const ref = useRef(null);
      const [height, setHeight] = useState(0);
      useLayoutEffect(() => { setImmediate(() => log.push('task: top=' + ref.current.style.top)); }, []);
      useEffect(() => { log.push('measure'); setHeight(ref.current.getBoundingClientRect().height); }, []);
      const top = anchor.top - height < 0 ? anchor.bottom : anchor.top - height;
      log.push('render top=' + top);
      return h('div', { ref, style: { position: 'fixed', top } });
    }
    function App() {
      const [open, setOpen] = useState(false);
      show = () => setOpen(true);
      return h('div', null, h('button', { onClick: show, onMouseOver: show }), open ? h(Tip, { anchor: { top: 10, bottom: 30 } }) : null);
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(App));
    await settle();
    if (trigger === 'timer') setTimeout(show);
    else c.querySelector('button').dispatchEvent(new window.MouseEvent(trigger, { bubbles: true }));
    await settle();
    assert.deepEqual(log, trigger === 'click'
      ? ['render top=10', 'measure', 'render top=30', 'task: top=30px']   // клик: исправлено до конца задачи, мигания нет
      : ['render top=10', 'task: top=10px', 'measure', 'render top=30']); // hover и таймер: граница задачи с неверной позицией
  }

  // порядок эффектов: от детей к родителю, отдельно для каждого вида
  {
    const log = [];
    function Child({ id }) {
      useInsertionEffect(() => { log.push('insertion ' + id); });
      useLayoutEffect(() => { log.push('layout ' + id); });
      useEffect(() => { log.push('effect ' + id); });
      return h('i', null, id);
    }
    function Parent() {
      const ref = useRef(null);
      useInsertionEffect(() => { log.push('insertion parent'); });
      useLayoutEffect(() => { log.push('layout parent, DOM детей: ' + ref.current.textContent); });
      useEffect(() => { log.push('effect parent'); });
      return h('div', { ref }, h(Child, { id: 'a' }), h(Child, { id: 'b' }));
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render(h(Parent));
    await settle();
    assert.deepEqual(log, [
      'insertion a', 'insertion b', 'insertion parent',
      'layout a', 'layout b', 'layout parent, DOM детей: ab',
      'effect a', 'effect b', 'effect parent',
    ]);
  }

  // componentDidMount по времени ближе к useLayoutEffect: оба до первой микрозадачи, useEffect — после
  {
    const log = [];
    class Legacy extends React.Component {
      componentDidMount() { log.push('componentDidMount'); queueMicrotask(() => log.push('microtask')); }
      render() { return null; }
    }
    function Modern() {
      useLayoutEffect(() => { log.push('useLayoutEffect'); });
      useEffect(() => { log.push('useEffect'); });
      return null;
    }
    const c = document.createElement('div');
    document.body.appendChild(c);
    createRoot(c).render([h(Legacy, { key: 1 }), h(Modern, { key: 2 })]);
    await settle();
    assert.deepEqual(log, ['componentDidMount', 'useLayoutEffect', 'microtask', 'useEffect']);
  }

  // сервер: ни useLayoutEffect, ни useEffect не выполняются, предупреждения нет
  errors.length = 0;
  let ran = 0;
  function S() {
    useLayoutEffect(() => { ran++; });
    useEffect(() => { ran++; });
    return h('div', null, 'tooltip');
  }
  assert.equal(renderToString(h(S)), '<div>tooltip</div>');
  assert.equal(ran, 0);
  assert.deepEqual(errors, []);
  console.log('layout: ok');
})().catch((e) => { console.log(e); process.exit(1); });
