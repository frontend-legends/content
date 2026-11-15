// Глава 10.02 — практика: v-if вместе с v-for, строка вместо числа из поля.
// run: node practice.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush } from '../../_lib/vue.mjs';

// 1. фильтр через computed и v-if на обёртке
{
  const C = await sfc(`<script setup>
import { computed, ref } from 'vue';
const products = ref([{ id: 1, title: 'Чай', inStock: true }, { id: 2, title: 'Кофе', inStock: false }]);
const available = computed(() => products.value.filter((p) => p.inStock));
</script>
<template>
<ul><li v-for="p in available" :key="p.id">{{ p.title }}</li></ul>
<ol><template v-for="p in products" :key="p.id"><li v-if="p.inStock">{{ p.title }}</li></template></ol>
</template>`);
  const w = await mount(C);
  assert.equal(w.container.querySelector('ul').textContent, 'Чай');
  assert.equal(w.container.querySelector('ol').textContent, 'Чай');
}

// 2. строка из поля: "490" + 1 = "4901"
{
  const C = await sfc(`<script setup>
import { ref, computed } from 'vue';
const a = ref(0); const b = ref(0); const c = ref(0);
const plain = computed(() => a.value + 1);
const withNumber = computed(() => b.value + 1);
const typeNumber = computed(() => c.value + 1);
defineExpose({ plain, withNumber, typeNumber });
</script>
<template><input class="a" v-model="a"><input class="b" v-model.number="b"><input class="c" type="number" v-model="c"></template>`);
  const w = await mount(C);
  for (const cls of ['a', 'b', 'c']) {
    const el = w.container.querySelector('.' + cls);
    el.value = '490'; el.dispatchEvent(new Event('input'));
  }
  await flush();
  assert.equal(w.vm.plain, '4901');
  assert.equal(w.vm.withNumber, 491);
  assert.equal(w.vm.typeNumber, 491);   // у type="number" v-model приводит к числу сам
}

console.log('practice ok');
