// Проверки к 1.09: инкапсуляция через # и замыкание, динамическая диспетчеризация по прототипу,
// полиморфизм через протокол (Symbol.iterator, then), хрупкий базовый класс (конструктор Set вызывает add
// до инициализации полей наследника), Symbol.species у Array, нарушение подстановки Лисков
// (квадрат и прямоугольник), композиция вместо взрыва иерархии.
// Запуск: cd codes && node run.mjs 01.computer-science/9.oop
import assert from 'node:assert/strict';

// --- инкапсуляция ---
class Cart {
  #items = [];
  add(item) {
    if (item.qty <= 0) throw new RangeError('количество должно быть больше нуля');
    this.#items.push(item);
  }
  get total() { return this.#items.reduce((s, i) => s + i.price * i.qty, 0); }
  static isCart(o) { return #items in o; }
}
const cart = new Cart();
cart.add({ price: 450, qty: 2 });
assert.equal(cart.total, 900);
assert.throws(() => cart.add({ price: 1, qty: 0 }), RangeError);                       // инвариант защищён
assert.deepEqual(Object.keys(cart), []);
assert.equal(cart.items, undefined);
assert.deepEqual([Cart.isCart(cart), Cart.isCart({ total: 900 })], [true, false]);
assert.throws(() => new Function('o', 'return o.#items'), SyntaxError);                // снаружи класса — синтаксическая ошибка
const fake = Object.setPrototypeOf({}, Cart.prototype);
assert.deepEqual([fake instanceof Cart, Cart.isCart(fake)], [true, false]);              // instanceof обманут, # — нет
// то же замыканием
function createCounter() { let n = 0; return { inc: () => ++n, get value() { return n; } }; }
const counter = createCounter();
counter.inc(); counter.inc();
assert.equal(counter.value, 2);
assert.equal(counter.n, undefined);

// --- полиморфизм подтипов: метод ищется по цепочке прототипов во время вызова ---
class Payment { describe() { return `оплата ${this.label()}`; } label() { return 'неизвестно'; } }
class Card extends Payment { label() { return 'картой'; } }
class Cash extends Payment { label() { return 'наличными'; } }
assert.deepEqual([new Card(), new Cash(), new Payment()].map((p) => p.describe()), ['оплата картой', 'оплата наличными', 'оплата неизвестно']);
Card.prototype.label = () => 'картой онлайн';                                              // меняем метод — меняются все экземпляры
assert.equal(new Card().describe(), 'оплата картой онлайн');

// --- полиморфизм через протокол: любой объект с Symbol.iterator работает с for…of и spread ---
const range = { from: 1, to: 3, *[Symbol.iterator]() { for (let i = this.from; i <= this.to; i++) yield i; } };
assert.deepEqual([...range], [1, 2, 3]);
assert.deepEqual(Array.from(new Map([['a', 1]])), [['a', 1]]);
// и с then: await примет любой объект с методом then
assert.equal(await { then: (resolve) => resolve('как промис') }, 'как промис');

// --- хрупкий базовый класс ---
class CountingSet extends Set {
  count = 0;
  add(v) { this.count++; return super.add(v); }
}
const tags = new CountingSet(['улун', 'пуэр', 'сенча']);
assert.equal(tags.size, 3);
assert.equal(tags.count, 0);                                                                // add вызывался, но поле обнулилось после super()
tags.add('матча');
assert.equal(tags.count, 1);
// исправление: композиция, а не наследование
class CountingTags {
  #set = new Set();
  count = 0;
  constructor(items = []) { for (const x of items) this.add(x); }
  add(v) { this.count++; this.#set.add(v); return this; }
  get size() { return this.#set.size; }
  has(v) { return this.#set.has(v); }
}
const fixed = new CountingTags(['улун', 'пуэр', 'сенча']);
assert.deepEqual([fixed.size, fixed.count], [3, 3]);

// Symbol.species: методы массива-наследника возвращают наследника
class Basket extends Array { get total() { return this.reduce((s, x) => s + x, 0); } }
const basket = Basket.from([100, 200, 300]);
assert.ok(basket.filter((x) => x > 100) instanceof Basket);
assert.equal(basket.filter((x) => x > 100).total, 500);

// --- подстановка Лисков ---
class Rectangle {
  constructor(w, h) { this.w = w; this.h = h; }
  setWidth(w) { this.w = w; }
  setHeight(h) { this.h = h; }
  get area() { return this.w * this.h; }
}
class Square extends Rectangle {
  setWidth(w) { this.w = w; this.h = w; }
  setHeight(h) { this.w = h; this.h = h; }
}
function stretch(rect) { rect.setWidth(5); rect.setHeight(4); return rect.area; }   // ожидает 20
assert.equal(stretch(new Rectangle(1, 1)), 20);
assert.equal(stretch(new Square(1, 1)), 16);                                                 // подстановка сломала ожидания
// исправление: неизменяемые фигуры без иерархии «квадрат — это прямоугольник»
const rect = (w, h) => ({ w, h, area: w * h, withSize: (w2, h2) => rect(w2, h2) });
const square = (s) => ({ ...rect(s, s), withSide: (s2) => square(s2) });
assert.equal(square(1).withSize(5, 4).area, 20);

// --- композиция вместо иерархии EmailNotifier / RetryingSmsNotifier / LoggedRetryingEmailNotifier ---
const log = [];
const email = { send: async (msg) => { log.push(`email: ${msg}`); } };
let failures = 1;
const sms = { send: async (msg) => { if (failures-- > 0) throw new Error('сеть'); log.push(`sms: ${msg}`); } };
const withRetry = (n, ch) => ({ send: async (msg) => { for (let i = 0; ; i++) { try { return await ch.send(msg); } catch (e) { if (i >= n) throw e; } } } });
const withLog = (ch) => ({ send: async (msg) => { log.push(`→ ${msg}`); return ch.send(msg); } });
await withLog(withRetry(2, sms)).send('заказ собран');
await withLog(email).send('чек');
assert.deepEqual(log, ['→ заказ собран', 'sms: заказ собран', '→ чек', 'email: чек']);

console.log('oop ok');
