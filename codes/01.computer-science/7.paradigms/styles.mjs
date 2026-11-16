// Проверки к 1.07: одна задача в разных стилях — императивный цикл, конвейер функций, SQL — даёт один ответ;
// sort мутирует общий массив, toSorted — нет; императивное обновление списка в DOM забывает удалённые элементы,
// а декларативная отрисовка из состояния — нет (jsdom); CSS описывает результат, а не шаги.
// Запуск: cd codes && node run.mjs 01.computer-science/7.paradigms
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { JSDOM } from 'jsdom';

const products = [
  { name: 'Улун', price: 450, inStock: true },
  { name: 'Пуэр', price: 900, inStock: true },
  { name: 'Сенча', price: 300, inStock: false },
  { name: 'Ассам', price: 250, inStock: true },
  { name: 'Матча', price: 480, inStock: true },
];
const expected = ['Ассам', 'Улун', 'Матча'];

// императивно: как сделать — шаг за шагом, с изменяемым состоянием
const result = [];
for (let i = 0; i < products.length; i++) {
  const p = products[i];
  if (p.inStock && p.price < 500) {
    let j = result.length;
    while (j > 0 && result[j - 1].price > p.price) j--;                                   // вставка на место
    result.splice(j, 0, p);
  }
}
const names = [];
for (const p of result) names.push(p.name);
assert.deepEqual(names, expected);

// функционально: что получить — конвейер преобразований без изменения входа
const cheap = products
  .filter((p) => p.inStock && p.price < 500)
  .toSorted((a, b) => a.price - b.price)
  .map((p) => p.name);
assert.deepEqual(cheap, expected);

// декларативно: SQL описывает результат, план выполнения выбирает база
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE products (name TEXT, price INTEGER, in_stock INTEGER)');
const insert = db.prepare('INSERT INTO products VALUES (?, ?, ?)');
for (const p of products) insert.run(p.name, p.price, p.inStock ? 1 : 0);
const rows = db.prepare('SELECT name FROM products WHERE in_stock = 1 AND price < 500 ORDER BY price').all();
assert.deepEqual(rows.map((r) => r.name), expected);
db.close();

// --- практика: sort мутирует общий массив ---
const catalog = [{ name: 'Б', price: 2 }, { name: 'А', price: 1 }];
const byPriceMutating = (list) => list.sort((a, b) => a.price - b.price);
byPriceMutating(catalog);
assert.equal(catalog[0].name, 'А');                                                      // исходный порядок потерян
const catalog2 = [{ name: 'Б', price: 2 }, { name: 'А', price: 1 }];
const sorted = catalog2.toSorted((a, b) => a.price - b.price);
assert.deepEqual([catalog2[0].name, sorted[0].name], ['Б', 'А']);
assert.equal(byPriceMutating(catalog), catalog);                                         // sort возвращает тот же массив

// --- практика: список в DOM императивно и декларативно ---
const { window } = new JSDOM('<ul id="cart"></ul>');
const { document } = window;
const ul = document.getElementById('cart');

// императивно: обработчик на каждое изменение
function onAdd(item) {
  const li = document.createElement('li');
  li.textContent = item;
  ul.append(li);
}
let cart = [];
for (const item of ['Улун', 'Пуэр', 'Ассам']) { cart.push(item); onAdd(item); }
cart = cart.filter((x) => x !== 'Пуэр');                                                // удалили из данных, а про DOM забыли
assert.deepEqual([...ul.children].map((li) => li.textContent), ['Улун', 'Пуэр', 'Ассам']);

// декларативно: интерфейс — функция от состояния
function render(state) {
  ul.replaceChildren(...state.map((item) => Object.assign(document.createElement('li'), { textContent: item })));
}
render(cart);
assert.deepEqual([...ul.children].map((li) => li.textContent), ['Улун', 'Ассам']);
render([...cart, 'Матча']);
assert.deepEqual([...ul.children].map((li) => li.textContent), ['Улун', 'Ассам', 'Матча']);

// практика «Сортировка испортила каталог»
{
  const popular = [{ name: 'Пуэр', price: 900 }, { name: 'Ассам', price: 250 }, { name: 'Улун', price: 450 }];
  const cheapest = (list, n) => list.toSorted((a, b) => a.price - b.price).slice(0, n);
  assert.deepEqual(cheapest(popular, 2).map((p) => p.name), ['Ассам', 'Улун']);
  assert.deepEqual(popular.map((p) => p.name), ['Пуэр', 'Ассам', 'Улун']);
  assert.deepEqual([[1, 2, 3].toReversed(), [1, 2, 3].toSpliced(1, 1), [1, 2, 3].with(0, 9)], [[3, 2, 1], [1, 3], [9, 2, 3]]);
}

// практика «Удалённый товар остался на экране»: исправленный вариант
{
  const list = document.createElement('ul');
  let cart = [];
  function render() {
    list.replaceChildren(...cart.map((item) => {
      const li = document.createElement('li');
      li.textContent = item.name;
      return li;
    }));
  }
  function onAdd(item) { cart.push(item); render(); }
  function onRemove(id) { cart = cart.filter((item) => item.id !== id); render(); }
  onAdd({ id: 1, name: 'Улун' });
  onAdd({ id: 2, name: 'Пуэр' });
  onRemove(1);
  assert.deepEqual([...list.children].map((li) => li.textContent), ['Пуэр']);
}

console.log('styles ok');
