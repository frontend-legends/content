// Глава 12.06 — парадигмы клиентского состояния: прокси (Valtio), сигналы (Preact Signals), автомат (XState);
// кеш серверных данных: нормализованный (Apollo) против документного (TanStack Query).
// run: node paradigms.mjs
import assert from 'node:assert/strict';
import { proxy, subscribe, snapshot } from 'valtio/vanilla';
import { signal, computed, effect } from '@preact/signals-core';
import { createMachine, createActor } from 'xstate';
import { ApolloClient, InMemoryCache, ApolloLink, gql } from '@apollo/client';
import { Observable } from 'rxjs';
import { QueryClient } from '@tanstack/query-core';

const tick = () => new Promise((r) => setTimeout(r, 0));

// --- прокси: меняешь объект напрямую, подписчики узнают сами
{
  const cart = proxy({ items: [], coupon: null });
  const seen = [];
  subscribe(cart, () => seen.push(cart.items.length));
  cart.items.push({ sku: 'tea' });
  cart.items.push({ sku: 'pot' });
  await tick();
  assert.deepEqual(seen, [2]);                         // две мутации — одно уведомление
  const snap = snapshot(cart);
  assert.equal(Object.getOwnPropertyDescriptor(snap, 'coupon').writable, false);   // снимок только для чтения
  assert.throws(() => { 'use strict'; snap.coupon = 'X'; }, TypeError);
  cart.coupon = 'SALE';
  assert.equal(snap.coupon, null);
}

// --- сигналы: зависимости точечные, computed ленив
{
  const price = signal(490), qty = signal(1), theme = signal('light');
  let computedRuns = 0;
  const total = computed(() => { computedRuns++; return price.value * qty.value; });
  const log = [];
  effect(() => log.push(total.value));
  qty.value = 2;
  theme.value = 'dark';                                // эффект от темы не зависит
  assert.deepEqual(log, [490, 980]);
  assert.equal(computedRuns, 2);
}

// --- автомат: невозможный переход просто не происходит
{
  const checkout = createMachine({
    id: 'checkout',
    initial: 'cart',
    states: {
      cart: { on: { CHECKOUT: 'address' } },
      address: { on: { BACK: 'cart', SUBMIT: 'payment' } },
      payment: { on: { PAY: 'paying' } },
      paying: { on: { SUCCESS: 'done', FAIL: 'payment' } },
      done: { type: 'final' },
    },
  });
  const actor = createActor(checkout).start();
  actor.send({ type: 'PAY' });                         // оплатить из корзины нельзя
  assert.equal(actor.getSnapshot().value, 'cart');
  for (const type of ['CHECKOUT', 'SUBMIT', 'PAY', 'FAIL', 'PAY', 'SUCCESS']) actor.send({ type });
  assert.equal(actor.getSnapshot().value, 'done');
  assert.equal(actor.getSnapshot().status, 'done');
  assert.equal(actor.getSnapshot().can({ type: 'BACK' }), false);
}

// --- нормализованный кеш: одна сущность — одна запись, все запросы видят изменение
{
  let title = 'Улун';
  const responses = {
    Catalog: () => ({ products: [{ __typename: 'Product', id: '7', title, price: 490 }] }),
    Product: () => ({ product: { __typename: 'Product', id: '7', title, price: 490 } }),
    Rename: () => { title = 'Пуэр'; return { renameProduct: { __typename: 'Product', id: '7', title } }; },
  };
  const link = new ApolloLink((op) => new Observable((o) => { o.next({ data: responses[op.operationName]() }); o.complete(); }));
  const client = new ApolloClient({ link, cache: new InMemoryCache() });
  const CATALOG = gql`query Catalog { products { id title price } }`;
  const PRODUCT = gql`query Product { product { id title price } }`;
  const RENAME = gql`mutation Rename { renameProduct { id title } }`;
  await client.query({ query: CATALOG });
  await client.query({ query: PRODUCT });
  assert.deepEqual(Object.keys(client.cache.extract()).filter((k) => k.startsWith('Product')), ['Product:7']);   // одна запись
  await client.mutate({ mutation: RENAME });
  const fromCache = (q) => client.readQuery({ query: q });
  assert.equal(fromCache(CATALOG).products[0].title, 'Пуэр');   // обновились оба запроса без повторных запросов
  assert.equal(fromCache(PRODUCT).product.title, 'Пуэр');
}

// --- документный кеш: каждый ключ хранит свой ответ, после изменения нужна инвалидация
{
  const qc = new QueryClient();
  let title = 'Улун';
  const product = () => ({ id: 7, title });
  await qc.fetchQuery({ queryKey: ['catalog'], queryFn: () => [product()] });
  await qc.fetchQuery({ queryKey: ['product', 7], queryFn: product });
  title = 'Пуэр';
  qc.setQueryData(['product', 7], product());               // обновили один ответ
  assert.equal(qc.getQueryData(['product', 7]).title, 'Пуэр');
  assert.equal(qc.getQueryData(['catalog'])[0].title, 'Улун');   // каталог об этом не знает
  await qc.invalidateQueries({ queryKey: ['catalog'] });
  await qc.fetchQuery({ queryKey: ['catalog'], queryFn: () => [product()] });
  assert.equal(qc.getQueryData(['catalog'])[0].title, 'Пуэр');
  qc.clear();
}
console.log('paradigms ok');
process.exit(0);
