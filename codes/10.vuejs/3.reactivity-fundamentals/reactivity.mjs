// Глава 10.03 — основы реактивности: ref и reactive, Proxy и идентичность, отслеживание зависимостей,
// разворачивание ref, где реактивность теряется.
// run: node reactivity.mjs
import assert from 'node:assert/strict';
import { sfc, mount } from '../../_lib/vue.mjs';   // первым: ставит jsdom до загрузки vue
import { ref, reactive, computed, watchEffect, isRef, isReactive, toRaw, toRefs, toRef, unref, nextTick } from 'vue';

// --- ref: обёртка с .value; объект внутри становится reactive
const count = ref(0);
assert.equal(isRef(count), true);
const product = { title: 'Чай', tags: ['зелёный'] };
const r = ref(product);
assert.equal(isReactive(r.value), true);
assert.notEqual(r.value, product);          // в .value — Proxy, а не исходный объект
assert.equal(toRaw(r.value), product);

// --- reactive: Proxy того же объекта, кешируется
const state = reactive(product);
assert.notEqual(state, product);
assert.equal(reactive(product), state);     // один объект — один Proxy
assert.equal(reactive(state), state);
assert.equal(isReactive(state.tags), true); // вложенное — тоже реактивно (лениво, при доступе)

// изменение исходного объекта мимо Proxy не отслеживается
let runs = 0;
watchEffect(() => { runs++; void state.title; }, { flush: 'sync' });
assert.equal(runs, 1);
product.title = 'Кофе';
assert.equal(runs, 1);
state.title = 'Улун';
assert.equal(runs, 2);

// запись того же значения не запускает эффекты
state.title = 'Улун';
assert.equal(runs, 2);

// --- зависимости собираются заново при каждом запуске
{
  const showPrice = ref(false);
  const price = ref(490);
  let n = 0;
  watchEffect(() => { n++; if (showPrice.value) void price.value; }, { flush: 'sync' });
  price.value = 500;
  assert.equal(n, 1);                // price не читался — не зависимость
  showPrice.value = true;
  assert.equal(n, 2);
  price.value = 510;
  assert.equal(n, 3);                // теперь зависимость
}

// --- Proxy видит новые свойства, удаление, индексы, длину, Map/Set
{
  const cart = reactive({ items: [], meta: {} });
  const set = reactive(new Set());
  const log = [];
  watchEffect(() => log.push(`${cart.items.length}|${cart.meta.coupon ?? '-'}|${set.size}|${'note' in cart.meta}`), { flush: 'sync' });
  cart.items[0] = 'чай';                 // запись по индексу
  cart.meta.coupon = 'SALE';             // новое свойство
  delete cart.meta.coupon;               // удаление
  set.add('tea');
  cart.items.length = 0;
  assert.deepEqual(log, ['0|-|0|false', '1|-|0|false', '1|SALE|0|false', '1|-|0|false', '1|-|1|false', '0|-|1|false']);
}

// --- разворачивание ref
{
  const qty = ref(2);
  const s = reactive({ qty });
  assert.equal(s.qty, 2);                // в reactive-объекте — разворачивается
  s.qty++;
  assert.equal(qty.value, 3);            // и связь двусторонняя
  const arr = reactive([ref(1)]);
  assert.equal(isRef(arr[0]), true);     // в массиве — нет
  const map = reactive(new Map([['a', ref(1)]]));
  assert.equal(isRef(map.get('a')), true);   // в Map — нет
  assert.equal(unref(qty), 3);
  assert.equal(unref(5), 5);
}

// в шаблоне разворачиваются ref верхнего уровня; вложенные в обычный объект — только при прямом выводе
{
  const C = await sfc(`<script setup>
import { ref } from 'vue';
const count = ref(1);
const plain = { count: ref(1) };
</script>
<template><p>{{ count + 1 }}|{{ plain.count }}|{{ plain.count + 1 }}|{{ plain.count.value + 1 }}</p></template>`);
  assert.equal((await mount(C)).text(), '2|1|[object Object]1|2');
}

// --- где реактивность теряется
{
  const user = reactive({ name: 'Аня', age: 30 });
  let { age } = user;                    // копия числа
  user.age = 31;
  assert.equal(age, 30);

  const refs = toRefs(user);
  user.age = 32;
  assert.equal(refs.age.value, 32);
  refs.age.value = 33;
  assert.equal(user.age, 33);
  const nameRef = toRef(user, 'name');
  user.name = 'Оля';
  assert.equal(nameRef.value, 'Оля');

  // переприсваивание reactive-переменной: эффект смотрит на старый Proxy
  let form = reactive({ email: '' });
  const seen = [];
  const snapshot = form;
  watchEffect(() => seen.push(snapshot.email), { flush: 'sync' });
  form = reactive({ email: 'a@b.ru' });
  assert.deepEqual(seen, ['']);           // эффект не узнал о новом объекте
  Object.assign(snapshot, { email: 'a@b.ru' });   // так — работает
  assert.deepEqual(seen, ['', 'a@b.ru']);

  // передача значения в функцию — тоже копия
  const total = ref(0);
  const double = (n) => computed(() => n * 2);
  const broken = double(total.value);
  const fine = ((src) => computed(() => src.value * 2))(total);
  total.value = 5;
  assert.equal(broken.value, 0);
  assert.equal(fine.value, 10);
}

// --- reactive не принимает примитивы
{
  const warns = [];
  const orig = console.warn; console.warn = (m) => warns.push(String(m));
  const n = reactive(5);
  console.warn = orig;
  assert.equal(n, 5);
  assert.ok(warns.some((w) => w.includes('value cannot be made reactive: 5')));
}

// --- сравнение с React: колбэк видит актуальное значение, а не снимок
{
  const n = ref(0);
  const later = new Promise((res) => setTimeout(() => res(n.value), 5));
  n.value = 3;
  assert.equal(await later, 3);
}

// --- изменение синхронное, DOM — после nextTick
{
  const C = await sfc(`<script setup>import { ref } from 'vue'; const n = ref(0); defineExpose({ n });</script><template><b>{{ n }}</b></template>`);
  const w = await mount(C);
  w.vm.n = 1;
  assert.equal(w.vm.n, 1);
  assert.equal(w.text(), '0');           // DOM ещё старый
  await nextTick();
  assert.equal(w.text(), '1');
}
console.log('reactivity ok');
