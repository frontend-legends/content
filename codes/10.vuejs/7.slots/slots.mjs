// Глава 10.07 — слоты: область видимости родителя, запасное содержимое, именованные и scoped-слоты,
// слоты — функции (ленивые, зависимости — у ребёнка), проверка наличия, динамические имена, renderless.
// run: node slots.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings } from '../../_lib/vue.mjs';
const reg = (n, c) => (window[n] = c);

// --- содержимое слота компилируется в области родителя; запасное содержимое; именованные слоты
reg('__Card', await sfc(`<script setup>import { ref } from 'vue'; const secret = ref('ребёнок');</script>
<template><article><header><slot name="header">Без заголовка</slot></header><slot /><footer v-if="$slots.footer"><slot name="footer" /></footer></article></template>`, 'Card.vue'));
{
  const P = await sfc(`<script setup>const Card = window.__Card; const title = 'Улун';</script>
<template><Card><template #header>{{ title }}</template>Описание {{ typeof secret }}</Card><Card>Только текст</Card></template>`);
  const w = await mount(P);
  const [a, b] = w.container.querySelectorAll('article');
  assert.equal(a.querySelector('header').textContent, 'Улун');
  assert.match(a.textContent, /Описание undefined/);   // данные ребёнка из слота не видны
  assert.equal(b.querySelector('header').textContent, 'Без заголовка');   // запасное содержимое
  assert.equal(b.querySelector('footer'), null);                          // footer не передан — обёртки нет
}

// --- scoped-слот: ребёнок передаёт данные в слот
reg('__List', await sfc(`<script setup>defineProps(['items']);</script>
<template><ul><li v-for="(item, index) in items" :key="item.id"><slot :item="item" :index="index">{{ item.title }}</slot></li></ul><slot name="empty" v-if="!items.length" /></template>`, 'List.vue'));
{
  const P = await sfc(`<script setup>const List = window.__List; const products = [{ id: 1, title: 'Чай', price: 490 }, { id: 2, title: 'Кофе', price: 650 }];</script>
<template><List :items="products" v-slot="{ item, index }">{{ index + 1 }}. {{ item.title }} — {{ item.price }}</List>
<List :items="products" /><List :items="[]"><template #empty>Пусто</template></List></template>`);
  const w = await mount(P);
  const lists = w.container.querySelectorAll('ul');
  assert.equal(lists[0].textContent, '1. Чай — 4902. Кофе — 650');
  assert.equal(lists[1].textContent, 'ЧайКофе');
  assert.match(w.text(), /Пусто$/);
}

// --- слот — функция: не вызванный слот не создаёт компоненты
{
  window.__mounted = 0;
  reg('__Heavy', await sfc(`<script setup>import { onMounted } from 'vue'; onMounted(() => window.__mounted++);</script><template><b>тяжёлый</b></template>`, 'Heavy.vue'));
  reg('__Toggle', await sfc(`<script setup>defineProps(['open']);</script><template><div><slot v-if="open" /></div></template>`, 'Toggle.vue'));
  const P = await sfc(`<script setup>import { ref } from 'vue'; const Toggle = window.__Toggle; const Heavy = window.__Heavy; const open = ref(false); defineExpose({ open });</script>
<template><Toggle :open="open"><Heavy /></Toggle></template>`);
  const w = await mount(P);
  assert.equal(window.__mounted, 0);
  w.vm.open = true; await flush();
  assert.equal(window.__mounted, 1);
}

// --- зависимость данных родителя, прочитанных в слоте, принадлежит рендеру ребёнка
{
  window.__updates = [];
  reg('__Box', await sfc(`<script setup>import { onUpdated } from 'vue'; onUpdated(() => window.__updates.push('box'));</script><template><div><slot /></div></template>`, 'Box.vue'));
  const P = await sfc(`<script setup>import { ref, onUpdated } from 'vue'; const Box = window.__Box; const n = ref(0); onUpdated(() => window.__updates.push('parent')); defineExpose({ n });</script>
<template><Box>{{ n }}</Box></template>`);
  const w = await mount(P);
  w.vm.n++; await flush();
  assert.deepEqual(window.__updates, ['box']);   // родитель не перерисовывался
  assert.equal(w.text(), '1');
}

// --- динамическое имя слота и смешение default + именованных
{
  reg('__Tabs', await sfc(`<script setup>defineProps(['tabs', 'active']);</script><template><section><slot :name="active" /></section></template>`, 'Tabs.vue'));
  const P = await sfc(`<script setup>import { ref } from 'vue'; const Tabs = window.__Tabs; const active = ref('info'); defineExpose({ active });</script>
<template><Tabs :active="active"><template #info>Описание</template><template #reviews>Отзывы</template></Tabs></template>`);
  const w = await mount(P);
  assert.equal(w.text(), 'Описание');
  w.vm.active = 'reviews'; await flush();
  assert.equal(w.text(), 'Отзывы');
}

// --- v-slot прямо на компоненте нельзя смешивать с именованными <template #...>
{
  const { compile } = await import('@vue/compiler-dom');
  assert.throws(() => compile('<List v-slot="{ item }"><template #empty>x</template></List>'), /Mixed v-slot usage on both the component and nested <template>/);
}

// --- renderless-компонент: логика без разметки
{
  reg('__MouseTracker', await sfc(`<script setup>
import { ref } from 'vue';
const x = ref(0); const y = ref(0);
function onMove(e) { x.value = e.clientX; y.value = e.clientY; }
</script><template><slot :x="x" :y="y" :on-move="onMove" /></template>`, 'MouseTracker.vue'));
  const P = await sfc(`<script setup>const MouseTracker = window.__MouseTracker;</script>
<template><MouseTracker v-slot="{ x, y, onMove }"><div class="area" @mousemove="onMove">{{ x }},{{ y }}</div></MouseTracker></template>`);
  const w = await mount(P);
  w.container.querySelector('.area').dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }));
  await flush();
  assert.equal(w.text(), '10,20');
}
assert.deepEqual(warnings, ['Property "secret" was accessed during render but is not defined on instance.']);   // слот родителя не видит данные ребёнка
console.log('slots ok');
