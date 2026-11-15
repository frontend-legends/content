// Глава 7.12 — генераторы: ленивость, пауза на yield, next(value), return() запускает finally, throw(), yield*,
// бесконечная последовательность и iterator helpers (map, filter, take — тоже ленивые).
// run: node generators.mjs
import assert from 'node:assert/strict';

// тело не выполняется до первого next()
const log = [];
function* checkoutSteps() {
  log.push('start');
  yield 'cart';
  log.push('after cart');
  yield 'delivery';
  return 'paid';
}
const gen = checkoutSteps();
assert.deepEqual(log, []);
assert.deepEqual(gen.next(), { value: 'cart', done: false });
assert.deepEqual(log, ['start']);
assert.deepEqual(gen.next(), { value: 'delivery', done: false });
assert.deepEqual(gen.next(), { value: 'paid', done: true });
assert.deepEqual([...checkoutSteps()], ['cart', 'delivery']); // return-значение в for...of и spread не попадает

// двусторонний обмен: значение next(x) становится результатом yield; первый аргумент теряется
function* dialog() {
  const name = yield 'Как вас зовут?';
  const city = yield `Привет, ${name}! Город?`;
  return `${name} из ${city}`;
}
const d = dialog();
assert.equal(d.next('потеряется').value, 'Как вас зовут?');
assert.equal(d.next('Аня').value, 'Привет, Аня! Город?');
assert.deepEqual(d.next('Рига'), { value: 'Аня из Рига', done: true });

// return() и break запускают finally; throw() бросает ошибку в точке yield
const cleanup = [];
function* withCleanup() { try { yield 1; yield 2; yield 3; } finally { cleanup.push('finally'); } }
for (const x of withCleanup()) if (x === 2) break;
const g2 = withCleanup(); g2.next();
assert.deepEqual(g2.return('stop'), { value: 'stop', done: true });
assert.deepEqual(cleanup, ['finally', 'finally']);
function* catches() { try { yield 1; } catch (e) { yield `поймано: ${e.message}`; } }
const g3 = catches(); g3.next();
assert.equal(g3.throw(new Error('отмена')).value, 'поймано: отмена');

// yield* делегирует другому итерируемому
function* tree(node) { yield node.name; for (const c of node.children) yield* tree(c); }
const cats = { name: 'Посуда', children: [{ name: 'Чайники', children: [] }, { name: 'Кружки', children: [{ name: 'Термо', children: [] }] }] };
assert.deepEqual([...tree(cats)], ['Посуда', 'Чайники', 'Кружки', 'Термо']);

// бесконечная последовательность + iterator helpers: ленивые, считают только нужное
let produced = 0;
function* ids() { let i = 1; while (true) { produced++; yield i++; } }
const firstEvenSquares = ids().filter((n) => n % 2 === 0).map((n) => n * n).take(3).toArray();
assert.deepEqual(firstEvenSquares, [4, 16, 36]);
assert.equal(produced, 6);                       // посчитано ровно 6 элементов
assert.deepEqual(Iterator.from({ next() { return { done: true } } }).toArray(), []);
console.log('ok');
