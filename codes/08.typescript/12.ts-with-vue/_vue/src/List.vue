<script setup lang="ts" generic="T extends { id: number }">
defineProps<{ items: T[] }>();
defineSlots<{ item(props: { item: T; index: number }): any }>();
</script>

<template>
  <ul>
    <li v-for="(item, index) in items" :key="item.id">
      <slot name="item" :item="item" :index="index" />
    </li>
  </ul>
</template>
