// Глава 10.03 — упрощённая модель реактивности из текста: Proxy + track/trigger + effect.
// run: node mini.mjs
import assert from 'node:assert/strict';

const targetMap = new WeakMap();   // объект → (ключ → множество эффектов)
let activeEffect = null;

function track(target, key) {
  if (!activeEffect) return;
  let deps = targetMap.get(target);
  if (!deps) targetMap.set(target, (deps = new Map()));
  let effects = deps.get(key);
  if (!effects) deps.set(key, (effects = new Set()));
  effects.add(activeEffect);
}

function trigger(target, key) {
  targetMap.get(target)?.get(key)?.forEach((fn) => fn());
}

function reactive(target) {
  return new Proxy(target, {
    get(t, key, receiver) {
      track(t, key);
      return Reflect.get(t, key, receiver);
    },
    set(t, key, value, receiver) {
      const old = t[key];
      const ok = Reflect.set(t, key, value, receiver);
      if (!Object.is(old, value)) trigger(t, key);
      return ok;
    },
  });
}

function effect(fn) {
  const run = () => { activeEffect = run; try { fn(); } finally { activeEffect = null; } };
  run();
}

const cart = reactive({ qty: 1, price: 490 });
const out = [];
effect(() => out.push(cart.qty * cart.price));
cart.qty = 2;
cart.price = 500;
cart.qty = 2;            // то же значение — без запуска
assert.deepEqual(out, [490, 980, 1000]);
console.log('mini ok');
