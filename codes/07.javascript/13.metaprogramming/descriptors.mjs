// Глава 7.13 — дескрипторы свойств: значения по умолчанию у defineProperty, геттеры, freeze/seal/preventExtensions,
// неконфигурируемое свойство нельзя переопределить; Reflect возвращает boolean вместо исключения.
// run: node descriptors.mjs
import assert from 'node:assert/strict';

const product = { title: 'Чай' };
assert.deepEqual(Object.getOwnPropertyDescriptor(product, 'title'), { value: 'Чай', writable: true, enumerable: true, configurable: true });

// defineProperty: всё, что не указано, — false
Object.defineProperty(product, 'sku', { value: 'TEA-1' });
assert.deepEqual(Object.getOwnPropertyDescriptor(product, 'sku'), { value: 'TEA-1', writable: false, enumerable: false, configurable: false });
assert.deepEqual(Object.keys(product), ['title']);              // sku не перечисляется
assert.equal(JSON.stringify(product), '{"title":"Чай"}');
assert.throws(() => { product.sku = 'X'; }, TypeError);          // модуль — strict mode
assert.throws(() => Object.defineProperty(product, 'sku', { value: 'Y' }), TypeError); // неконфигурируемое
assert.equal(Reflect.defineProperty(product, 'sku', { value: 'Y' }), false);           // Reflect — без исключения

// свойство-аксессор
const order = { items: [490, 2490] };
Object.defineProperty(order, 'total', { get() { return this.items.reduce((s, p) => s + p, 0); }, enumerable: true });
assert.equal(order.total, 2980);
order.items.push(20);
assert.equal(order.total, 3000);

// уровни защиты
const ext = Object.preventExtensions({ a: 1 });
assert.throws(() => { ext.b = 2; }, TypeError);
delete ext.a; assert.equal('a' in ext, false);                  // удалять можно
const sealed = Object.seal({ a: 1 });
sealed.a = 2; assert.equal(sealed.a, 2);                        // менять можно
assert.throws(() => { delete sealed.a; }, TypeError);
const frozen = Object.freeze({ a: 1, nested: { b: 1 } });
assert.throws(() => { frozen.a = 2; }, TypeError);
frozen.nested.b = 2; assert.equal(frozen.nested.b, 2);          // поверхностно
assert.deepEqual([Object.isExtensible(ext), Object.isSealed(sealed), Object.isFrozen(frozen)], [false, true, true]);

// Reflect.ownKeys видит всё: неперечисляемые и символы
const s = Symbol('meta');
const o = { visible: 1, [s]: 2 };
Object.defineProperty(o, 'hidden', { value: 3 });
assert.deepEqual(Reflect.ownKeys(o), ['visible', 'hidden', s]);
assert.deepEqual(Object.keys(o), ['visible']);
console.log('ok');
