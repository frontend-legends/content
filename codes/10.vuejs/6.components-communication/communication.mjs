// Глава 10.06 — связь компонентов: пропсы только для чтения, проверки пропсов, события не всплывают,
// необъявленное событие вызывается дважды, v-model и defineModel, fallthrough-атрибуты.
// run: node communication.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings } from '../../_lib/vue.mjs';

const reg = (name, c) => { window[name] = c; return c; };

// --- пропсы только для чтения (поверхностно)
{
  reg('__P', await sfc(`<script setup>
const props = defineProps({ title: String, product: Object });
function rename() { props.title = 'Кофе'; }
function mutateNested() { props.product.price = 1; }
defineExpose({ rename, mutateNested, props });
</script><template><p>{{ title }}</p></template>`, 'P.vue'));
  const Parent = await sfc(`<script setup>
import { reactive, useTemplateRef } from 'vue';
const P = window.__P; const product = reactive({ price: 490 });
const child = useTemplateRef('child');
defineExpose({ child, product });
</script><template><P ref="child" title="Чай" :product="product" /></template>`);
  const w = await mount(Parent);
  const before = warnings.length;
  w.vm.child.rename();
  assert.equal(w.vm.child.props.title, 'Чай');   // запись отклонена
  assert.ok(warnings.slice(before).some((m) => m.includes('Attempt to mutate prop "title"') || m.includes('target is readonly')));
  w.vm.child.mutateNested();
  assert.equal(w.vm.product.price, 1);            // вложенное изменилось у родителя — молча
}

// --- проверки пропсов, Boolean, значения по умолчанию
{
  const C = await sfc(`<script setup>
const props = defineProps({
  sku: { type: String, required: true },
  qty: { type: Number, default: 1, validator: (v) => v > 0 },
  disabled: Boolean,
  tags: { type: Array, default: () => [] },
  maxItems: Number,
});
defineExpose({ props });
</script><template><p :data-max="maxItems">{{ qty }}|{{ disabled }}|{{ tags.length }}</p></template>`);
  window.__C = C;
  const before = warnings.length;
  const P1 = await sfc(`<script setup>const C = window.__C;</script><template><C :qty="0" /><C sku="tea" disabled max-items="5" /></template>`);
  const w = await mount(P1);
  const w0 = warnings.slice(before);
  assert.ok(w0.some((m) => m.includes('Missing required prop: "sku"')));
  assert.ok(w0.some((m) => m.includes('Invalid prop: custom validator check failed for prop "qty"')));
  assert.ok(w0.some((m) => m.includes('Invalid prop: type check failed for prop "maxItems". Expected Number with value 5, got String')));
  const ps = w.container.querySelectorAll('p');
  assert.equal(ps[0].textContent, '0|false|0');   // Boolean без атрибута — false, а не undefined
  assert.equal(ps[1].textContent, '1|true|0');    // атрибут без значения — true
}

// --- деструктуризация пропсов в script setup реактивна; копия в ref — нет
{
  reg('__D', await sfc(`<script setup>
import { ref } from 'vue';
const { price } = defineProps({ price: Number });
const local = ref(price);
</script><template><p>{{ price }}|{{ local }}</p></template>`, 'D.vue'));
  const P = await sfc(`<script setup>import { ref } from 'vue'; const D = window.__D; const price = ref(490); defineExpose({ price });</script><template><D :price="price" /></template>`);
  const w = await mount(P);
  w.vm.price = 500; await flush();
  assert.equal(w.text(), '500|490');   // local — начальное значение, дальше не следит
}

// --- события не всплывают; «доходят» только через fallthrough на единственный корень
{
  reg('__Leaf', await sfc(`<script setup>const emit = defineEmits(['add']);</script><template><button @click="emit('add', 7, 2)">+</button></template>`, 'Leaf.vue'));
  reg('__MidRoot', await sfc(`<script setup>const Leaf = window.__Leaf;</script><template><Leaf /></template>`, 'MidRoot.vue'));
  reg('__MidDiv', await sfc(`<script setup>const Leaf = window.__Leaf;</script><template><div class="mid"><Leaf /></div></template>`, 'MidDiv.vue'));
  reg('__MidDeclared', await sfc(`<script setup>const Leaf = window.__Leaf; defineEmits(['add']);</script><template><Leaf /></template>`, 'MidDeclared.vue'));
  const Top = await sfc(`<script setup>
import { ref } from 'vue'; const MidRoot = window.__MidRoot; const MidDiv = window.__MidDiv; const MidDeclared = window.__MidDeclared; const log = ref([]);
defineExpose({ log });
</script><template>
<MidRoot @add="(id) => log.push('root ' + id)" />
<MidDiv @add="(id) => log.push('div ' + id)" />
<MidDeclared @add="(id) => log.push('declared ' + id)" />
</template>`);
  const w = await mount(Top);
  w.container.querySelectorAll('button').forEach((b) => b.click());
  await flush();
  // MidRoot: слушатель не объявлен и ушёл на корень — компонент Leaf; MidDiv: корень div, событие компонента не DOM-событие;
  // MidDeclared: объявил add, значит слушатель его собственный, а сам он add не испускает
  assert.deepEqual(w.vm.log, ['root 7']);
}

// --- необъявленное событие click: и emit, и нативный клик по корню
{
  for (const declared of [false, true]) {
    reg('__Btn', await sfc(`<script setup>
${declared ? "const emit = defineEmits(['click']);" : 'const emit = defineEmits([]);'}
</script><template><button @click="emit('click', 'кастомный')">Купить</button></template>`, `Btn${declared}.vue`));
    const P = await sfc(`<script setup>import { ref } from 'vue'; const Btn = window.__Btn; const calls = ref([]); defineExpose({ calls });</script>
<template><Btn @click="(e) => calls.push(typeof e === 'string' ? e : 'native')" /></template>`, `BtnParent${declared}.vue`);
    const w = await mount(P);
    w.container.querySelector('button').click(); await flush();
    assert.deepEqual(w.vm.calls, declared ? ['кастомный'] : ['кастомный', 'native'], String(declared));
  }
}

// --- v-model на компоненте: вручную и через defineModel, несколько моделей, модификаторы, без родителя
{
  reg('__Manual', await sfc(`<script setup>
defineProps(['modelValue']); const emit = defineEmits(['update:modelValue']);
</script><template><input class="manual" :value="modelValue" @input="emit('update:modelValue', $event.target.value)"></template>`, 'Manual.vue'));
  reg('__Qty', await sfc(`<script setup>
const qty = defineModel({ type: Number, default: 1 });
const [note, mods] = defineModel('note');
function onNote(e) { note.value = mods.upper ? e.target.value.toUpperCase() : e.target.value; }
defineExpose({ qty });
</script><template><button class="inc" @click="qty++">+</button><input class="note" :value="note" @input="onNote"></template>`, 'Qty.vue'));
  const P = await sfc(`<script setup>
import { ref } from 'vue'; const Manual = window.__Manual; const Qty = window.__Qty;
const q = ref(''); const qty = ref(2); const comment = ref('');
defineExpose({ q, qty, comment });
</script><template><Manual v-model="q" /><Qty v-model="qty" v-model:note.upper="comment" /><Qty class="free" /></template>`);
  const w = await mount(P);
  const manual = w.container.querySelector('.manual');
  manual.value = 'чай'; manual.dispatchEvent(new Event('input')); await flush();
  assert.equal(w.vm.q, 'чай');
  w.container.querySelector('.inc').click(); await flush();
  assert.equal(w.vm.qty, 3);
  const note = w.container.querySelector('.note');
  note.value = 'срочно'; note.dispatchEvent(new Event('input')); await flush();
  assert.equal(w.vm.comment, 'СРОЧНО');
  // без v-model у родителя defineModel работает как локальное состояние
  const incs = w.container.querySelectorAll('.inc');
  incs[1].click(); await flush();
  assert.equal(w.vm.qty, 3);
}

// --- fallthrough-атрибуты
{
  reg('__Card', await sfc(`<template><article class="card"><slot /></article></template>`, 'Card.vue'));
  reg('__Field', await sfc(`<script setup>
defineOptions({ inheritAttrs: false });
defineProps(['label']);
</script><template><label class="field">{{ label }}<input v-bind="$attrs"></label></template>`, 'Field.vue'));
  reg('__Multi', await sfc(`<template><h3>a</h3><p>b</p></template>`, 'Multi.vue'));
  const before = warnings.length;
  const P = await sfc(`<script setup>
import { ref } from 'vue'; const Card = window.__Card; const Field = window.__Field; const Multi = window.__Multi;
const clicks = ref(0); defineExpose({ clicks });
</script><template>
<Card class="highlight" data-sku="tea" style="color: red" @click="clicks++">x</Card>
<Field label="Email" type="email" placeholder="a@b.ru" class="wide" />
<Multi data-x="1" />
</template>`);
  const w = await mount(P);
  const card = w.container.querySelector('article');
  assert.equal(card.className, 'card highlight');     // классы слились
  assert.equal(card.dataset.sku, 'tea');
  assert.equal(card.style.color, 'red');
  card.click(); await flush();
  assert.equal(w.vm.clicks, 1);                       // слушатель стал нативным на корне
  const input = w.container.querySelector('.field input');
  assert.equal(input.type, 'email');
  assert.equal(input.className, 'wide');              // inheritAttrs: false — всё ушло на input
  assert.equal(w.container.querySelector('label').className, 'field');
  assert.ok(warnings.slice(before).some((m) => m.includes('Extraneous non-props attributes (data-x)')));
}
console.log('communication ok');
