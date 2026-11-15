// Проверка к 15.04: что выполняется при изменении счётчика корзины. React перезапускает функции компонентов
// и сравнивает вывод; сигнал, привязанный к текстовому узлу, меняет только этот узел.
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');

(async () => {
  const { signal, effect } = await import('@preact/signals-core');

  // --- React: состояние в родителе — перезапуск родителя и всех детей без memo ---
  const renders = { Header: 0, Badge: 0, ProductList: 0 };
  let setCount;
  function Badge({ count }) { renders.Badge++; return h('span', { id: 'badge' }, count); }
  function ProductList() { renders.ProductList++; return h('ul', null, h('li', null, 'Пуэр'), h('li', null, 'Улун')); }
  function Header() {
    renders.Header++;
    const [count, set] = React.useState(0);
    setCount = set;
    return h('header', null, h(Badge, { count }), h(ProductList));
  }
  const { container } = await mount(h(Header));
  await React.act(async () => setCount(1));
  assert.equal(container.querySelector('#badge').textContent, '1');
  assert.deepEqual(renders, { Header: 2, Badge: 2, ProductList: 2 }); // список товаров перезапущен зря

  // --- сигнал: функции разметки выполняются один раз, дальше обновляется только текстовый узел ---
  const calls = { Header: 0, ProductList: 0 };
  const count = signal(0);
  const textUpdates = [];
  function SignalHeader() {
    calls.Header++;
    const header = document.createElement('header');
    const badge = document.createElement('span');
    const text = document.createTextNode('');
    badge.append(text);
    effect(() => { text.data = String(count.value); textUpdates.push(text.data); }); // привязка: сигнал → узел
    header.append(badge, SignalProductList());
    return header;
  }
  function SignalProductList() { calls.ProductList++; const ul = document.createElement('ul'); ul.innerHTML = '<li>Пуэр</li><li>Улун</li>'; return ul; }
  const root = SignalHeader();
  document.body.append(root);
  const listBefore = root.querySelector('ul');
  count.value = 1;
  count.value = 2;
  assert.equal(root.querySelector('span').textContent, '2');
  assert.deepEqual(calls, { Header: 1, ProductList: 1 });   // ничего не перезапускалось
  assert.deepEqual(textUpdates, ['0', '1', '2']);           // менялся только текст
  assert.equal(root.querySelector('ul'), listBefore);       // тот же узел списка

  console.log('dom ok');
})();
