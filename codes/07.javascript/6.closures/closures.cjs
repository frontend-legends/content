// Глава 7.06 — замыкания: окружение запоминается при создании, каждый вызов — новое окружение,
// функции одного вызова делят переменные, var и let в цикле, присваивание после создания функции видно.
// run: node closures.cjs
const assert = require('node:assert/strict');

// фабрика: каждый вызов — своё окружение
function createCounter() {
  let count = 0;
  return { inc: () => ++count, get: () => count };
}
const a = createCounter(); const b = createCounter();
a.inc(); a.inc(); b.inc();
assert.deepEqual([a.get(), b.get()], [2, 1]); // inc и get одного вызова видят одну переменную

// замыкание хранит ссылку на переменную, а не копию значения
let currency = '₽';
const format = (v) => `${v} ${currency}`;
currency = '$';
assert.equal(format(10), '10 $');

// var в цикле — одна переменная на все итерации; let — новая привязка на каждую
const withVar = []; for (var i = 0; i < 3; i++) withVar.push(() => i);
const withLet = []; for (let j = 0; j < 3; j++) withLet.push(() => j);
assert.deepEqual(withVar.map((f) => f()), [3, 3, 3]);
assert.deepEqual(withLet.map((f) => f()), [0, 1, 2]);
// новая привязка копирует значение, изменение в теле видно следующей итерации
const seen = []; for (let k = 0; k < 6; k++) { seen.push(() => k); k++; }
assert.deepEqual(seen.map((f) => f()), [1, 3, 5]);
// IIFE — старое решение
const iife = []; for (var n = 0; n < 3; n++) (function (copy) { iife.push(() => copy); })(n);
assert.deepEqual(iife.map((f) => f()), [0, 1, 2]);

// приватное состояние: доступно только через методы
function createWallet(initial) {
  let balance = initial;
  return {
    pay(sum) { if (sum > balance) throw new RangeError('Недостаточно средств'); balance -= sum; return balance; },
    get balance() { return balance; },
  };
}
const w = createWallet(1000);
w.pay(300);
assert.equal(w.balance, 700);
assert.equal(w.balanceValue, undefined);
assert.throws(() => w.pay(5000), RangeError);
console.log('ok');
