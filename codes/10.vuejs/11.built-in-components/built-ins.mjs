// Глава 10.11 — встроенные компоненты: Teleport (логическое дерево и DOM-события), Suspense,
// KeepAlive (include, max, onActivated), defineAsyncComponent, классы Transition.
// run: node built-ins.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings, vue } from '../../_lib/vue.mjs';
const { h, ref, defineComponent, defineAsyncComponent, Teleport, KeepAlive, Suspense, Transition, inject, provide, nextTick, onActivated, onDeactivated } = vue;
const reg = (n, c) => (window[n] = c);

// --- Teleport: узел в body, но логически — на месте
{
  reg('__Modal', await sfc(`<script setup>
import { inject } from 'vue';
const emit = defineEmits(['close']);
const theme = inject('theme');
</script>
<template><Teleport to="body"><div class="modal" :data-theme="theme"><button class="close" @click="emit('close')">×</button></div></Teleport></template>`, 'Modal.vue'));
  const P = await sfc(`<script setup>
import { ref, provide } from 'vue';
const Modal = window.__Modal; provide('theme', 'dark');
const log = ref([]); const open = ref(true);
defineExpose({ log, open });
</script>
<template><section class="page" @click="log.push('page click')"><Modal v-if="open" @close="log.push('close event'); open = false" /></section></template>`);
  const w = await mount(P);
  const modal = document.body.querySelector(':scope > .modal');
  assert.ok(modal);                                        // переехал в body
  assert.equal(w.container.querySelector('.modal'), null); // в разметке родителя его нет
  assert.equal(modal.dataset.theme, 'dark');               // inject работает по логическому дереву
  modal.querySelector('.close').click(); await flush();
  assert.deepEqual(w.vm.log, ['close event']);             // событие компонента дошло, DOM-клик до .page — нет
  assert.equal(document.body.querySelector(':scope > .modal'), null);   // размонтирован вместе с владельцем
}

// --- Teleport: цель должна существовать; defer ждёт отрисовки остального
{
  const before = warnings.length;
  // без warnHandler: с ним Vue 3.5 падает при форматировании null-аргумента этого предупреждения
  vue.createApp(defineComponent({ setup: () => () => h(Teleport, { to: '#nowhere' }, h('p', 'x')) })).mount(document.createElement('div'));
  assert.ok(warnings.slice(before).some((m) => m.includes('Failed to locate Teleport target with selector "#nowhere"')));
  const w = await mount(defineComponent({ setup: () => () => [h(Teleport, { to: '#later', defer: true }, h('p', { class: 'deferred' }, 'ok')), h('div', { id: 'later' })] }));
  assert.equal(w.container.querySelector('#later .deferred').textContent, 'ok');
  const inline = await mount(defineComponent({ setup: () => () => h('div', { class: 'here' }, h(Teleport, { to: 'body', disabled: true }, h('p', { class: 'inline' }, 'y'))) }));
  assert.ok(inline.container.querySelector('.here .inline'));   // disabled — рендер на месте
}

// --- Suspense: ждёт асинхронные setup потомков, показывает fallback
{
  let resolve;
  const gate = new Promise((r) => (resolve = r));
  reg('__Async', await sfc(`<script setup>const data = await window.__gate; </script><template><p class="data">{{ data }}</p></template>`, 'AsyncChild.vue'));
  window.__gate = gate;
  const P = await sfc(`<script setup>const AsyncChild = window.__Async;</script>
<template><Suspense><AsyncChild /><template #fallback><p class="loading">Загрузка…</p></template></Suspense></template>`);
  const w = await mount(P);
  assert.equal(w.text(), 'Загрузка…');
  resolve('готово'); await flush(); await flush();
  assert.equal(w.text(), 'готово');
}

// --- KeepAlive: состояние сохраняется, include по имени, onActivated/onDeactivated
{
  const log = [];
  const Tab = (name) => defineComponent({
    name,
    setup() { const n = ref(0); onActivated(() => log.push(`${name} activated`)); onDeactivated(() => log.push(`${name} deactivated`)); return () => h('button', { class: name, onClick: () => n.value++ }, `${name}:${n.value}`); },
  });
  const tabs = { Cart: Tab('Cart'), Profile: Tab('Profile') };
  const current = ref('Cart');
  const Root = defineComponent({ setup: () => () => h(KeepAlive, { include: 'Cart' }, [h(tabs[current.value], { key: current.value })]) });
  const w = await mount(Root);
  w.container.querySelector('button').click(); await flush();
  current.value = 'Profile'; await flush();
  w.container.querySelector('button').click(); await flush();
  current.value = 'Cart'; await flush();
  assert.equal(w.text(), 'Cart:1');                 // Cart в include — состояние сохранилось
  current.value = 'Profile'; await flush();
  assert.equal(w.text(), 'Profile:0');              // Profile не кешируется — создан заново
  assert.deepEqual(log, ['Cart activated', 'Cart deactivated', 'Cart activated', 'Cart deactivated']);
}

// --- KeepAlive max: вытесняется давно не использованный
{
  const created = [];
  const T = (name) => defineComponent({ name, setup() { created.push(name); return () => h('i', name); } });
  const all = { A: T('A'), B: T('B'), C: T('C') };
  const cur = ref('A');
  const Root = defineComponent({ setup: () => () => h(KeepAlive, { max: 2 }, [h(all[cur.value], { key: cur.value })]) });
  await mount(Root);
  for (const n of ['B', 'C', 'B', 'A']) { cur.value = n; await flush(); }
  assert.deepEqual(created, ['A', 'B', 'C', 'A']);   // A вытеснен при открытии C, B остался в кеше
}

// --- defineAsyncComponent: загрузка по требованию, состояние ошибки
{
  let loads = 0;
  const Lazy = defineAsyncComponent(() => { loads++; return Promise.resolve({ render: () => h('b', 'график') }); });
  const show = ref(false);
  const w = await mount(defineComponent({ setup: () => () => (show.value ? h(Lazy) : h('i', 'нет')) }));
  assert.equal(loads, 0);                            // пока не нужен — не загружен
  show.value = true; await flush(); await flush();
  assert.equal(w.text(), 'график');
  assert.equal(loads, 1);
  const Broken = defineAsyncComponent({ loader: () => Promise.reject(new Error('chunk failed')), errorComponent: { render: () => h('p', 'Не удалось загрузить') } });
  const wb = await mount(defineComponent({ setup: () => () => h(Broken) }));
  await flush(); await flush();
  assert.equal(wb.text(), 'Не удалось загрузить');
}

// --- Transition: классы входа в первом кадре
{
  const show = ref(false);
  const w = await mount(defineComponent({ setup: () => () => h(Transition, { name: 'fade' }, () => (show.value ? h('div', { class: 'toast' }, 'Добавлено') : null)) }));
  show.value = true; await nextTick();
  const el = w.container.querySelector('.toast');
  assert.ok(el.classList.contains('fade-enter-from'));
  assert.ok(el.classList.contains('fade-enter-active'));
  // через кадр enter-from снимается; без CSS-длительности переход сразу считается завершённым
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0))));
  assert.equal(el.className, 'toast');
}
console.log('built-ins ok');
