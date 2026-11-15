// Проверки к 16.05: флаги против автомата состояний (XState), нормализация (RTK createEntityAdapter),
// команды с отменой и повтором, журнал событий и свёртка, состояние фильтров в URL.
import assert from 'node:assert/strict';
import { createMachine, createActor } from 'xstate';
import { createEntityAdapter, createSlice, configureStore } from '@reduxjs/toolkit';

// --- флаги: 3 булева = 8 сочетаний, осмысленных — 4 ---
const flags = [];
for (const isLoading of [false, true]) for (const isError of [false, true]) for (const isSuccess of [false, true]) flags.push({ isLoading, isError, isSuccess });
const valid = flags.filter((f) => [f.isLoading, f.isError, f.isSuccess].filter(Boolean).length <= 1);
assert.equal(flags.length, 8);
assert.equal(valid.length, 4); // половина сочетаний — «загрузка и ошибка одновременно» и прочие невозможные

// --- автомат оформления: переходы только разрешённые ---
const checkout = createMachine({
  id: 'checkout', initial: 'cart',
  states: {
    cart: { on: { NEXT: 'shipping' } },
    shipping: { on: { NEXT: 'payment', BACK: 'cart' } },
    payment: { on: { PAY: 'paying', BACK: 'shipping' } },
    paying: { on: { SUCCESS: 'paid', FAILURE: 'payment' } },
    paid: { type: 'final' },
  },
});
const actor = createActor(checkout).start();
actor.send({ type: 'PAY' });                     // оплата из корзины — нет такого перехода
assert.equal(actor.getSnapshot().value, 'cart');
for (const type of ['NEXT', 'NEXT', 'PAY']) actor.send({ type });
assert.equal(actor.getSnapshot().value, 'paying');
actor.send({ type: 'PAY' });                     // двойной клик «Оплатить» — игнорируется
assert.equal(actor.getSnapshot().value, 'paying');
actor.send({ type: 'SUCCESS' });
assert.equal(actor.getSnapshot().status, 'done');

// --- нормализация: сущность в одном месте, списки — идентификаторы ---
const products = createEntityAdapter();
const slice = createSlice({
  name: 'products',
  initialState: products.getInitialState({ catalogIds: [], cartIds: [] }),
  reducers: {
    loaded: (state, { payload }) => { products.setAll(state, payload); state.catalogIds = payload.map((p) => p.id); },
    addToCart: (state, { payload: id }) => { state.cartIds.push(id); },
    renamed: (state, { payload: { id, title } }) => { products.updateOne(state, { id, changes: { title } }); },
  },
});
const store = configureStore({ reducer: { products: slice.reducer } });
store.dispatch(slice.actions.loaded([{ id: 7, title: 'Пуэр', price: 1200 }, { id: 8, title: 'Улун', price: 800 }]));
store.dispatch(slice.actions.addToCart(7));
store.dispatch(slice.actions.renamed({ id: 7, title: 'Шу пуэр' }));
const { selectById } = products.getSelectors((s) => s.products);
const s = store.getState();
assert.deepEqual(s.products.catalogIds.map((id) => selectById(s, id).title), ['Шу пуэр', 'Улун']);
assert.deepEqual(s.products.cartIds.map((id) => selectById(s, id).title), ['Шу пуэр']); // каталог и корзина видят одно
assert.deepEqual(s.products.ids, [7, 8]);
// ненормализованно: копия в корзине устаревает
const denormalized = { catalog: [{ id: 7, title: 'Пуэр' }], cart: [{ id: 7, title: 'Пуэр' }] };
denormalized.catalog[0].title = 'Шу пуэр';
assert.notEqual(denormalized.cart[0].title, denormalized.catalog[0].title);

// --- команды: действие как объект, который умеет откатиться ---
function createHistory(state) {
  const done = [], undone = [];
  return {
    get state() { return state; },
    run(cmd) { state = cmd.do(state); done.push(cmd); undone.length = 0; },
    undo() { const c = done.pop(); if (c) { state = c.undo(state); undone.push(c); } },
    redo() { const c = undone.pop(); if (c) { state = c.do(state); done.push(c); } },
  };
}
const setPrice = (id, price) => { let prev; return { do: (s) => { prev = s[id]; return { ...s, [id]: price }; }, undo: (s) => ({ ...s, [id]: prev }) }; };
const h = createHistory({ 7: 1200 });
h.run(setPrice(7, 1100)); h.run(setPrice(7, 990));
h.undo();
assert.equal(h.state[7], 1100);
h.redo();
assert.equal(h.state[7], 990);
h.undo(); h.undo();
assert.equal(h.state[7], 1200);

// --- журнал событий: состояние — свёртка, история сохраняется ---
const events = [
  { type: 'ItemAdded', id: 7, qty: 1 },
  { type: 'ItemAdded', id: 8, qty: 2 },
  { type: 'QtyChanged', id: 7, qty: 3 },
  { type: 'ItemRemoved', id: 8 },
];
const apply = (cart, e) => {
  if (e.type === 'ItemAdded') return { ...cart, [e.id]: e.qty };
  if (e.type === 'QtyChanged') return { ...cart, [e.id]: e.qty };
  if (e.type === 'ItemRemoved') { const { [e.id]: _, ...rest } = cart; return rest; }
  return cart;
};
assert.deepEqual(events.reduce(apply, {}), { 7: 3 });
assert.deepEqual(events.slice(0, 2).reduce(apply, {}), { 7: 1, 8: 2 }); // состояние на любой момент
assert.equal(events.filter((e) => e.type === 'ItemRemoved').length, 1); // аудит: кто что удалял

// --- состояние в URL: фильтры переживают перезагрузку и делятся ссылкой ---
const defaults = { q: '', category: 'all', sort: 'popular', page: 1 };
const toUrl = (f) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(f)) if (v !== defaults[k]) p.set(k, String(v)); return p.toString(); };
const fromUrl = (search) => { const p = new URLSearchParams(search); return { ...defaults, ...Object.fromEntries(p), page: Number(p.get('page') ?? 1) }; };
const filters = { q: 'пуэр', category: 'tea', sort: 'popular', page: 2 };
const qs = toUrl(filters);
assert.equal(qs, 'q=%D0%BF%D1%83%D1%8D%D1%80&category=tea&page=2'); // значения по умолчанию не засоряют адрес
assert.deepEqual(fromUrl(qs), filters);

console.log('state ok');
