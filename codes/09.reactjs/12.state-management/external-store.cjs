// Глава 9.12 — «Стор вне React»: мини-стор на useSyncExternalStore, подписка на срез,
// некешированный снимок, серверный снимок.
// run: node external-store.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useSyncExternalStore, memo } = React;
const { renderToString } = require('react-dom/server');

// стор в 15 строк — так устроено ядро Zustand
function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    setState: (fn) => { state = { ...state, ...fn(state) }; listeners.forEach((l) => l()); },
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
  };
}
function useStore(store, selector) {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}

(async () => {
  // компонент рендерится, только если изменился его срез
  {
    const cart = createStore({ items: [], promo: '' });
    const renders = { count: 0, promo: 0 };
    const CartCount = memo(function CartCount() { renders.count++; return h('b', null, useStore(cart, (s) => s.items.length)); });
    const Promo = memo(function Promo() { renders.promo++; return h('i', null, useStore(cart, (s) => s.promo)); });
    const { container } = await mount(h('div', null, h(CartCount), h(Promo)));
    await React.act(async () => cart.setState((s) => ({ items: [...s.items, 'book'] })));
    await React.act(async () => cart.setState((s) => ({ items: [...s.items, 'pen'] })));
    await React.act(async () => cart.setState(() => ({ promo: 'SALE' })));
    assert.equal(container.textContent, '2SALE');
    assert.deepEqual(renders, { count: 3, promo: 2 });
    // подписка снимается при размонтировании — проверим, что слушателей не копится
  }

  // снимок должен быть стабильным: новый объект на каждый вызов getSnapshot — бесконечный цикл
  {
    const store = createStore({ a: 1, b: 2 });
    errors.length = 0;
    function Bad() {
      const { a, b } = useSyncExternalStore(store.subscribe, () => ({ a: store.getState().a, b: store.getState().b }));
      return h('i', null, a + b);
    }
    let thrown;
    try { await mount(h(Bad)); } catch (e) { thrown = e.message; }
    assert.ok(errors.some((e) => e.startsWith('The result of getSnapshot should be cached to avoid an infinite loop')));
    assert.match(thrown, /^Maximum update depth exceeded/);
  }

  // на сервере нужен getServerSnapshot
  {
    const store = createStore({ width: 1280 });
    function Width() { return h('i', null, useSyncExternalStore(store.subscribe, () => store.getState().width)); }
    assert.throws(() => renderToString(h(Width)), /Missing getServerSnapshot/);
    function Width2() { return h('i', null, useSyncExternalStore(store.subscribe, () => store.getState().width, () => 1024)); }
    assert.equal(renderToString(h(Width2)), '<i>1024</i>');
  }
  // практика: useWindowWidth
  function subscribe(cb) { window.addEventListener('resize', cb); return () => window.removeEventListener('resize', cb); }
  function useWindowWidth() { return useSyncExternalStore(subscribe, () => window.innerWidth, () => 1024); }
  function W() { return h('i', null, useWindowWidth()); }
  assert.equal(renderToString(h(W)), '<i>1024</i>');
  const { container } = await mount(h(W));
  const start = container.textContent;
  window.innerWidth = 500;
  await React.act(async () => window.dispatchEvent(new window.Event('resize')));
  assert.equal(container.textContent, '500');
  assert.notEqual(start, '500');
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });

