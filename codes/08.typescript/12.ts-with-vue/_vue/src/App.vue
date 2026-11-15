<script setup lang="ts">
import { computed, inject, provide, reactive, ref, useTemplateRef, type InjectionKey, type Ref } from 'vue';
import { defineStore, createPinia, setActivePinia } from 'pinia';
import ProductCard from './ProductCard.vue';
import QtyInput from './QtyInput.vue';
import List from './List.vue';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

// --- ref и reactive
const count = ref(0);
ok<Equal<typeof count, Ref<number, number>>>();
const user = ref<{ id: number; name: string } | null>(null);
ok<Equal<typeof user.value, { id: number; name: string } | null>>();
const items = ref([]);
ok<Equal<typeof items.value, never[]>>();
const cart = reactive({ total: ref(0), items: [] as string[] });
ok<Equal<typeof cart.total, number>>();   // ref внутри reactive разворачивается
const double = computed(() => count.value * 2);
ok<Equal<typeof double.value, number>>();

// --- template ref (3.5)
const input = useTemplateRef<HTMLInputElement>('search');
ok<Equal<typeof input.value, HTMLInputElement | null>>();
const card = useTemplateRef<InstanceType<typeof ProductCard>>('card');
card.value?.focus();
// @ts-expect-error — onAdd не отдан через defineExpose
card.value?.onAdd();
// @ts-expect-error — reactive не принимает примитивы
reactive(1);

// --- provide / inject
type Theme = { color: string };
const ThemeKey: InjectionKey<Theme> = Symbol('theme');
provide(ThemeKey, { color: 'green' });
// @ts-expect-error — значение не подходит под ключ
provide(ThemeKey, { colour: 'green' });
const theme = inject(ThemeKey);
ok<Equal<typeof theme, Theme | undefined>>();
const theme2 = inject(ThemeKey, { color: 'black' });
ok<Equal<typeof theme2, Theme>>();
const untyped = inject('theme');
ok<Equal<typeof untyped, unknown>>();

// --- Pinia: типы выводятся из setup-стора
setActivePinia(createPinia());
const useCart = defineStore('cart', () => {
  const lines = ref<{ sku: string; qty: number }[]>([]);
  const total = computed(() => lines.value.reduce((s, l) => s + l.qty, 0));
  function add(sku: string) { lines.value.push({ sku, qty: 1 }); }
  return { lines, total, add };
});
const store = useCart();
ok<Equal<typeof store.total, number>>();
// @ts-expect-error — add принимает строку
store.add(1);

const product = { id: 1, title: 'Чай', price: 490 };
const qty = ref(1);
const comment = ref('');
const maybeComment = ref<string>();
function onAdd(id: number, q: number) { void id; void q; }
const rows = [{ id: 1, title: 'Чай' }];
</script>

<template>
  <input ref="search">
  <ProductCard ref="card" :product="product" @add="onAdd" />
  <!-- @vue-expect-error — обязательный prop product не передан -->
  <ProductCard />
  <!-- @vue-expect-error — compact ждёт boolean -->
  <ProductCard :product="product" compact="yes" />
  <!-- @vue-expect-error — note может прийти undefined, а comment — Ref<string> -->
  <QtyInput v-model="qty" v-model:note="comment" />
  <QtyInput v-model="qty" v-model:note="maybeComment" v-model:tag="comment" />
  <List :items="rows">
    <template #item="{ item }">{{ item.title }}</template>
  </List>
  <List :items="rows">
    <template #item="{ item }">
      <!-- @vue-expect-error — у элемента нет price: T выведен из items -->
      {{ item.price }}
    </template>
  </List>
</template>
