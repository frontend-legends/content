// Глава 7.05 — this: вызов без объекта, метод, потеря контекста, call/apply/bind, приоритет new над bind,
// стрелки, методы классов в strict mode, поле-стрелка в классе.
// run: node this.cjs
const assert = require('node:assert/strict');

// обычный вызов: в strict mode undefined, в sloppy — глобальный объект
function sloppyThis() { return this; }
function strictThis() { 'use strict'; return this; }
assert.equal(sloppyThis(), globalThis);
assert.equal(strictThis(), undefined);

// метод: this — объект перед точкой; потеря при извлечении
const cart = {
  items: ['tea'],
  count() { return this.items.length; },
};
assert.equal(cart.count(), 1);
const count = cart.count;
assert.throws(() => count(), TypeError);           // this === globalThis, items нет
assert.throws(() => [1].forEach(cart.count), TypeError);

// call и apply вызывают сразу, bind возвращает новую функцию
function label(prefix, suffix) { return `${prefix}${this.name}${suffix}`; }
const product = { name: 'Чай' };
assert.equal(label.call(product, '[', ']'), '[Чай]');
assert.equal(label.apply(product, ['[', ']']), '[Чай]');
const bound = label.bind(product, '<');
assert.equal(bound('>'), '<Чай>');
// bind навсегда: повторный bind и call не меняют this
assert.equal(bound.bind({ name: 'Кофе' })('>'), '<Чай>');
assert.equal(bound.call({ name: 'Кофе' }, '>'), '<Чай>');
assert.equal(bound.name, 'bound label');

// new сильнее bind: создаётся новый объект, а аргументы bind сохраняются
function Item(title) { this.title = title; }
const BoundItem = Item.bind({ title: 'ignored' }, 'Кружка');
const it = new BoundItem();
assert.equal(it.title, 'Кружка');
assert.ok(it instanceof Item);

// стрелка берёт this снаружи, и call его не меняет
const shop = {
  name: 'Магазин',
  later() { return [1].map(() => this.name)[0]; },
  arrowMethod: () => typeof this,
};
assert.equal(shop.later(), 'Магазин');
assert.equal(shop.arrowMethod(), 'object'); // this модуля CommonJS — module.exports, а не shop
const arrow = () => this;
assert.equal(arrow.call({ x: 1 }), module.exports);

// тело класса всегда strict: извлечённый метод получает undefined; поле-стрелка привязано к экземпляру
class Counter {
  n = 0;
  inc() { this.n++; return this.n; }
  incArrow = () => { this.n++; return this.n; };
}
const c = new Counter();
const { inc, incArrow } = c;
assert.throws(() => inc(), { name: 'TypeError', message: "Cannot read properties of undefined (reading 'n')" });
assert.equal(incArrow(), 1);
assert.notEqual(new Counter().incArrow, new Counter().incArrow); // своя функция у каждого экземпляра
assert.equal(new Counter().inc, new Counter().inc);             // метод общий, на прототипе
console.log('ok');
