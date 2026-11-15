// Глава 10.01 — как работает Vue: шаблон компилируется в render-функцию, компонент — эффект,
// который перезапускается при изменении прочитанных данных; обновляется только этот компонент.
// run: node how-vue-works.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { sfc, mount, flush, vue, warnings } from '../../_lib/vue.mjs';
import { compile } from '@vue/compiler-dom';
import { compileStyle } from 'vue/compiler-sfc';

// --- шаблон → render-функция
const { code } = compile('<button @click="count++">{{ count }}</button>', { mode: 'module', prefixIdentifiers: true, cacheHandlers: true });
assert.match(code, /export function render\(_ctx, _cache\)/);
assert.match(code, /_createElementBlock\("button"/);
assert.match(code, /_toDisplayString\(_ctx\.count\)/);
assert.match(code, /1 \/\* TEXT \*\//);   // patch flag: у узла меняется только текст

// --- точечное обновление: перерисовывается компонент, данные которого изменились
const renders = { parent: 0, child: 0 };
const Child = vue.defineComponent({
  props: { label: String },
  setup(props) {
    const clicks = vue.ref(0);
    return () => { renders.child++; return vue.h('button', { onClick: () => clicks.value++ }, `${props.label}: ${clicks.value}`); };
  },
});
const Parent = vue.defineComponent({
  setup() {
    const total = vue.ref(0);
    const label = vue.ref('Чай');
    return { total, label, render: () => { renders.parent++; return vue.h('div', [vue.h('p', total.value), vue.h(Child, { label: label.value })]); } };
  },
  render() { return this.render(); },
});
const w = await mount(Parent);
assert.deepEqual(renders, { parent: 1, child: 1 });

w.vm.total++;                          // меняется состояние родителя, пропсы ребёнка прежние
await flush();
assert.deepEqual(renders, { parent: 2, child: 1 });   // ребёнок не перерисован

w.container.querySelector('button').click();   // меняется состояние ребёнка
await flush();
assert.deepEqual(renders, { parent: 2, child: 2 });   // родитель не перерисован

w.vm.label = 'Кофе';                   // меняется проп ребёнка
await flush();
assert.deepEqual(renders, { parent: 3, child: 3 });
assert.equal(w.container.querySelector('button').textContent, 'Кофе: 1');

// несколько изменений подряд — одна перерисовка
w.vm.total++; w.vm.total++; w.vm.total++;
await flush();
assert.equal(renders.parent, 4);

// --- SFC: script setup + шаблон + scoped-стили
const Hello = await sfc(`<script setup>
import { ref } from 'vue';
const name = ref('Vue');
</script>
<template><h1>Привет, {{ name }}</h1></template>`);
assert.equal((await mount(Hello)).text(), 'Привет, Vue');

const css = compileStyle({ source: 'h1 { color: #42b883; }', id: 'data-v-7ba5bd90', scoped: true, filename: 'Hello.vue' });
assert.equal(css.code.trim().replace(/\s+/g, ' '), 'h1[data-v-7ba5bd90] { color: #42b883; }');

// --- runtime-only сборка не умеет компилировать шаблоны в браузере
const require = createRequire(import.meta.url);
const src = readFileSync(require.resolve('vue/dist/vue.runtime.global.js'), 'utf8');
const RuntimeVue = new Function('window', 'document', `${src}; return Vue;`)(globalThis.window, globalThis.document);
const runtimeWarnings = [];
const app = RuntimeVue.createApp({ template: '<p>{{ 1 + 1 }}</p>' });
app.config.warnHandler = (m) => runtimeWarnings.push(m);
app.mount(document.createElement('div'));
assert.ok(runtimeWarnings.some((m) => m.includes('runtime compilation is not supported in this build of Vue')));

// полная сборка (vue в Node — с компилятором) — умеет
const full = await mount(vue.defineComponent({ template: '<p>{{ 1 + 1 }}</p>' }));
assert.equal(full.text(), '2');
assert.deepEqual(warnings, []);
console.log('how vue works ok');
