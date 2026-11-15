// Глава 7.05 — «Практика»: hoisting и TDZ в скрипте, потеря this в классе, задачка про this в модуле ES.
// run: node practice.mjs
import assert from 'node:assert/strict';
import vm from 'node:vm';

// P1 — как классический скрипт
const ctx = vm.createContext({ out: [] });
vm.runInContext(`
  const log = (...a) => out.push(a.map(String).join(' '));
  log(typeof hoisted, hoisted);
  try { log(early); } catch (e) { log(e.constructor.name); }
  try { log(typeof later); } catch (e) { log(e.constructor.name); }
  var hoisted = 1;
  let early = 2;
  const later = () => {};
  const currency = '₽';
  function format(v) { return v + ' ' + currency; }
  function invoice() { const currency = '$'; return format(10); }
  log(invoice());
`, ctx);
assert.deepEqual(ctx.out, ['undefined undefined', 'ReferenceError', 'ReferenceError', '10 ₽']);

// P2 — метод класса как слушатель
const sent = [];
const api = { send: (x) => sent.push(x) };
class Checkout { constructor(items) { this.items = items; } submit() { return api.send(this.items.map((i) => i.sku)); } }
const checkout = new Checkout([{ sku: 'tea' }]);
const button = new EventTarget();
let error;
button.addEventListener('click', function (e) { try { checkout.submit.call(this); } catch (err) { error = err; } });
button.dispatchEvent(new Event('click'));
assert.equal(error.constructor, TypeError);
button.addEventListener('click', () => checkout.submit());
button.addEventListener('click', checkout.submit.bind(checkout));
error = undefined;
button.dispatchEvent(new Event('click'));
assert.deepEqual(sent, [['tea'], ['tea']]);
class Checkout2 { constructor(items) { this.items = items; } submit = () => api.send(this.items.map((i) => i.sku)); }
const { submit } = new Checkout2([{ sku: 'pot' }]);
submit();
assert.deepEqual(sent.at(-1), ['pot']);

// P3 — модуль ES, strict mode
const shop = {
  title: 'Магазин',
  regular() { return this.title; },
  arrow: () => typeof this,
  delayed() { return [1].map(() => this.title)[0]; },
};
const { regular } = shop;
const bound = shop.regular.bind({ title: 'Кофейня' });
assert.equal(shop.regular(), 'Магазин');
assert.equal(shop.arrow(), 'undefined');
assert.equal(shop.delayed(), 'Магазин');
assert.equal(bound.call(shop), 'Кофейня');
assert.throws(() => regular(), TypeError);
console.log('ok');
