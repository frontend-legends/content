// Глава 10.13 — загрузка данных во Vue: TanStack Vue Query — реактивные ключи, общий кеш и дедупликация,
// staleTime и фоновое обновление, enabled как геттер, инвалидация после мутации, data — ref.
// run: node vue-query.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, vue } from '../../_lib/vue.mjs';
const { ref, isRef, h, defineComponent, reactive } = vue;
const { QueryClient, VueQueryPlugin, useQuery, useMutation, useQueryClient } = await import('@tanstack/vue-query');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { for (let i = 0; i < 5; i++) { await wait(5); await flush(); } };

const calls = [];
const api = { product: async (id) => { calls.push(`product ${id}`); await wait(5); return { id, title: `Товар ${id}`, price: 100 * id }; } };

function setup(Comp, props) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { client, mounted: mount(Comp, { props, plugins: [[VueQueryPlugin, { queryClient: client }]] }) };
}

// --- ключ должен быть реактивным: геттер следит за пропсом, значение — нет
{
  window.__useQuery = useQuery; window.__api = api;
  const Good = await sfc(`<script setup>
const props = defineProps({ id: Number });
const { data } = window.__useQuery({ queryKey: ['product', () => props.id], queryFn: () => window.__api.product(props.id) });
</script><template><p class="good">{{ data?.title }}</p></template>`, 'Good.vue');
  const Bad = await sfc(`<script setup>
const props = defineProps({ id: Number });
const { data } = window.__useQuery({ queryKey: ['product', props.id], queryFn: () => window.__api.product(props.id) });
</script><template><p class="bad">{{ data?.title }}</p></template>`, 'Bad.vue');
  window.__Good = Good; window.__Bad = Bad;
  const P = await sfc(`<script setup>import { ref } from 'vue'; const Good = window.__Good; const Bad = window.__Bad; const id = ref(1); defineExpose({ id });</script>
<template><Good :id="id" /><Bad :id="id" /></template>`);
  const { mounted } = setup(P);
  const w = await mounted;
  await settle();
  calls.length = 0;
  w.vm.id = 2; await settle();
  assert.equal(w.container.querySelector('.good').textContent, 'Товар 2');
  assert.equal(w.container.querySelector('.bad').textContent, 'Товар 1');   // ключ-значение не изменился
  assert.deepEqual(calls, ['product 2']);
}

// --- общий кеш: два компонента с одним ключом — один запрос; data — ref
{
  calls.length = 0;
  let dataIsRef;
  const Price = defineComponent({ props: ['id'], setup(p) { const q = useQuery({ queryKey: ['product', () => p.id], queryFn: () => api.product(p.id) }); dataIsRef = isRef(q.data); return () => h('i', q.data.value?.price ?? '…'); } });
  const P = defineComponent({ setup: () => () => h('div', [h(Price, { id: 3 }), h(Price, { id: 3 })]) });
  const { mounted } = setup(P);
  const w = await mounted; await settle();
  assert.equal(w.text(), '300300');
  assert.deepEqual(calls, ['product 3']);   // дедупликация
  assert.equal(dataIsRef, true);
}

// --- staleTime: в пределах срока — без запроса; после — показ кеша и обновление в фоне
{
  calls.length = 0;
  const show = ref(true);
  const states = [];
  const Card = defineComponent({ setup() { const q = useQuery({ queryKey: ['product', 4], queryFn: () => api.product(4), staleTime: 40 }); return () => { states.push(`${q.data.value?.title ?? '-'}|${q.isFetching.value}`); return h('b', q.data.value?.title ?? '…'); }; } });
  const P = defineComponent({ setup: () => () => (show.value ? h(Card) : h('i')) });
  const { mounted } = setup(P);
  await mounted; await settle();
  show.value = false; await flush(); show.value = true; await settle();
  assert.deepEqual(calls, ['product 4']);   // данные свежие — повторного запроса нет
  await wait(50);
  show.value = false; await flush(); states.length = 0; show.value = true; await settle();
  assert.deepEqual(calls, ['product 4', 'product 4']);
  assert.equal(states[0], 'Товар 4|true');   // сразу кешированные данные, обновление идёт в фоне
}

// --- enabled как геттер: зависимый запрос ждёт данных
{
  calls.length = 0;
  const userId = ref(null);
  const C = defineComponent({ setup() {
    const q = useQuery({ queryKey: ['orders', userId], queryFn: async () => { calls.push(`orders ${userId.value}`); return [1, 2]; }, enabled: () => userId.value !== null });
    return () => h('p', q.data.value ? q.data.value.length : 'ждём пользователя');
  } });
  const { mounted } = setup(C);
  const w = await mounted; await settle();
  assert.equal(w.text(), 'ждём пользователя');
  assert.deepEqual(calls, []);
  userId.value = 7; await settle();
  assert.equal(w.text(), '2');
  assert.deepEqual(calls, ['orders 7']);
}

// --- мутация и инвалидация
{
  let serverTitle = 'Улун';
  let fetches = 0;
  const C = defineComponent({ setup() {
    const client = useQueryClient();
    const q = useQuery({ queryKey: ['product', 9], queryFn: async () => { fetches++; return { title: serverTitle }; } });
    const m = useMutation({ mutationFn: async (t) => { serverTitle = t; }, onSuccess: () => client.invalidateQueries({ queryKey: ['product', 9] }) });
    return () => h('button', { onClick: () => m.mutate('Пуэр') }, q.data.value?.title ?? '…');
  } });
  const { mounted } = setup(C);
  const w = await mounted; await settle();
  assert.equal(w.text(), 'Улун');
  w.container.querySelector('button').click(); await settle();
  assert.equal(w.text(), 'Пуэр');
  assert.equal(fetches, 2);
}
console.log('vue query ok');
process.exit(0);   // таймеры gcTime держат процесс
