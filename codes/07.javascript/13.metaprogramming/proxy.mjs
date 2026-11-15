// Глава 7.13 — Proxy и Reflect: валидация через set, set без true в strict mode бросает, инварианты,
// receiver: без Reflect.get геттер видит target и реактивность теряет зависимости, мини-реактивность,
// Proxy над Map ломает методы, revocable.
// run: node proxy.mjs
import assert from 'node:assert/strict';

// валидация
const form = new Proxy({ qty: 1 }, {
  set(target, key, value, receiver) {
    if (key === 'qty' && (!Number.isInteger(value) || value < 1)) throw new RangeError('qty — целое ≥ 1');
    return Reflect.set(target, key, value, receiver);
  },
});
form.qty = 3;
assert.equal(form.qty, 3);
assert.throws(() => { form.qty = 0; }, RangeError);

// ловушка set должна вернуть true, иначе в strict mode — TypeError
const silent = new Proxy({}, { set() { /* забыли return true */ } });
assert.throws(() => { silent.a = 1; }, { name: 'TypeError', message: /returned falsish/ });

// инварианты: прокси не может врать про неконфигурируемое свойство
const target = {};
Object.defineProperty(target, 'id', { value: 1, writable: false, configurable: false });
const liar = new Proxy(target, { get: () => 999 });
assert.throws(() => liar.id, TypeError);

// receiver: геттер на target и цепочка прототипов
function track(useReflect) {
  const read = new Set();
  const state = { first: 'Анна', last: 'Ли', get full() { return `${this.first} ${this.last}`; } };
  const p = new Proxy(state, {
    get(t, key, receiver) { read.add(key); return useReflect ? Reflect.get(t, key, receiver) : t[key]; },
  });
  assert.equal(p.full, 'Анна Ли');
  return [...read];
}
assert.deepEqual(track(false), ['full']);                    // first и last прочитаны мимо прокси
assert.deepEqual(track(true), ['full', 'first', 'last']);    // this в геттере — прокси

// мини-реактивность на Proxy: эффект перезапускается при изменении прочитанных свойств
let activeEffect = null;
const deps = new Map();
function reactive(obj) {
  return new Proxy(obj, {
    get(t, key, r) { if (activeEffect) { if (!deps.has(key)) deps.set(key, new Set()); deps.get(key).add(activeEffect); } return Reflect.get(t, key, r); },
    set(t, key, v, r) { const ok = Reflect.set(t, key, v, r); deps.get(key)?.forEach((fn) => fn()); return ok; },
  });
}
function effect(fn) { activeEffect = fn; fn(); activeEffect = null; }
const cart = reactive({ qty: 1, price: 490, note: '' });
const renders = [];
effect(() => renders.push(cart.qty * cart.price));
cart.qty = 2;
cart.note = 'подарок';                                        // эффект не читал note — не перезапускается
assert.deepEqual(renders, [490, 980]);

// Proxy над Map: методы требуют внутренний слот у this
const mapProxy = new Proxy(new Map([['a', 1]]), {});
assert.throws(() => mapProxy.get('a'), { name: 'TypeError', message: /incompatible receiver/ });
const fixed = new Proxy(new Map([['a', 1]]), {
  get(t, key) { const v = Reflect.get(t, key, t); return typeof v === 'function' ? v.bind(t) : v; },
});
assert.equal(fixed.get('a'), 1);
assert.equal(fixed.size, 1);

// отзываемый прокси
const { proxy, revoke } = Proxy.revocable({ token: 'abc' }, {});
assert.equal(proxy.token, 'abc');
revoke();
assert.throws(() => proxy.token, TypeError);

// функция: apply и construct
const logged = new Proxy(function sum(a, b) { return a + b; }, { apply(t, thisArg, args) { return `${args.join('+')}=${Reflect.apply(t, thisArg, args)}`; } });
assert.equal(logged(1, 2), '1+2=3');
console.log('ok');
