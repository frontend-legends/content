<script setup lang="ts">
const qty = defineModel<number>({ required: true });
const note = defineModel<string>('note');
const tag = defineModel<string>('tag', { default: '' });
const t: string = tag.value;
void t;
qty.value = qty.value + 1;
const n: number = qty.value;
// @ts-expect-error — note необязателен: string | undefined
const s: string = note.value;
void n; void s;
</script>

<template>
  <input v-model.number="qty" type="number">
  <input v-model="note" placeholder="Комментарий">
</template>
