// Глава 10.01 — практика: сколько раз перерисуется; scoped-стили и :deep().
// run: node practice.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush } from '../../_lib/vue.mjs';
import { compileStyle } from 'vue/compiler-sfc';

// 1. Сколько раз перерисуется Badge?
const log = [];
const Badge = await sfc(`<script setup>
import { onUpdated } from 'vue';
defineProps({ count: Number });
onUpdated(() => window.__log.push('badge'));
</script>
<template><span>{{ count }}</span></template>`, 'Badge.vue');
window.__log = log;
window.__Badge = Badge;
const Cart = await sfc(`<script setup>
import { ref, onUpdated } from 'vue';
const Badge = window.__Badge;
const items = ref([]);
const query = ref('');
function add() { items.value.push('чай'); items.value.push('кофе'); }
onUpdated(() => window.__log.push('cart'));
defineExpose({ add, query });
</script>
<template><input v-model="query"><Badge :count="items.length" /></template>`, 'Cart.vue');
const w = await mount(Cart);
w.vm.query = 'ч';
await flush();
assert.deepEqual(log, ['cart']);           // Badge не обновлялся: его проп не изменился
w.vm.add();
await flush();
assert.deepEqual(log, ['cart', 'badge', 'cart']);   // два push — одна перерисовка
assert.equal(w.container.querySelector('span').textContent, '2');

// 2. scoped-стиль не доходит до внутренностей дочернего компонента; :deep() — доходит
const id = 'data-v-1a2b3c4d';
const plain = compileStyle({ source: '.card .title { color: red; }', id, scoped: true, filename: 'P.vue' });
assert.equal(plain.code.replace(/\s+/g, ' ').trim(), '.card .title[data-v-1a2b3c4d] { color: red; }');
const deep = compileStyle({ source: '.card :deep(.title) { color: red; }', id, scoped: true, filename: 'P.vue' });
assert.equal(deep.code.replace(/\s+/g, ' ').trim(), '.card[data-v-1a2b3c4d] .title { color: red; }');

// корневой элемент ребёнка получает атрибут родителя, внутренние — нет
const Title = await sfc(`<template><div class="title-wrap"><h3 class="title">Чай</h3></div></template>`, 'Title.vue');
window.__Title = Title;
const Page = await sfc(`<script setup>const Title = window.__Title;</script>
<template><div class="card"><Title /></div></template>
<style scoped>.card .title { color: red; }</style>`, 'Page.vue');
const p = await mount(Page);
const scopeAttr = (el) => [...el.attributes].map((a) => a.name).filter((n) => n.startsWith('data-v-'));
assert.equal(scopeAttr(p.container.querySelector('.card')).length, 1);
assert.equal(scopeAttr(p.container.querySelector('.title-wrap')).length, 1);   // корень ребёнка помечен
assert.equal(scopeAttr(p.container.querySelector('.title')).length, 0);        // внутренний узел — нет
console.log('practice ok');
