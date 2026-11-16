// Проверки к 1.16 на SQLite (node:sqlite): нормализованные таблицы и JOIN — INNER против LEFT; ограничения
// UNIQUE, CHECK и внешний ключ; транзакция откатывается целиком; две «вкладки» продают последний товар дважды
// при чтении и записи по отдельности и один раз при условном UPDATE; индекс превращает SCAN в SEARCH, составной
// индекс работает по левому префиксу; N+1 запрос против одного; склейка строки в SQL против параметров.
// Запуск: cd codes && node run.mjs 01.computer-science/16.intro-to-db
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';

const dir = fs.mkdtempSync(join(os.tmpdir(), 'db-'));
const file = join(dir, 'shop.db');
const db = new DatabaseSync(file);
db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT);
  CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT, category TEXT, price INTEGER, stock INTEGER CHECK (stock >= 0));
  CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), product_id INTEGER REFERENCES products(id), qty INTEGER);
`);
const addCustomer = db.prepare('INSERT INTO customers (email, name) VALUES (?, ?)');
addCustomer.run('anya@example.com', 'Аня');
addCustomer.run('boris@example.com', 'Борис');
addCustomer.run('vera@example.com', 'Вера');
const addProduct = db.prepare('INSERT INTO products (title, category, price, stock) VALUES (?, ?, ?, ?)');
addProduct.run('Улун', 'чай', 450, 10);
addProduct.run('Пуэр', 'чай', 900, 1);
addProduct.run('Чайник', 'посуда', 2500, 3);
const addOrder = db.prepare('INSERT INTO orders (customer_id, product_id, qty) VALUES (?, ?, ?)');
addOrder.run(1, 1, 2);
addOrder.run(1, 3, 1);
addOrder.run(2, 1, 1);

// --- JOIN ---
const inner = db.prepare('SELECT c.name, COUNT(o.id) AS n FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.id').all();
assert.deepEqual(inner.map((r) => [r.name, r.n]), [['Аня', 2], ['Борис', 1]]);              // Веры нет: у неё нет заказов
const left = db.prepare('SELECT c.name, COUNT(o.id) AS n FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.id').all();
assert.deepEqual(left.map((r) => [r.name, r.n]), [['Аня', 2], ['Борис', 1], ['Вера', 0]]);

// --- ограничения ---
assert.throws(() => addCustomer.run('anya@example.com', 'Аня-2'), /UNIQUE constraint failed: customers.email/);
assert.throws(() => addOrder.run(99, 1, 1), /FOREIGN KEY constraint failed/);
assert.throws(() => db.exec('UPDATE products SET stock = -1 WHERE id = 1'), /CHECK constraint failed/);

// --- транзакция: всё или ничего ---
function placeOrder(customerId, productId, qty) {
  db.exec('BEGIN');
  try {
    addOrder.run(customerId, productId, qty);
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(qty, productId);    // CHECK не даст уйти в минус
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
const ordersBefore = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
assert.throws(() => placeOrder(3, 3, 5), /CHECK constraint failed/);                          // чайников только 3
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, ordersBefore);          // заказ тоже откатился
assert.equal(db.prepare('SELECT stock FROM products WHERE id = 3').get().stock, 3);
placeOrder(3, 3, 2);
assert.equal(db.prepare('SELECT stock FROM products WHERE id = 3').get().stock, 1);

// --- гонка за последним пуэром: два соединения, как два сервера ---
const tabA = new DatabaseSync(file), tabB = new DatabaseSync(file);
const readStock = (c) => c.prepare('SELECT stock FROM products WHERE id = 2').get().stock;
// прочитать, потом записать — оба видят 1
const seenA = readStock(tabA), seenB = readStock(tabB);
let sold = 0;
for (const [c, seen] of [[tabA, seenA], [tabB, seenB]]) {
  if (seen > 0) { c.prepare('UPDATE products SET stock = ? WHERE id = 2').run(seen - 1); sold++; }
}
assert.deepEqual([sold, readStock(db)], [2, 0]);                                              // продали два из одного
// условное обновление: проверка и изменение — одна операция базы
db.exec('UPDATE products SET stock = 1 WHERE id = 2');
const buy = (c) => c.prepare('UPDATE products SET stock = stock - 1 WHERE id = 2 AND stock > 0').run().changes === 1;
assert.deepEqual([buy(tabA), buy(tabB)], [true, false]);
tabA.close(); tabB.close();

// --- индексы ---
const big = db.prepare('INSERT INTO products (title, category, price, stock) VALUES (?, ?, ?, ?)');
db.exec('BEGIN');
for (let i = 0; i < 50_000; i++) big.run(`товар ${i}`, ['чай', 'посуда', 'сладости', 'подарки'][i % 4], i % 5000, 1);
db.exec('COMMIT');
const plan = (sql) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((r) => r.detail).join(' | ');
assert.match(plan('SELECT * FROM products WHERE price = 4500'), /^SCAN products$/);
db.exec('CREATE INDEX products_price ON products(price)');
assert.match(plan('SELECT * FROM products WHERE price = 4500'), /SEARCH products USING INDEX products_price \(price=\?\)/);
// составной индекс: работает, если запрос использует левый префикс
db.exec('CREATE INDEX products_cat_price ON products(category, price)');
assert.match(plan("SELECT * FROM products WHERE category = 'чай' AND price < 100"), /USING INDEX products_cat_price \(category=\? AND price<\?\)/);
db.exec('DROP INDEX products_price');
assert.match(plan('SELECT * FROM products WHERE price = 4500'), /^SCAN products$/);         // без category индекс не помог
// функция над колонкой тоже мешает индексу
db.exec('CREATE INDEX customers_email ON customers(email)');
assert.match(plan("SELECT * FROM customers WHERE email = 'a'"), /USING (COVERING )?INDEX/);
assert.match(plan("SELECT * FROM customers WHERE lower(email) = 'a'"), /^SCAN customers/);

// практика «Индекс есть, а запрос медленный»: только (category, price) — диапазон по цене без категории
const rangeSql = 'SELECT * FROM products WHERE price BETWEEN 100 AND 500 ORDER BY price';
assert.match(plan(rangeSql), /^SCAN products/);
assert.match(plan("SELECT * FROM products WHERE category = 'чай' AND price BETWEEN 100 AND 500 ORDER BY price"), /SEARCH products USING INDEX products_cat_price \(category=\? AND price>\? AND price<\?\)/);
db.exec('CREATE INDEX products_price ON products(price)');
assert.match(plan(rangeSql), /SEARCH products USING INDEX products_price \(price>\? AND price<\?\)/);
db.exec('DROP INDEX products_price');

// практика «Последний пуэр продан дважды»: условный UPDATE и заказ в одной транзакции
{
  db.exec('UPDATE products SET stock = 1 WHERE id = 2');
  const buyOne = db.prepare('UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0');
  const addOne = db.prepare('INSERT INTO orders (customer_id, product_id, qty) VALUES (?, ?, 1)');
  const handler = (userId, productId) => {
    db.exec('BEGIN');
    try {
      if (buyOne.run(productId).changes === 0) { db.exec('ROLLBACK'); return 409; }
      addOne.run(userId, productId);
      db.exec('COMMIT');
      return 200;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const ordersFor = () => db.prepare('SELECT COUNT(*) AS n FROM orders WHERE product_id = 2').get().n;
  const before = ordersFor();
  assert.deepEqual([handler(1, 2), handler(2, 2)], [200, 409]);
  assert.equal(ordersFor(), before + 1);
  assert.throws(() => handler(999, 1), /FOREIGN KEY/);                                        // сбой после списания — откат
  assert.equal(db.prepare('SELECT stock FROM products WHERE id = 1').get().stock, 10);
}

// --- N+1 ---
let queries = 0;
const q = (sql) => { queries++; return db.prepare(sql); };
queries = 0;
const list = q('SELECT id, name FROM customers ORDER BY id').all();
const nPlusOne = list.map((c) => ({ ...c, orders: q('SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?').get(c.id).n }));
assert.equal(queries, 1 + list.length);
queries = 0;
const joined = q('SELECT c.id, c.name, COUNT(o.id) AS orders FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY c.id').all();
assert.equal(queries, 1);
assert.deepEqual(joined.map((r) => ({ ...r })), nPlusOne);

// --- параметры вместо склейки строк ---
const search = (email) => db.prepare(`SELECT name FROM customers WHERE email = '${email}'`).all();
assert.equal(search("x' OR '1'='1").length, 3);                                               // условие стало всегда истинным
const safe = (email) => db.prepare('SELECT name FROM customers WHERE email = ?').all(email);
assert.equal(safe("x' OR '1'='1").length, 0);                                                 // значение осталось значением
assert.equal(safe('vera@example.com')[0].name, 'Вера');

db.close();
fs.rmSync(dir, { recursive: true, force: true });
console.log('db ok');
