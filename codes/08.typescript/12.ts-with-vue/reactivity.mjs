// Глава 8.12 — рантайм за типами: ref внутри reactive разворачивается, деструктуризация reactive
// теряет связь, toRefs её сохраняет, inject без провайдера возвращает undefined.
// run: node reactivity.mjs
import assert from 'node:assert/strict';
import { reactive, ref, toRefs, isRef, createApp, h, inject, provide, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';

const cart = reactive({ total: ref(0), items: [] });
assert.equal(cart.total, 0);            // без .value
assert.equal(isRef(cart.total), false);
cart.total = 5;

const { total } = cart;                 // копия числа
cart.total = 10;
assert.equal(total, 5);

const refs = toRefs(cart);
cart.total = 20;
assert.equal(refs.total.value, 20);

// inject без провайдера
const warnings = [];
const Key = Symbol('theme');
let injected = 'x';
const Child = defineComponent({ setup() { injected = inject(Key); return () => h('i'); } });
const app = createApp({ render: () => h(Child) });
app.config.warnHandler = (msg) => warnings.push(msg);
await renderToString(app);
assert.equal(injected, undefined);
assert.ok(warnings.some((w) => w.includes('injection') && w.includes('not found')));

// с провайдером
let got;
const Child2 = defineComponent({ setup() { got = inject(Key); return () => h('i'); } });
await renderToString(createApp({ setup() { provide(Key, { color: 'green' }); return () => h(Child2); } }));
assert.deepEqual(got, { color: 'green' });
console.log('reactivity ok');
