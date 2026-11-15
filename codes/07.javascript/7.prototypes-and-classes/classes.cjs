// Глава 7.07 — классы: вызов без new, методы неперечисляемые, super до this, порядок инициализации,
// поля определяются (а не присваиваются) и не вызывают сеттер базового класса, статика наследуется,
// #private: проверка «бренда», Proxy ломает доступ.
// run: node classes.cjs
const assert = require('node:assert/strict');

class Product {
  static count = 0;
  constructor(title, price) { this.title = title; this.price = price; Product.count++; }
  describe() { return `${this.title}: ${this.price} ₽`; }
  get label() { return this.title.toUpperCase(); }
}
assert.throws(() => Product('x', 1), { message: "Class constructor Product cannot be invoked without 'new'" });
assert.deepEqual(Object.keys(Product.prototype), []);              // методы не перечисляются
assert.equal(typeof Product, 'function');
assert.equal(new Product('Чай', 490).label, 'ЧАЙ');

class Digital extends Product {
  constructor(title, price, url) { super(title, price); this.url = url; }
  describe() { return `${super.describe()} (скачать)`; }
}
const ebook = new Digital('Книга', 300, '/b');
assert.equal(ebook.describe(), 'Книга: 300 ₽ (скачать)');
assert.equal(Object.getPrototypeOf(Digital), Product);            // статика наследуется
assert.equal(Digital.count, 2);
assert.equal(Object.getPrototypeOf(Digital.prototype), Product.prototype);

// this до super() — ошибка
class Broken extends Product { constructor() { this.x = 1; super('a', 1); } }
assert.throws(() => new Broken(), { name: 'ReferenceError', message: "Must call super constructor in derived class before accessing 'this' or returning from derived constructor" });

// порядок: поля базового → конструктор базового → поля наследника → конструктор наследника
const log = [];
class Base {
  baseField = log.push('base field');
  constructor() { log.push('base ctor'); this.init(); }
  init() { log.push('base init'); }
}
class Child extends Base {
  childField = (log.push('child field'), 'ready');
  constructor() { super(); log.push('child ctor'); }
  init() { log.push(`child init sees ${this.childField}`); }
}
new Child();
assert.deepEqual(log, ['base field', 'base ctor', 'child init sees undefined', 'child field', 'child ctor']);

// поле объявляется через defineProperty — сеттер базового класса не вызывается
class WithSetter { set price(v) { this._validated = v >= 0; } }
class FieldOverrides extends WithSetter { price = -1; }
class AssignsInCtor extends WithSetter { constructor() { super(); this.price = -1; } }
assert.equal(new FieldOverrides()._validated, undefined);          // сеттер пропущен, своё свойство
assert.equal(Object.hasOwn(new FieldOverrides(), 'price'), true);
assert.equal(new AssignsInCtor()._validated, false);               // присваивание вызвало сеттер

// #private: проверка бренда и Proxy
class Wallet {
  #balance = 0;
  deposit(v) { this.#balance += v; return this.#balance; }
  static isWallet(o) { return #balance in o; }
}
const w = new Wallet();
assert.equal(w.deposit(100), 100);
assert.equal(Wallet.isWallet(w), true);
assert.equal(Wallet.isWallet({}), false);
assert.equal(Object.keys(w).length, 0);
assert.throws(() => Wallet.prototype.deposit.call({}, 1), TypeError);
const proxied = new Proxy(w, {});
assert.throws(() => proxied.deposit(1), { name: 'TypeError', message: /Cannot read private member #balance from an object whose class did not declare it/ });
console.log('ok');
