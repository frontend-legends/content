// Глава 10.08 — provide/inject: ближайший провайдер, inject ищет у предков, реактивность значения,
// readonly и мутатор, значения по умолчанию, уровень приложения, точечные обновления потребителей.
// run: node provide-inject.mjs
import assert from 'node:assert/strict';
import { mount, flush, warnings, vue } from '../../_lib/vue.mjs';
const { h, ref, reactive, readonly, provide, inject, defineComponent, createApp, onUpdated } = vue;

const Show = (key, fallback) => defineComponent({ setup() { const v = inject(key, fallback); return () => h('i', String(typeof v === 'object' && v !== null && 'value' in v ? v.value : v)); } });

// --- ближайший провайдер побеждает; провайдер не видит своё значение
{
  let selfInjected;
  const Middle = defineComponent({
    setup(_, { slots }) {
      selfInjected = inject('theme');     // ищет у предков, а не у себя
      provide('theme', 'dark');
      return () => h('div', slots.default());
    },
  });
  const Root = defineComponent({ setup() { provide('theme', 'light'); return () => h('div', [h(Show('theme')), h(Middle, null, { default: () => h(Show('theme')) })]); } });
  const w = await mount(Root);
  assert.equal(w.text(), 'lightdark');
  assert.equal(selfInjected, 'light');
}

// --- реактивность: ref реактивен, .value и обычный объект — нет
{
  const count = ref(1);
  const Root = defineComponent({
    setup() {
      provide('asRef', count);
      provide('asValue', count.value);
      provide('asObject', { n: count.value });
      return () => h('div', [h(Show('asRef')), h(Show('asValue')), h(defineComponent({ setup() { const o = inject('asObject'); return () => h('b', o.n); } }))]);
    },
  });
  const w = await mount(Root);
  count.value = 2; await flush();
  assert.equal(w.text(), '211');
}

// --- readonly + мутатор: потомок не может менять напрямую
{
  const cart = reactive({ items: [] });
  let api;
  const Child = defineComponent({ setup() { api = inject('cart'); return () => h('b', api.state.items.length); } });
  const Root = defineComponent({ setup() { provide('cart', { state: readonly(cart), add: (sku) => cart.items.push(sku) }); return () => h(Child); } });
  const w = await mount(Root);
  const before = warnings.length;
  api.state.items.push('x');
  assert.equal(cart.items.length, 0);
  assert.ok(warnings.slice(before).some((m) => m.includes('target is readonly')));
  api.add('tea'); await flush();
  assert.equal(w.text(), '1');
}

// --- значения по умолчанию и предупреждение о ненайденном ключе
{
  const before = warnings.length;
  let a, b, c;
  const C = defineComponent({ setup() { a = inject('missing'); b = inject('missing', 'по умолчанию'); c = inject('missing', () => ({ created: true }), true); return () => null; } });
  await mount(C);
  assert.equal(a, undefined);
  assert.equal(b, 'по умолчанию');
  assert.deepEqual(c, { created: true });
  assert.equal(warnings.slice(before).filter((m) => m.includes('injection "missing" not found')).length, 1);
}

// --- уровень приложения
{
  const container = document.createElement('div');
  const app = createApp(Show('currency'));
  app.provide('currency', '₽');
  app.mount(container);
  assert.equal(container.textContent, '₽');
  // runWithContext: inject вне компонента, но в контексте приложения
  assert.equal(app.runWithContext(() => inject('currency')), '₽');
}

// --- потребители обновляются точечно: только те, кто прочитал изменившееся поле
{
  const theme = reactive({ color: 'green', size: 'm' });
  const updates = [];
  const Consumer = (field) => defineComponent({ setup() { const t = inject('theme'); onUpdated(() => updates.push(field)); return () => h('i', t[field]); } });
  const Root = defineComponent({ setup() { provide('theme', theme); onUpdated(() => updates.push('root')); return () => h('div', [h(Consumer('color')), h(Consumer('size'))]); } });
  await mount(Root);
  theme.color = 'red'; await flush();
  assert.deepEqual(updates, ['color']);
}
console.log('provide/inject ok');
