// Глава 10.05 — computed и наблюдатели: ленивость и кеш, стабильность значения, источники watch,
// deep и immediate, watchEffect и await, flush, очистка и гонки, остановка и пауза.
// run: node computed-watch.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings, vue } from '../../_lib/vue.mjs';
const { ref, reactive, computed, watch, watchEffect, nextTick, effectScope, onWatcherCleanup } = vue;

// --- computed ленив и кеширует
{
  let calls = 0;
  const items = ref([1, 2, 3]);
  const total = computed(() => { calls++; return items.value.reduce((s, x) => s + x, 0); });
  assert.equal(calls, 0);                 // не вычислен, пока не прочитан
  assert.equal(total.value, 6); assert.equal(total.value, 6);
  assert.equal(calls, 1);                 // второе чтение — из кеша
  items.value.push(4);
  assert.equal(calls, 1);                 // изменение зависимости не пересчитывает сразу
  assert.equal(total.value, 10);
  assert.equal(calls, 2);
}

// --- метод в шаблоне вызывается на каждый рендер, computed — нет
{
  window.__calls = { method: 0, computed: 0 };
  const C = await sfc(`<script setup>
import { ref, computed } from 'vue';
const items = ref([1, 2]); const other = ref(0);
const totalC = computed(() => { window.__calls.computed++; return items.value.length; });
function totalM() { window.__calls.method++; return items.value.length; }
defineExpose({ other });
</script>
<template><p>{{ totalC }} {{ totalM() }} {{ other }}</p></template>`);
  const w = await mount(C);
  w.vm.other++; await flush(); w.vm.other++; await flush();
  assert.deepEqual(window.__calls, { method: 3, computed: 1 });
}

// --- computed оповещает зависимых, только если значение изменилось (3.4+)
{
  const n = ref(1);
  const isEven = computed(() => n.value % 2 === 0);
  let runs = 0;
  watchEffect(() => { runs++; void isEven.value; }, { flush: 'sync' });
  n.value = 3;                            // isEven по-прежнему false
  assert.equal(runs, 1);
  n.value = 4;
  assert.equal(runs, 2);
  // новый объект каждый раз — всегда «изменился»; previous помогает вернуть прежний
  const filters = ref({ q: 'чай', page: 1 });
  const query = computed((prev) => {
    const next = { q: filters.value.q };
    return prev && prev.q === next.q ? prev : next;
  });
  const first = query.value;
  filters.value = { q: 'чай', page: 2 };
  assert.equal(query.value, first);
}

// --- writable computed
{
  const first = ref('Анна'); const last = ref('Иванова');
  const full = computed({ get: () => `${first.value} ${last.value}`, set: (v) => { [first.value, last.value] = v.split(' '); } });
  full.value = 'Ольга Петрова';
  assert.deepEqual([first.value, last.value], ['Ольга', 'Петрова']);
}

// --- источники watch
{
  const state = reactive({ count: 0, user: { name: 'Аня' } });
  const before = warnings.length;
  watch(state.count, () => {});           // число, а не источник
  assert.ok(warnings.slice(before).some((m) => m.includes('Invalid watch source')));

  const log = [];
  watch(() => state.count, (v, old) => log.push(`getter ${old}->${v}`));
  watch(state, (v, old) => log.push(`reactive same=${v === old}`));   // reactive — глубоко, и v === old
  watch(() => state.user, () => log.push('user shallow'));             // геттер объекта — только замена
  watch(() => state.user, () => log.push('user deep'), { deep: true });
  state.count++;
  state.user.name = 'Оля';
  await nextTick();
  assert.deepEqual(log.sort(), ['getter 0->1', 'reactive same=true', 'user deep'].sort());
}

// --- immediate и once
{
  const q = ref('');
  const log = [];
  watch(q, (v) => log.push(`imm:${v}`), { immediate: true });
  watch(q, (v) => log.push(`once:${v}`), { once: true });
  q.value = 'a'; await nextTick();
  q.value = 'b'; await nextTick();
  assert.deepEqual(log, ['imm:', 'imm:a', 'once:a', 'imm:b']);
}

// --- несколько изменений до flush — один вызов колбэка
{
  const n = ref(0); let calls = 0;
  watch(n, () => calls++);
  n.value++; n.value++; n.value++;
  await nextTick();
  assert.equal(calls, 1);
  let syncCalls = 0;
  watch(n, () => syncCalls++, { flush: 'sync' });
  n.value++; n.value++;
  assert.equal(syncCalls, 2);
}

// --- watchEffect отслеживает только то, что прочитано до первого await
{
  const id = ref(1); const lang = ref('ru');
  const runs = [];
  watchEffect(async () => {
    const currentId = id.value;
    await Promise.resolve();
    runs.push(`${currentId}:${lang.value}`);   // lang прочитан после await — не зависимость
  });
  await flush();
  lang.value = 'en'; await flush();
  id.value = 2; await flush();
  assert.deepEqual(runs, ['1:ru', '2:en']);
}

// --- flush: pre видит старый DOM, post — новый
{
  const C = await sfc(`<script setup>
import { ref, watch } from 'vue';
const n = ref(0); const el = ref(null); const seen = [];
watch(n, () => seen.push('pre:' + el.value.textContent));
watch(n, () => seen.push('post:' + el.value.textContent), { flush: 'post' });
defineExpose({ n, seen });
</script>
<template><b ref="el">{{ n }}</b></template>`);
  const w = await mount(C);
  w.vm.n = 1; await flush();
  assert.deepEqual(w.vm.seen, ['pre:0', 'post:1']);
}

// --- очистка: устаревший запрос отменяется
{
  const query = ref('ч');
  const results = [];
  const aborted = [];
  const search = (q, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(`результаты для ${q}`), q === 'ч' ? 30 : 5);
    signal.addEventListener('abort', () => { clearTimeout(t); aborted.push(q); reject(new Error('aborted')); });
  });
  watch(query, async (q) => {
    const ctrl = new AbortController();
    onWatcherCleanup(() => ctrl.abort());
    try { results.push(await search(q, ctrl.signal)); } catch {}
  }, { immediate: true });
  await nextTick();
  query.value = 'чай';
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(results, ['результаты для чай']);   // ответ на «ч» не перезаписал новый
  assert.deepEqual(aborted, ['ч']);
}

// --- без очистки — гонка: медленный старый ответ перезаписывает новый
{
  const query = ref('ч'); let shown = '';
  const search = (q) => new Promise((r) => setTimeout(() => r(q), q === 'ч' ? 30 : 5));
  watch(query, async (q) => { shown = await search(q); }, { immediate: true });
  await nextTick(); query.value = 'чай';
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(shown, 'ч');
}

// --- остановка, пауза; наблюдатель вне setup живёт, пока его не остановят
{
  const n = ref(0); let calls = 0;
  const handle = watch(n, () => calls++, { flush: 'sync' });
  n.value++;
  handle.pause(); n.value++; n.value++;
  assert.equal(calls, 1);                 // на паузе колбэк не вызывается
  handle.resume();
  assert.equal(calls, 2);                 // при возобновлении пропущенное изменение доставляется один раз
  n.value++;
  handle.stop(); n.value++;
  assert.equal(calls, 3);

  const scope = effectScope(); let scoped = 0;
  scope.run(() => watch(n, () => scoped++, { flush: 'sync' }));
  n.value++; scope.stop(); n.value++;
  assert.equal(scoped, 1);
}

// --- наблюдатель, созданный в setup синхронно, останавливается вместе с компонентом
{
  window.__src = ref(0); window.__hits = 0;
  const C = await sfc(`<script setup>
import { watch } from 'vue';
watch(window.__src, () => window.__hits++);
</script><template><p/></template>`);
  const w = await mount(C);
  window.__src.value++; await flush();
  w.unmount();
  window.__src.value++; await flush();
  assert.equal(window.__hits, 1);
}
console.log('computed and watchers ok');
