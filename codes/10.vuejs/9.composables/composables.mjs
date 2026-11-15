// Глава 10.09 — композаблы: своё состояние на каждый вызов, общее состояние модуля, аргументы через toValue,
// очистка при размонтировании, onScopeDispose, возврат ref-ов, VueUse.
// run: node composables.mjs
import assert from 'node:assert/strict';
import { mount, flush, vue } from '../../_lib/vue.mjs';
const { h, ref, reactive, computed, watch, watchEffect, toValue, onMounted, onUnmounted, onScopeDispose, effectScope, defineComponent, isRef } = vue;
const { useStorage, refDebounced, createSharedComposable, useEventListener } = await import('@vueuse/core');

// --- каждый вызов — своё состояние
function useCounter(initial = 0) {
  const count = ref(initial);
  const inc = () => count.value++;
  return { count, inc };
}
{
  const a = useCounter(); const b = useCounter(10);
  a.inc();
  assert.deepEqual([a.count.value, b.count.value], [1, 10]);
}

// --- общее состояние: переменная на уровне модуля
const sharedCount = ref(0);
function useSharedCounter() { return { count: sharedCount, inc: () => sharedCount.value++ }; }
{
  useSharedCounter().inc(); useSharedCounter().inc();
  assert.equal(useSharedCounter().count.value, 2);
}

// --- аргумент: ref, геттер или значение; реакция на изменение аргумента
function useProduct(id, load) {
  const product = ref(null);
  watch(() => toValue(id), async (v) => { product.value = await load(v); }, { immediate: true });
  return { product };
}
{
  const calls = [];
  const load = async (id) => { calls.push(id); return { id }; };
  const id = ref(1);
  const { product } = useProduct(id, load);
  await flush();
  id.value = 2; await flush();
  assert.deepEqual(calls, [1, 2]);
  assert.equal(product.value.id, 2);
  const props = reactive({ id: 5 });
  useProduct(() => props.id, load);
  await flush();
  props.id = 6; await flush();
  assert.deepEqual(calls.slice(2), [5, 6]);
  useProduct(9, load); await flush();
  assert.equal(calls.at(-1), 9);
}

// --- очистка при размонтировании
function useWindowEvent(type, handler) {
  onMounted(() => window.addEventListener(type, handler));
  onUnmounted(() => window.removeEventListener(type, handler));
}
{
  let hits = 0;
  const C = defineComponent({ setup() { useWindowEvent('resize', () => hits++); return () => h('p'); } });
  const w = await mount(C);
  window.dispatchEvent(new Event('resize'));
  w.unmount();
  window.dispatchEvent(new Event('resize'));
  assert.equal(hits, 1);
}

// --- onScopeDispose работает и в компоненте, и в effectScope вне компонента
function useInterval(fn, ms) {
  const id = setInterval(fn, ms);
  onScopeDispose(() => clearInterval(id));
}
{
  let ticks = 0;
  const scope = effectScope();
  scope.run(() => useInterval(() => ticks++, 5));
  await new Promise((r) => setTimeout(r, 18));
  scope.stop();
  const after = ticks;
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(after > 0);
  assert.equal(ticks, after);
}

// --- возврат: объект ref-ов переживает деструктуризацию; reactive() разворачивает для доступа через точку
{
  const { count, inc } = useCounter();
  inc();
  assert.equal(count.value, 1);
  const counter = reactive(useCounter(5));
  counter.inc();
  assert.equal(counter.count, 6);       // без .value
  // а reactive-объект в возврате теряется при деструктуризации
  function useBroken() { const state = reactive({ n: 0 }); return state; }
  const { n } = useBroken();
  assert.equal(isRef(n), false);
}

// --- VueUse: useStorage синхронизирует с localStorage, refDebounced откладывает
{
  const theme = useStorage('theme', 'light');
  theme.value = 'dark';
  await flush();
  assert.equal(localStorage.getItem('theme'), 'dark');

  const query = ref('');
  const debounced = refDebounced(query, 20);
  query.value = 'ч'; query.value = 'ча'; query.value = 'чай';
  assert.equal(debounced.value, '');
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(debounced.value, 'чай');

  // createSharedComposable: одно состояние на всех потребителей
  let created = 0;
  const useClock = createSharedComposable(() => { created++; return { now: ref(Date.now()) }; });
  const scope = effectScope();
  scope.run(() => { useClock(); useClock(); });
  assert.equal(created, 1);
  scope.stop();

  // useEventListener снимает слушатель сам
  let clicks = 0;
  const C = defineComponent({ setup() { useEventListener(window, 'click', () => clicks++); return () => h('p'); } });
  const w = await mount(C);
  window.dispatchEvent(new Event('click'));
  w.unmount();
  window.dispatchEvent(new Event('click'));
  assert.equal(clicks, 1);
}
console.log('composables ok');
