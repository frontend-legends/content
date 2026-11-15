// Глава 10.10 — продвинутая реактивность: shallowRef и triggerRef, readonly, toRaw и markRaw (#private в Proxy),
// customRef, effectScope, очередь обновлений и nextTick, защита от бесконечного цикла.
// run: node advanced.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings, vue } from '../../_lib/vue.mjs';
const { ref, shallowRef, shallowReactive, triggerRef, reactive, readonly, shallowReadonly, isReactive, isReadonly, toRaw, markRaw, customRef, effectScope, onScopeDispose, watch, watchEffect, nextTick, h, defineComponent, onUpdated } = vue;

// --- shallowRef: отслеживается только замена .value
{
  const rows = shallowRef([{ id: 1 }]);
  let runs = 0;
  watchEffect(() => { runs++; void rows.value.length; }, { flush: 'sync' });
  rows.value.push({ id: 2 });
  assert.equal(runs, 1);                 // мутация не замечена
  rows.value = [...rows.value, { id: 3 }];
  assert.equal(runs, 2);
  rows.value.push({ id: 4 });
  triggerRef(rows);                      // ручной запуск после мутации
  assert.equal(runs, 3);
  assert.equal(isReactive(rows.value[0]), false);
}

// --- shallowReactive: реактивен только верхний уровень
{
  const s = shallowReactive({ filters: { q: '' }, page: 1 });
  let runs = 0;
  watchEffect(() => { runs++; void s.page; void s.filters.q; }, { flush: 'sync' });
  s.filters.q = 'чай';
  assert.equal(runs, 1);
  s.page = 2;
  assert.equal(runs, 2);
}

// --- readonly глубокий, shallowReadonly — нет; readonly над reactive следует за источником
{
  const src = reactive({ user: { name: 'Аня' } });
  const ro = readonly(src);
  assert.equal(isReadonly(ro.user), true);
  const before = warnings.length;
  ro.user.name = 'x';
  assert.equal(src.user.name, 'Аня');
  assert.ok(warnings.slice(before).some((m) => m.includes('target is readonly')));
  src.user.name = 'Оля';
  assert.equal(ro.user.name, 'Оля');     // это вид на источник, а не копия
  const sro = shallowReadonly({ user: { name: 'Аня' } });
  sro.user.name = 'Оля';
  assert.equal(sro.user.name, 'Оля');
}

// --- toRaw; reactive-массив находит исходный объект через includes
{
  const raw = { id: 1 };
  const list = reactive([raw]);
  assert.notEqual(list[0], raw);
  assert.equal(toRaw(list[0]), raw);
  assert.equal(list.includes(raw), true);   // Vue сравнивает и с исходными объектами
  assert.equal(list.indexOf(raw), 0);
}

// --- класс с приватными полями ломается в Proxy; markRaw спасает
{
  class Map3D {
    #zoom = 1;
    zoomIn() { this.#zoom++; return this.#zoom; }
  }
  const state = reactive({ map: new Map3D() });
  assert.throws(() => state.map.zoomIn(), TypeError);   // this — Proxy, у него нет #zoom
  const safe = reactive({ map: markRaw(new Map3D()) });
  assert.equal(safe.map.zoomIn(), 2);
  assert.equal(isReactive(safe.map), false);
}

// --- customRef: значение с задержкой
function useDebouncedRef(value, delay) {
  let timer;
  return customRef((track, trigger) => ({
    get() { track(); return value; },
    set(v) { clearTimeout(timer); timer = setTimeout(() => { value = v; trigger(); }, delay); },
  }));
}
{
  const q = useDebouncedRef('', 15);
  const seen = [];
  watch(q, (v) => seen.push(v));
  q.value = 'ч'; q.value = 'ча'; q.value = 'чай';
  assert.equal(q.value, '');
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
  assert.deepEqual(seen, ['чай']);
}

// --- effectScope: остановить всё разом, вложенные области, detached
{
  const n = ref(0); let a = 0, b = 0, c = 0, disposed = 0;
  const scope = effectScope();
  let detached;
  scope.run(() => {
    watch(n, () => a++, { flush: 'sync' });
    effectScope().run(() => watch(n, () => b++, { flush: 'sync' }));   // вложенная — остановится с родителем
    detached = effectScope(true);
    detached.run(() => watch(n, () => c++, { flush: 'sync' }));        // отсоединённая — нет
    onScopeDispose(() => disposed++);
  });
  n.value++;
  scope.stop();
  n.value++;
  assert.deepEqual([a, b, c, disposed], [1, 1, 2, 1]);
  detached.stop();
}

// --- очередь: pre-наблюдатели → рендер родителя и детей → post-колбэки; одна перерисовка на пачку
{
  const log = [];
  const n = ref(0);
  const Child = defineComponent({ props: ['v'], setup(p) { onUpdated(() => log.push('child updated')); return () => { log.push('child render'); return h('i', p.v); }; } });
  const Parent = defineComponent({
    setup() {
      watch(n, () => log.push('watch pre'));
      watch(n, () => log.push('watch post'), { flush: 'post' });
      onUpdated(() => log.push('parent updated'));
      return () => { log.push('parent render'); return h('div', h(Child, { v: n.value })); };
    },
  });
  await mount(Parent);
  log.length = 0;
  n.value++; n.value++;
  log.push('sync code done');
  await nextTick();
  log.push('after nextTick');
  assert.deepEqual(log, ['sync code done', 'watch pre', 'parent render', 'child render', 'watch post', 'child updated', 'parent updated', 'after nextTick']);
}

// --- nextTick: DOM после изменения
{
  const C = await sfc(`<script setup>import { ref } from 'vue'; const items = ref([1]); const list = ref(null); defineExpose({ items, list });</script>
<template><ul ref="list"><li v-for="i in items" :key="i">{{ i }}</li></ul></template>`);
  const w = await mount(C);
  w.vm.items.push(2);
  assert.equal(w.vm.list.children.length, 1);
  await nextTick();
  assert.equal(w.vm.list.children.length, 2);
}

// --- бесконечный цикл обновлений обрывается
{
  const before = warnings.length;
  const C = defineComponent({
    setup() {
      const n = ref(0);
      watch(n, () => { n.value++; });   // наблюдатель меняет свой источник
      return { n };
    },
    render() { return h('b', this.n); },
  });
  const w = await mount(C);
  const errs = [];
  // ошибка планировщика без экземпляра: в режиме разработки она выбрасывается наружу
  const onErr = (e) => errs.push(e.message);
  process.on('uncaughtException', onErr);
  w.vm.n++;
  // nextTick здесь не ждём: промис очереди не разрешится, если очередь оборвалась ошибкой
  await new Promise((r) => setTimeout(r, 20));
  process.off('uncaughtException', onErr);
  const all = [...warnings.slice(before), ...errs].join('\n');
  assert.match(all, /Maximum recursive updates exceeded/);
}
console.log('advanced ok');
