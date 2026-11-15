// Глава 10.04 — Composition API: setup выполняется один раз, порядок хуков родителя и ребёнка,
// хуки после await, закрытость script setup, макросы, Options API и миксины.
// run: node composition.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings, vue } from '../../_lib/vue.mjs';
import { parse, compileScript } from 'vue/compiler-sfc';
const { h, ref, defineComponent, onMounted, onBeforeMount, onUnmounted, onBeforeUnmount, onUpdated, Suspense, createApp, defineProps } = vue;

// --- setup выполняется один раз, рендер — много раз
{
  let setups = 0, renders = 0;
  const C = defineComponent({
    setup() { setups++; const n = ref(0); return () => { renders++; return h('button', { onClick: () => n.value++ }, n.value); }; },
  });
  const w = await mount(C);
  for (let i = 0; i < 3; i++) { w.container.querySelector('button').click(); await flush(); }
  assert.deepEqual([setups, renders], [1, 4]);
}

// --- this в setup нет
{
  let self = 'x';
  await mount(defineComponent({ setup() { self = this; return () => null; } }));
  assert.equal(self, undefined);
}

// --- порядок хуков родителя и ребёнка
{
  const log = [];
  const hooks = (name) => {
    log.push(`${name}:setup`);
    onBeforeMount(() => log.push(`${name}:beforeMount`));
    onMounted(() => log.push(`${name}:mounted`));
    onBeforeUnmount(() => log.push(`${name}:beforeUnmount`));
    onUnmounted(() => log.push(`${name}:unmounted`));
  };
  const Child = defineComponent({ setup() { hooks('child'); return () => h('i'); } });
  const Parent = defineComponent({ setup() { hooks('parent'); return () => h('div', h(Child)); } });
  const w = await mount(Parent);
  assert.deepEqual(log, ['parent:setup', 'parent:beforeMount', 'child:setup', 'child:beforeMount', 'child:mounted', 'parent:mounted']);
  log.length = 0;
  w.unmount();
  assert.deepEqual(log, ['parent:beforeUnmount', 'child:beforeUnmount', 'child:unmounted', 'parent:unmounted']);
}

// --- хук можно вызвать по условию: setup выполняется один раз
{
  const log = [];
  const C = defineComponent({ props: { track: Boolean }, setup(props) { if (props.track) onMounted(() => log.push('tracked')); return () => h('p'); } });
  await mount(C, { props: { track: true } });
  await mount(C, { props: { track: false } });
  assert.deepEqual(log, ['tracked']);
}

// --- хук после await в обычном setup() теряет экземпляр
{
  const before = warnings.length;
  let mountedCalled = false;
  const Late = defineComponent({
    async setup() { await Promise.resolve(); onMounted(() => { mountedCalled = true; }); return () => h('p', 'late'); },
  });
  const Root = defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(Late) }) });
  await mount(Root);
  await flush();
  assert.equal(mountedCalled, false);
  assert.ok(warnings.slice(before).some((m) => m.includes('onMounted is called when there is no active component instance')));
}

// --- а в <script setup> компилятор восстанавливает экземпляр после top-level await
{
  const Late = await sfc(`<script setup>
import { onMounted } from 'vue';
await Promise.resolve();
onMounted(() => { window.__lateMounted = true; });
</script>
<template><p>late</p></template>`);
  window.__Late = Late;
  const Root = await sfc(`<script setup>const Late = window.__Late;</script><template><Suspense><Late /></Suspense></template>`);
  const w = await mount(Root);
  await flush();
  assert.equal(w.text(), 'late');
  assert.equal(window.__lateMounted, true);
  const { descriptor } = parse(`<script setup>await Promise.resolve();</script><template><p/></template>`);
  assert.match(compileScript(descriptor, { id: 'x', inlineTemplate: true }).content, /_withAsyncContext/);
}

// --- script setup закрыт: снаружи видно только defineExpose
{
  const Closed = await sfc(`<script setup>
import { ref } from 'vue';
const secret = ref(1);
function focus() { return 'focused'; }
defineExpose({ focus });
</script>
<template><p>{{ secret }}</p></template>`);
  window.__Closed = Closed;
  const Parent = await sfc(`<script setup>
import { useTemplateRef } from 'vue';
const Closed = window.__Closed;
const child = useTemplateRef('child');
defineExpose({ child });
</script>
<template><Closed ref="child" /></template>`);
  const w = await mount(Parent);
  assert.equal(w.vm.child.focus(), 'focused');
  assert.equal(w.vm.child.secret, undefined);
  // обычный setup() без expose открыт
  const Open = defineComponent({ setup() { return { secret: ref(1) }; }, render() { return h('p'); } });
  const P2 = defineComponent({ setup() { const c = ref(); return { c }; }, render() { return h(Open, { ref: 'c' }); } });
  const w2 = await mount(P2);
  assert.equal(w2.vm.$refs.c.secret, 1);
}

// --- макросы существуют только для компилятора
{
  const warns = [];
  const orig = console.warn; console.warn = (m) => warns.push(String(m));
  defineProps();
  console.warn = orig;
  assert.ok(warns.some((w) => w.includes('defineProps() is a compiler-hint helper that is only usable inside <script setup>')));
  const { descriptor } = parse(`<script setup>
const props = defineProps({ title: String });
const emit = defineEmits(['add']);
defineOptions({ name: 'ProductCard', inheritAttrs: false });
</script><template><p>{{ title }}</p></template>`);
  const out = compileScript(descriptor, { id: 'x', inlineTemplate: true }).content;
  assert.doesNotMatch(out, /defineProps\(|defineEmits\(|defineOptions\(/);
  assert.match(out, /props: \{\s*title: String\s*\}/);
  assert.match(out, /emits: \['add'\]/);
  assert.match(out, /name: 'ProductCard'/);
  assert.match(out, /inheritAttrs: false/);
}

// --- Options API: this, data как функция, setup доступен через this, миксин конфликтует молча
{
  const counterMixin = { data: () => ({ count: 100, label: 'миксин' }), methods: { inc() { this.count++; } } };
  const C = defineComponent({
    mixins: [counterMixin],
    data: () => ({ label: 'компонент' }),
    setup() { return { fromSetup: ref('setup') }; },
    computed: { double() { return this.count * 2; } },
    render() { return h('p', `${this.label}|${this.count}|${this.double}|${this.fromSetup}`); },
  });
  const w = await mount(C);
  assert.equal(w.text(), 'компонент|100|200|setup');   // label компонента перекрыл миксин без предупреждения
  w.vm.inc(); await flush();
  assert.equal(w.text(), 'компонент|101|202|setup');
}
console.log('composition ok');
