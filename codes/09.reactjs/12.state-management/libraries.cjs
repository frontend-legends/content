// Глава 9.12 — сторы на практике: селекторы Zustand и useShallow, Redux Toolkit с Immer, атомы Jotai.
// run: node libraries.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { memo } = React;
const { create } = require('zustand');
const { useShallow } = require('zustand/react/shallow');
const { configureStore, createSlice } = require('@reduxjs/toolkit');
const { Provider, useSelector, useDispatch } = require('react-redux');
const { atom, useAtomValue, useSetAtom, Provider: JotaiProvider } = require('jotai');

(async () => {
  // Zustand: селектор = подписка на срез
  {
    const useCart = create((set) => ({ items: [], promo: '', add: (x) => set((s) => ({ items: [...s.items, x] })) }));
    let promoRenders = 0;
    const Promo = memo(function Promo() { promoRenders++; return h('i', null, useCart((s) => s.promo)); });
    const Count = memo(function Count() { return h('b', null, useCart((s) => s.items.length)); });
    const { container } = await mount(h('div', null, h(Count), h(Promo)));
    await React.act(async () => useCart.getState().add('book'));
    assert.equal(container.querySelector('b').textContent, '1');
    assert.equal(promoRenders, 1);

    // селектор, возвращающий новый объект, зацикливается; useShallow сравнивает поля
    errors.length = 0;
    function Bad() { const { items, promo } = useCart((s) => ({ items: s.items, promo: s.promo })); return h('i', null, items.length + promo); }
    let thrown;
    try { await mount(h(Bad)); } catch (e) { thrown = e.message; }
    assert.match(thrown ?? errors.join(' '), /Maximum update depth exceeded|getSnapshot should be cached/);
    function Good() { const { items, promo } = useCart(useShallow((s) => ({ items: s.items, promo: s.promo }))); return h('i', null, items.length + promo); }
    const g = await mount(h(Good));
    assert.equal(g.container.textContent, '1');
  }

  // Redux Toolkit: «мутация» в редьюсере через Immer даёт новый объект, старый не тронут
  {
    const todos = createSlice({
      name: 'todos',
      initialState: { list: [{ id: 1, done: false }] },
      reducers: { toggle: (state, action) => { const t = state.list.find((x) => x.id === action.payload); t.done = !t.done; } },
    });
    const store = configureStore({ reducer: { todos: todos.reducer } });
    const before = store.getState().todos;
    store.dispatch(todos.actions.toggle(1));
    const after = store.getState().todos;
    assert.notEqual(after, before);
    assert.equal(before.list[0].done, false);
    assert.equal(after.list[0].done, true);
    assert.equal(todos.actions.toggle(1).type, 'todos/toggle');

    let renders = 0;
    function Done() { renders++; return h('b', null, String(useSelector((s) => s.todos.list[0].done))); }
    function Toggle() { const d = useDispatch(); return h('button', { onClick: () => d(todos.actions.toggle(1)) }); }
    const MemoDone = memo(Done);
    const { container } = await mount(h(Provider, { store }, h(MemoDone), h(Toggle)));
    await React.act(async () => container.querySelector('button').click());
    assert.equal(container.querySelector('b').textContent, 'false');
    assert.equal(renders, 2);
  }

  // Jotai: производный атом пересчитывается сам, компонент подписан на свой атом
  {
    const priceAtom = atom(100);
    const qtyAtom = atom(1);
    const totalAtom = atom((get) => get(priceAtom) * get(qtyAtom));
    let setQty;
    function Total() { return h('b', null, useAtomValue(totalAtom)); }
    function Qty() { setQty = useSetAtom(qtyAtom); return null; }
    const { container } = await mount(h(JotaiProvider, null, h(Total), h(Qty)));
    await React.act(async () => setQty(3));
    assert.equal(container.textContent, '300');
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
