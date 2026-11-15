<script setup lang="ts">
// пропсы из типа, значения по умолчанию через деструктуризацию (Vue 3.5)
type Product = { id: number; title: string; price: number };
const { product, currency = '₽', compact = false } = defineProps<{
  product: Product;
  currency?: string;
  compact?: boolean;
}>();

// события: именованные кортежи аргументов
const emit = defineEmits<{
  add: [id: number, qty: number];
  remove: [id: number];
}>();

function onAdd() {
  emit('add', product.id, 1);
  // @ts-expect-error — не хватает qty
  emit('add', product.id);
  // @ts-expect-error — нет такого события
  emit('buy', product.id);
}

defineExpose({ focus: () => {} });
</script>

<template>
  <article :class="{ compact }">
    <h3>{{ product.title }}</h3>
    <p>
      <!-- @vue-expect-error — опечатка в поле ловится в шаблоне -->
      {{ product.prise }}
    </p>
    <p>{{ product.price }} {{ currency }}</p>
    <button @click="onAdd">В корзину</button>
  </article>
</template>
