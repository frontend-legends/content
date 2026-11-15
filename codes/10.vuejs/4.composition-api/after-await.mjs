// Глава 10.04 — после await в обычном setup(): inject не работает, watch не останавливается вместе с компонентом.
// run: node after-await.mjs
import assert from 'node:assert/strict';
import { mount, flush, warnings, vue } from '../../_lib/vue.mjs';
const { h, ref, defineComponent, inject, provide, watch, Suspense } = vue;

const source = ref(0);
let injected = 'x';
let watchRuns = 0;
const Late = defineComponent({
  async setup() {
    await Promise.resolve();
    injected = inject('theme', 'fallback');
    watch(source, () => watchRuns++);
    return () => h('p', 'late');
  },
});
const Root = defineComponent({ setup() { provide('theme', 'dark'); return () => h(Suspense, null, { default: () => h(Late) }); } });
const before = warnings.length;
const w = await mount(Root);
await flush();
assert.equal(injected, undefined);    // ни значения родителя, ни значения по умолчанию
assert.ok(warnings.slice(before).some((m) => m.includes('inject() can only be used inside setup() or functional components')));
w.unmount();
source.value++;
await flush();
assert.equal(watchRuns, 1);           // наблюдатель пережил компонент
console.log('after await ok');
