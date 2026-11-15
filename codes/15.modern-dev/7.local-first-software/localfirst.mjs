// Проверки к 15.07: CRDT на Yjs — офлайн-правки сходятся при любом порядке обмена, повтор безопасен;
// одно поле при параллельной записи — одно значение; «последняя запись побеждает» теряет правку;
// удалённое оставляет след; IndexedDB в Chromium переживает перезагрузку.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import * as Y from 'yjs';
import { withPage } from '../../_lib/browser.mjs';

const doc = (id) => { const d = new Y.Doc(); d.clientID = id; return d; };

// --- общее начало: описание товара ---
const base = doc(1);
base.getText('description').insert(0, 'Пуэр из Юньнани.');
const a = doc(2), b = doc(3);
Y.applyUpdate(a, Y.encodeStateAsUpdate(base));
Y.applyUpdate(b, Y.encodeStateAsUpdate(base));

// --- оба офлайн: Аня дописывает в конец, Петя — в начало ---
const before = { a: Y.encodeStateVector(a), b: Y.encodeStateVector(b) };
a.getText('description').insert(a.getText('description').length, ' Выдержка 5 лет.');
b.getText('description').insert(0, 'Новинка! ');
const fromA = Y.encodeStateAsUpdate(a, before.b); // только то, чего у B нет
const fromB = Y.encodeStateAsUpdate(b, before.a);

// --- снова онлайн: обмен в разном порядке, плюс повтор ---
const c1 = doc(4), c2 = doc(5);
for (const u of [Y.encodeStateAsUpdate(base), fromA, fromB]) Y.applyUpdate(c1, u);
for (const u of [fromB, Y.encodeStateAsUpdate(base), fromA, fromA]) Y.applyUpdate(c2, u); // другой порядок и дубль
Y.applyUpdate(a, fromB);
Y.applyUpdate(b, fromA);
const expected = 'Новинка! Пуэр из Юньнани. Выдержка 5 лет.';
for (const d of [a, b, c1, c2]) assert.equal(d.getText('description').toString(), expected); // обе правки, один результат

// --- одно и то же поле: CRDT сходится, но сохраняет одно значение ---
const m1 = doc(10), m2 = doc(20);
m1.getMap('product').set('price', 1200);
Y.applyUpdate(m2, Y.encodeStateAsUpdate(m1));
m1.getMap('product').set('price', 1100); // Аня делает скидку
m2.getMap('product').set('price', 1300); // Петя поднимает цену
Y.applyUpdate(m1, Y.encodeStateAsUpdate(m2));
Y.applyUpdate(m2, Y.encodeStateAsUpdate(m1));
const price1 = m1.getMap('product').get('price');
assert.equal(price1, m2.getMap('product').get('price')); // одинаково у обоих
assert.ok([1100, 1300].includes(price1));                 // но одна из правок проиграла
console.log(`  параллельная запись цены 1100 и 1300 → у обоих ${price1}`);

// --- наивное «последняя запись побеждает» для текста теряет правку ---
const lww = (x, y) => (x.at > y.at ? x : y);
const fromAnya = { text: 'Пуэр из Юньнани. Выдержка 5 лет.', at: 1000 };
const fromPetya = { text: 'Новинка! Пуэр из Юньнани.', at: 1001 };
assert.equal(lww(fromAnya, fromPetya).text, 'Новинка! Пуэр из Юньнани.'); // «Выдержка 5 лет» пропала

// --- удалённое оставляет след: метаданные растут ---
const big = doc(30);
const t = big.getText('t');
for (let i = 0; i < 2000; i++) t.insert(t.length, 'x');
t.delete(0, t.length);
const size = Y.encodeStateAsUpdate(big).length;
assert.equal(t.toString(), '');
assert.ok(size > 10, String(size)); // пустой текст, а состояние не пустое
const fresh = Y.encodeStateAsUpdate(doc(31)).length;
console.log(`  пустой документ после 2000 вставок и удалений: ${size} байт, новый пустой: ${fresh} байт`);
assert.ok(size > fresh);

// --- локальное хранилище: IndexedDB переживает перезагрузку страницы ---
const server = await new Promise((r) => { const s = createServer((q, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html>'); }).listen(0, () => r(s)); });
await withPage(async (page) => {
  const url = `http://localhost:${server.address().port}/`;
  await page.goto(url);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('shop', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('drafts');
    open.onsuccess = () => { const tx = open.result.transaction('drafts', 'readwrite'); tx.objectStore('drafts').put({ text: 'черновик описания' }, 'product-7'); tx.oncomplete = resolve; tx.onerror = reject; };
  }));
  await page.reload();
  const draft = await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open('shop', 1);
    open.onsuccess = () => { const req = open.result.transaction('drafts').objectStore('drafts').get('product-7'); req.onsuccess = () => resolve(req.result); };
  }));
  assert.deepEqual(draft, { text: 'черновик описания' });
  const { quota } = await page.evaluate(() => navigator.storage.estimate());
  assert.ok(quota > 0);
});
server.close();

console.log('localfirst ok');
