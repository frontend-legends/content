// Глава 10.15 — производительность: что делает компилятор (вынос статики, patch flags, блоки, кеш обработчиков),
// v-once, v-memo, стабильность пропсов-объектов, app.config.performance.
// run: node perf.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, vue } from '../../_lib/vue.mjs';
import { compile } from '@vue/compiler-dom';
const { ref, h, defineComponent, onUpdated } = vue;

const c = (tpl) => compile(tpl, { mode: 'module', prefixIdentifiers: true, cacheHandlers: true, hoistStatic: true }).code;

// --- вынос статики и patch flags
{
  const code = c(`<div><h2 class="title">Каталог</h2><p :class="cls">{{ price }}</p><button @click="buy">Купить</button></div>`);
  assert.match(code, /_cache\[\d+\] \|\| \(_cache\[\d+\] = _createElementVNode\("h2", \{ class: "title" \}, "Каталог", -1 \/\* CACHED \*\/\)\)/);   // статичный узел создаётся один раз
  // статичные атрибуты у динамического узла выносятся из render-функции
  assert.match(c('<div><p class="price">{{ price }}</p></div>'), /const _hoisted_1 = \{ class: "price" \}/);
  assert.match(code, /3 \/\* TEXT, CLASS \*\//);                          // у <p> проверяются только текст и класс
  assert.match(code, /onClick: _cache\[\d+\] \|\| \(_cache\[\d+\] = \(\.\.\.args\) => \(_ctx\.buy/);  // обработчик кеширован
  // блок: v-if и v-for — границы блоков, внутри собираются только динамические узлы
  assert.match(c(`<div><p v-if="ok">{{ a }}</p></div>`), /_openBlock\(\)/);
  assert.match(c(`<ul><li v-for="i in items" :key="i.id">{{ i.t }}</li></ul>`), /128 \/\* KEYED_FRAGMENT \*\//);
}

// --- v-once: рендер один раз
{
  const C = await sfc(`<script setup>import { ref } from 'vue'; const n = ref(1); defineExpose({ n });</script>
<template><p class="once" v-once>{{ n }}</p><p class="live">{{ n }}</p></template>`);
  const w = await mount(C);
  w.vm.n = 2; await flush();
  assert.equal(w.container.querySelector('.once').textContent, '1');
  assert.equal(w.container.querySelector('.live').textContent, '2');
}

// --- v-memo: поддерево обновляется, только если изменились зависимости
{
  window.__renders = 0;
  window.__Row = defineComponent({ props: ['item', 'selected'], setup(p) { return () => { window.__renders++; return h('li', { class: p.selected ? 'sel' : '' }, p.item.title); }; } });
  const C = await sfc(`<script setup>
import { ref } from 'vue';
const Row = window.__Row;
const items = ref(Array.from({ length: 100 }, (_, i) => ({ id: i, title: 'товар ' + i })));
const selected = ref(0); const tick = ref(0);
defineExpose({ selected, tick });
</script>
<template><span>{{ tick }}</span><ul><Row v-for="item in items" :key="item.id" v-memo="[item.id === selected]" :item="item" :selected="item.id === selected" /></ul></template>`);
  const w = await mount(C);
  assert.equal(window.__renders, 100);
  window.__renders = 0;
  w.vm.tick++; await flush();
  assert.equal(window.__renders, 0);          // посторонний рендер родителя — строки пропущены
  w.vm.selected = 5; await flush();
  assert.equal(window.__renders, 2);          // перерисованы только две строки: старая и новая выбранные
}

// --- стабильность пропсов: новый объект в каждом рендере родителя перерисовывает ребёнка
{
  const counts = { inline: 0, stable: 0, handler: 0 };
  const Child = (name) => defineComponent({ props: ['options', 'onPick'], setup() { onUpdated(() => counts[name]++); return () => h('i'); } });
  const Inline = Child('inline'), Stable = Child('stable'), Handler = Child('handler');
  window.__kids = { Inline, Stable, Handler };
  const C = await sfc(`<script setup>
import { ref } from 'vue';
const { Inline, Stable, Handler } = window.__kids;
const tick = ref(0); const isDense = ref(true); const stableOptions = { dense: true };
const constOptions = 1;
function pick() {}
defineExpose({ tick });
</script>
<template><b>{{ tick }}</b><Inline :options="{ dense: isDense }" /><Stable :options="{ dense: true }" /><Stable :options="stableOptions" /><Handler @pick="() => pick()" /></template>`);
  const w = await mount(C);
  w.vm.tick++; await flush();
  // объект с реактивным полем создаётся заново в каждом рендере родителя — ребёнок перерисован;
  // полностью константный литерал компилятор выносит, а встроенный обработчик кеширует
  assert.deepEqual(counts, { inline: 1, stable: 0, handler: 0 });
}

// --- app.config.performance: метки в Performance API
{
  // Vue сразу удаляет меры из буфера — их видит PerformanceObserver и панель Performance в DevTools
  const { PerformanceObserver } = await import('node:perf_hooks');
  const names = [];
  const obs = new PerformanceObserver((list) => names.push(...list.getEntries().map((e) => e.name)));
  obs.observe({ entryTypes: ['measure'] });
  const C = defineComponent({ name: 'ProductCard', render: () => h('p', 'x') });
  const app = vue.createApp(C);
  app.config.performance = true;
  app.mount(document.createElement('div'));
  await new Promise((r) => setTimeout(r, 20));
  obs.disconnect();
  assert.ok(names.includes('<ProductCard> render'), names.join(','));
  assert.ok(names.includes('<ProductCard> patch'), names.join(','));
}
console.log('performance ok');
