// Глава 10.12 — Pinia: setup- и options-сторы, storeToRefs, getters как computed, $patch и $reset,
// $subscribe и $onAction, активная Pinia, состояние в pinia.state, сторы на запрос при SSR, точечные обновления.
// run: node pinia.mjs
import assert from 'node:assert/strict';
import { mount, flush, vue } from '../../_lib/vue.mjs';
const { h, ref, computed, defineComponent, isRef, onUpdated, createSSRApp } = vue;
const { createPinia, setActivePinia, defineStore, storeToRefs } = await import('pinia');
const { renderToString } = await import('vue/server-renderer');

// --- активная Pinia обязательна
{
  const useX = defineStore('x', () => ({ n: ref(0) }));
  assert.throws(() => useX(), /"getActivePinia\(\)" was called but there was no active Pinia/);
}

const useCart = defineStore('cart', () => {
  const items = ref([]);
  const coupon = ref(null);
  const secret = ref('не вернули');
  let totalCalls = 0;
  const total = computed(() => { totalCalls++; return items.value.reduce((s, i) => s + i.price * i.qty, 0); });
  function add(product) {
    const line = items.value.find((i) => i.sku === product.sku);
    if (line) line.qty++; else items.value.push({ ...product, qty: 1 });
  }
  async function checkout(api) { const order = await api(items.value); items.value = []; return order; }
  return { items, coupon, total, add, checkout, totalCalls: () => totalCalls };
});

const useCounterOptions = defineStore('counter', {
  state: () => ({ count: 0, step: 1 }),
  getters: { double: (s) => s.count * 2 },
  actions: { inc() { this.count += this.step; } },
});

{
  const pinia = createPinia(); setActivePinia(pinia);
  const cart = useCart();
  assert.equal(useCart(), cart);                         // один экземпляр на Pinia
  cart.add({ sku: 'tea', price: 490 }); cart.add({ sku: 'tea', price: 490 });
  assert.equal(cart.items[0].qty, 2);                     // ref развёрнут: без .value
  assert.equal(cart.total, 980);
  void cart.total; void cart.total;
  assert.equal(cart.totalCalls(), 1);                     // getter — computed с кешем

  // деструктуризация теряет связь, storeToRefs — нет
  const { total } = cart;
  const refs = storeToRefs(cart);
  cart.add({ sku: 'pot', price: 1500 });
  assert.equal(total, 980);
  assert.equal(refs.total.value, 2480);
  assert.equal(isRef(refs.items), true);
  assert.equal('add' in refs, false);                     // действия в storeToRefs не попадают
  const { add } = cart;                                   // их деструктурируют напрямую
  add({ sku: 'cup', price: 300 });
  assert.equal(cart.items.length, 3);

  // невозвращённое состояние не попадает в pinia.state (devtools, SSR, плагины)
  assert.deepEqual(Object.keys(pinia.state.value.cart).sort(), ['coupon', 'items']);

  // $patch объектом и функцией, $subscribe
  const mutations = [];
  cart.$subscribe((m) => mutations.push(m.type), { flush: 'sync' });
  cart.$patch({ coupon: 'SALE' });
  cart.$patch((s) => { s.items.push({ sku: 'x', price: 1, qty: 1 }); });
  cart.coupon = null;
  assert.deepEqual(mutations, ['patch object', 'patch function', 'direct']);

  // $onAction: до, после, ошибка
  const actions = [];
  cart.$onAction(({ name, after, onError }) => { actions.push(`start ${name}`); after((r) => actions.push(`done ${r.id}`)); onError((e) => actions.push(`fail ${e.message}`)); });
  await cart.checkout(async () => ({ id: 7 }));
  await assert.rejects(cart.checkout(async () => { throw new Error('402'); }));
  assert.deepEqual(actions, ['start checkout', 'done 7', 'start checkout', 'fail 402']);

  // $reset есть только у options-стора
  const counter = useCounterOptions();
  counter.inc(); counter.inc();
  assert.equal(counter.double, 4);
  counter.$reset();
  assert.equal(counter.count, 0);
  assert.throws(() => cart.$reset(), /built using the setup syntax and does not implement \$reset\(\)/);
}

// --- компонент перерисовывается только от тех полей, которые прочитал
{
  const pinia = createPinia();
  const updates = [];
  const useUi = defineStore('ui', () => ({ count: ref(0), theme: ref('light') }));
  const CountView = defineComponent({ setup() { const ui = useUi(); onUpdated(() => updates.push('count view')); return () => h('b', ui.count); } });
  const w = await mount(CountView, { plugins: [pinia] });
  const ui = useUi(pinia);
  ui.theme = 'dark'; await flush();
  assert.deepEqual(updates, []);                          // селекторы не нужны
  ui.count++; await flush();
  assert.deepEqual(updates, ['count view']);
  assert.equal(w.text(), '1');
}

// --- SSR: Pinia на каждый запрос, состояние сериализуется
{
  const useUser = defineStore('user', () => ({ name: ref(null) }));
  const Page = defineComponent({ props: ['login'], setup(p) { const u = useUser(); if (p.login) u.name = p.login; return () => h('p', u.name ?? 'гость'); } });
  async function render(props) {
    const app = createSSRApp(Page, props);
    const pinia = createPinia();
    app.use(pinia);
    const html = await renderToString(app);
    return { html, state: JSON.stringify(pinia.state.value) };
  }
  const a = await render({ login: 'Аня' });
  const b = await render({});
  assert.equal(a.html, '<p>Аня</p>');
  assert.equal(b.html, '<p>гость</p>');                   // утечки между запросами нет
  assert.equal(a.state, '{"user":{"name":"Аня"}}');       // это состояние кладут в HTML для гидратации
}

// --- плагин: свойство в каждом сторе
{
  const pinia = createPinia();
  pinia.use(({ store }) => { store.createdAt = 'plugin'; });
  const useA = defineStore('a', () => ({ v: ref(1) }));
  setActivePinia(pinia);
  assert.equal(useA().createdAt, undefined);            // плагины применяются после app.use(pinia)
  const pinia2 = createPinia();
  pinia2.use(({ store }) => { store.createdAt = 'plugin'; });
  vue.createApp({ render: () => null }).use(pinia2);
  assert.equal(useA(pinia2).createdAt, 'plugin');
}
console.log('pinia ok');
