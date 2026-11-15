// Глава 7.07 — «Практика»: порядок инициализации, поле против сеттера, Reflect.construct.
// run: node practice.cjs
const assert = require('node:assert/strict');
const out = [];
class Base { name = 'base'; constructor() { out.push(this.name); this.init(); } init() { out.push('Base init'); } }
class Widget extends Base { name = 'widget'; status = 'ready'; init() { out.push(`Widget init ${this.status}`); } }
const w = new Widget();
assert.deepEqual(out, ['base', 'Widget init undefined']);
assert.equal(w.name, 'widget');

class Product { set price(v) { if (v < 0) throw new RangeError('Цена не может быть отрицательной'); this._price = v; } get price() { return this._price; } }
class Sale extends Product { price = -100; }
assert.equal(new Sale().price, -100);
class Sale2 extends Product { constructor() { super(); this.price = -100; } }
assert.throws(() => new Sale2(), RangeError);

class K { constructor(x) { this.x = x; } }
assert.throws(() => K.apply(Object.create(K.prototype), [1]), TypeError);
assert.equal(Reflect.construct(K, [1]).x, 1);
console.log('ok');
