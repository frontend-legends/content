// Глава 10.18 — тестирование Vue: Vue Test Utils (асинхронные trigger и setValue, emitted, v-model, shallowMount,
// плагины, Teleport), flushPromises, Testing Library для Vue, тест композабла, wrapper.vm и закрытый компонент.
// run: node testing.mjs
import assert from 'node:assert/strict';
import { sfc, vue } from '../../_lib/vue.mjs';
const { mount, shallowMount, flushPromises } = await import('@vue/test-utils');
const TL = await import('@testing-library/vue');
const { ref, effectScope, nextTick, h, defineComponent } = vue;
const { createPinia, defineStore } = await import('pinia');
const { createRouter, createMemoryHistory } = await import('vue-router');

const reg = (n, c) => (window[n] = c);
const QtyStepper = await sfc(`<script setup>
const qty = defineModel({ type: Number, default: 1 });
const emit = defineEmits(['limit']);
const props = defineProps({ max: { type: Number, default: 3 } });
const note = defineModel('note', { default: '' });
function inc() { if (qty.value >= props.max) { emit('limit', props.max); return; } qty.value++; }
</script>
<template>
<button aria-label="Больше" @click="inc">+</button>
<output>{{ qty }}</output>
<input aria-label="Комментарий" v-model="note">
</template>`, 'QtyStepper.vue');

// --- trigger асинхронный: без await DOM ещё старый
{
  const w = mount(QtyStepper);
  w.find('button').trigger('click');
  assert.equal(w.find('output').text(), '1');
  await nextTick();
  assert.equal(w.find('output').text(), '2');
  await w.find('button').trigger('click');          // с await — уже обновлён
  assert.equal(w.find('output').text(), '3');
}

// --- emitted: контракт компонента
{
  const w = mount(QtyStepper, { props: { modelValue: 3, max: 3 } });
  await w.find('button').trigger('click');
  assert.deepEqual(w.emitted('limit'), [[3]]);
  assert.equal(w.emitted('update:modelValue'), undefined);
}

// --- v-model: родитель обновляет проп в ответ на событие
{
  const w = mount(QtyStepper, { props: { modelValue: 1, 'onUpdate:modelValue': (v) => w.setProps({ modelValue: v }) } });
  await w.find('button').trigger('click');
  assert.equal(w.props('modelValue'), 2);
  assert.equal(w.find('output').text(), '2');
  await w.find('input').setValue('позвонить');
  assert.deepEqual(w.emitted('update:note'), [['позвонить']]);
}

// --- wrapper.vm видит внутреннее состояние даже закрытого script setup — тест на реализацию
{
  const src = `<script setup>import { ref } from 'vue'; const secret = ref(42);</script><template><p>{{ secret }}</p></template>`;
  const devBuild = await sfc(src, 'ClosedDev.vue', { dev: true });       // как в Vitest и dev-сервере
  assert.equal(mount(devBuild).vm.secret, 42);
  const prodBuild = await sfc(src, 'ClosedProd.vue');                    // как в продакшен-сборке: шаблон встроен в setup
  assert.equal(mount(prodBuild).vm.secret, undefined);
}

// --- shallowMount заменяет детей заглушками
{
  reg('__Heavy', await sfc(`<template><canvas class="chart" /></template>`, 'HeavyChart.vue'));
  const Page = await sfc(`<script setup>const HeavyChart = window.__Heavy;</script><template><h1>Отчёт</h1><HeavyChart :points="[1, 2]" /></template>`, 'Report.vue');
  const full = mount(Page);
  assert.ok(full.find('canvas.chart').exists());
  const shallow = shallowMount(Page);
  assert.equal(shallow.find('canvas').exists(), false);
  assert.match(shallow.html(), /<heavy-chart-stub points="1,2"><\/heavy-chart-stub>/);
}

// --- плагины: Pinia и роутер передаются через global.plugins
{
  const useCart = defineStore('cart', () => ({ count: ref(2) }));
  window.__useCart = useCart;
  const Badge = await sfc(`<script setup>import { useRoute } from 'vue-router'; const cart = window.__useCart(); const route = useRoute();</script>
<template><span>{{ cart.count }} · {{ route.path }}</span></template>`, 'Badge.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/cart', component: { render: () => null } }] });
  router.push('/cart'); await router.isReady();
  const w = mount(Badge, { global: { plugins: [createPinia(), router] } });
  assert.equal(w.text(), '2 · /cart');
}

// --- Teleport: содержимое вне обёртки компонента
{
  const Modal = await sfc(`<template><Teleport to="body"><div role="dialog">Окно</div></Teleport></template>`, 'TModal.vue');
  const w = mount(Modal, { attachTo: document.body });
  assert.equal(w.find('[role=dialog]').exists(), false);           // в обёртке его нет
  assert.ok(document.body.querySelector('[role=dialog]'));         // он в body
  w.unmount();
  const stubbed = mount(Modal, { global: { stubs: { teleport: true } } });
  assert.ok(stubbed.find('[role=dialog]').exists());               // заглушка рисует на месте
}

// --- flushPromises: дождаться промисов, а не одного тика
{
  const Product = await sfc(`<script setup>
import { ref, onMounted } from 'vue';
const title = ref('…');
onMounted(async () => { const r = await window.__api(); title.value = r.title; });
</script><template><h1>{{ title }}</h1></template>`, 'ProductT.vue');
  window.__api = () => Promise.resolve({ json: () => Promise.resolve({ title: 'Улун' }) }).then((r) => r.json());
  const w = mount(Product);
  await nextTick();
  assert.equal(w.text(), '…');                                     // одного тика мало: цепочка промисов
  await flushPromises();
  assert.equal(w.text(), 'Улун');
}

// --- Testing Library: поиск по ролям и подписям, fireEvent асинхронный
{
  TL.render(QtyStepper, { props: { modelValue: 1 } });
  const btn = TL.screen.getByRole('button', { name: 'Больше' });
  await TL.fireEvent.click(btn);
  assert.equal(TL.screen.getByRole('status').textContent, '2');    // <output> — роль status
  assert.ok(TL.screen.getByLabelText('Комментарий'));
  TL.cleanup();
}

// --- композабл: реактивную часть можно проверить в effectScope
function useCounter(max) {
  const n = ref(0);
  const inc = () => { if (n.value < max) n.value++; };
  return { n, inc };
}
{
  const scope = effectScope();
  const { n, inc } = scope.run(() => useCounter(2));
  inc(); inc(); inc();
  assert.equal(n.value, 2);
  scope.stop();
}
// композабл с хуками жизненного цикла — через компонент-хозяина
function withSetup(composable) {
  let result;
  const w = mount(defineComponent({ setup() { result = composable(); return () => h('div'); } }));
  return [result, w];
}
{
  const [res, w] = withSetup(() => { const mounted = ref(false); vue.onMounted(() => { mounted.value = true; }); return { mounted }; });
  assert.equal(res.mounted.value, true);
  w.unmount();
}
console.log('testing ok');
