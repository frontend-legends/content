// Глава 7.07 — прототипы: поиск по цепочке, запись создаёт своё свойство, сеттер и read-only на прототипе,
// prototype против [[Prototype]], своя реализация new, Object.create(null), instanceof и realm.
// run: node prototypes.cjs
'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');

const product = { currency: '₽', format() { return `${this.price} ${this.currency}`; } };
const tea = Object.create(product);
tea.price = 490;
assert.equal(tea.format(), '490 ₽');                 // метод найден на прототипе, this — tea
assert.equal(Object.hasOwn(tea, 'format'), false);
assert.equal('format' in tea, true);
assert.deepEqual(Object.keys(tea), ['price']);

// запись не идёт в прототип — создаётся своё свойство, которое затеняет
tea.currency = '$';
assert.equal(product.currency, '₽');
assert.equal(tea.format(), '490 $');

// но если на прототипе сеттер — запись вызовет его; если свойство read-only — запись запрещена
const base = {
  set discount(v) { this._discount = Math.min(v, 50); },
  get discount() { return this._discount ?? 0; },
};
const item = Object.create(base);
item.discount = 80;
assert.equal(item.discount, 50);
assert.equal(Object.hasOwn(item, 'discount'), false);
const frozenProto = Object.freeze({ currency: '₽' });
const child = Object.create(frozenProto);
assert.throws(() => { child.currency = '$'; }, TypeError);   // «override mistake»: в strict mode — ошибка
Object.defineProperty(child, 'currency', { value: '$' });    // обойти можно только defineProperty
assert.equal(child.currency, '$');

// prototype — свойство функции, [[Prototype]] — у каждого объекта
function Product(title) { this.title = title; }
Product.prototype.describe = function () { return `Товар: ${this.title}`; };
const p = new Product('Чайник');
assert.equal(Object.getPrototypeOf(p), Product.prototype);
assert.equal(p.__proto__, Product.prototype);
assert.equal(Product.prototype.constructor, Product);
assert.equal(Object.getPrototypeOf(Product.prototype), Object.prototype);
assert.equal(Object.getPrototypeOf(Object.prototype), null);
assert.equal((() => {}).prototype, undefined);

// new по шагам
function myNew(Ctor, ...args) {
  const obj = Object.create(Ctor.prototype);
  const result = Ctor.apply(obj, args);
  return result !== null && (typeof result === 'object' || typeof result === 'function') ? result : obj;
}
const p2 = myNew(Product, 'Кружка');
assert.equal(p2.describe(), 'Товар: Кружка');
assert.ok(p2 instanceof Product);
function ReturnsObject() { this.a = 1; return { b: 2 }; }
function ReturnsPrimitive() { this.a = 1; return 42; }
assert.deepEqual(new ReturnsObject(), { b: 2 });
assert.deepEqual(myNew(ReturnsObject), { b: 2 });
assert.equal(new ReturnsPrimitive().a, 1);

// объект без прототипа
const dict = Object.create(null);
assert.equal(dict.toString, undefined);
assert.equal(dict instanceof Object, false);

// instanceof идёт по цепочке; массив из другого realm — не instanceof Array
assert.ok(p instanceof Object);
const foreign = vm.runInNewContext('[1, 2]');
assert.equal(foreign instanceof Array, false);
assert.equal(Array.isArray(foreign), true);
class Even { static [Symbol.hasInstance](n) { return n % 2 === 0; } }
assert.equal(4 instanceof Even, true);
console.log('ok');
