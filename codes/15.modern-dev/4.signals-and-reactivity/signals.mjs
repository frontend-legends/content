// Проверки к 15.04: наивная подписка против настоящих сигналов (Preact Signals и полифил TC39) —
// ромб зависимостей, ленивость computed, динамические зависимости, эффекты поверх Watcher.
import assert from 'node:assert/strict';
import { signal, computed, effect, batch } from '@preact/signals-core';
import { Signal } from 'signal-polyfill';

// --- наивная реализация: значение + список подписчиков, пересчёт сразу при записи ---
function naiveSignal(value) {
  const subs = new Set();
  return { get: () => value, set: (v) => { value = v; subs.forEach((f) => f()); }, subscribe: (f) => subs.add(f) };
}
function naiveComputed(deps, fn) {
  const out = naiveSignal(fn());
  deps.forEach((d) => d.subscribe(() => out.set(fn())));
  return out;
}
{
  // ромб: price → withTax, price → withDiscount, оба → total
  const price = naiveSignal(100);
  const withTax = naiveComputed([price], () => price.get() * 1.2);
  const discount = naiveComputed([price], () => price.get() * 0.1);
  const seen = [];
  const total = naiveComputed([withTax, discount], () => withTax.get() - discount.get());
  total.subscribe(() => seen.push(Math.round(total.get())));
  price.set(200);
  assert.deepEqual(seen, [230, 220]); // два пересчёта, и первый — несогласованный: 240 − 10 («глитч»)
}

// --- Preact Signals: один согласованный пересчёт ---
{
  const price = signal(100);
  const withTax = computed(() => price.value * 1.2);
  const discount = computed(() => price.value * 0.1);
  const total = computed(() => withTax.value - discount.value);
  const seen = [];
  const dispose = effect(() => seen.push(Math.round(total.value)));
  price.value = 200;
  assert.deepEqual(seen, [110, 220]); // начальное значение и одно новое — без промежуточного
  dispose();
}

// --- ленивость: computed не считается, пока его не читают, и кеширует результат ---
{
  let runs = 0;
  const items = signal([1200, 300]);
  const sum = computed(() => { runs++; return items.value.reduce((s, x) => s + x, 0); });
  items.value = [1200, 300, 90];
  items.value = [1200, 300, 90, 10];
  assert.equal(runs, 0);           // две записи — ноль вычислений
  assert.equal(sum.value, 1600);
  assert.equal(sum.value, 1600);
  assert.equal(runs, 1);           // два чтения — одно вычисление
}

// --- динамические зависимости: эффект зависит только от того, что прочитал в последний раз ---
{
  const showDelivery = signal(false);
  const price = signal(1200);
  const delivery = signal(300);
  let runs = 0;
  const dispose = effect(() => { runs++; showDelivery.value ? delivery.value : price.value; });
  delivery.value = 400;            // эффект не читал delivery — не перезапустился
  assert.equal(runs, 1);
  showDelivery.value = true;       // теперь читает delivery, а не price
  price.value = 1500;
  assert.equal(runs, 2);
  delivery.value = 500;
  assert.equal(runs, 3);
  dispose();
}

// --- пакет изменений: эффект один раз на несколько записей ---
{
  const a = signal(1), b = signal(2);
  let runs = 0;
  const dispose = effect(() => { runs++; a.value + b.value; });
  batch(() => { a.value = 10; b.value = 20; });
  assert.equal(runs, 2);
  dispose();
}

// --- полифил TC39: State и Computed есть, effect — нет; эффекты строят на Watcher ---
{
  const price = new Signal.State(100);
  const withTax = new Signal.Computed(() => price.get() * 1.2);
  const discount = new Signal.Computed(() => price.get() * 0.1);
  const total = new Signal.Computed(() => withTax.get() - discount.get());
  assert.equal(total.get(), 110);
  assert.equal(typeof Signal.effect, 'undefined');

  // минимальный эффект: Watcher сообщает, что что-то устарело, а пересчитываем позже
  const seen = [];
  let pending = false;
  const watcher = new Signal.subtle.Watcher(() => {
    if (pending) return; pending = true;
    queueMicrotask(() => { pending = false; for (const s of watcher.getPending()) s.get(); watcher.watch(); });
  });
  const view = new Signal.Computed(() => { seen.push(Math.round(total.get())); });
  watcher.watch(view);
  view.get();
  price.set(200);
  price.set(300);                  // две записи до микрозадачи
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen, [110, 330]); // одна согласованная перерисовка на обе записи
  assert.deepEqual(Signal.subtle.introspectSources(total).length, 2);
}

console.log('signals ok');
