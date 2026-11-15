// Глава 10.02 — шаблоны и директивы: интерполяция, привязки, v-if/v-show, v-for и key,
// классы и стили, модификаторы, v-model, свои директивы, во что компилируется шаблон.
// run: node templates.mjs
import assert from 'node:assert/strict';
import { sfc, mount, flush, warnings, vue } from '../../_lib/vue.mjs';
import { compile } from '@vue/compiler-dom';

const c = (tpl) => compile(tpl, { mode: 'module', prefixIdentifiers: true, cacheHandlers: true }).code;

// --- интерполяция экранирует HTML
{
  const C = await sfc(`<script setup>const name = '<img src=x onerror=alert(1)>';</script><template><p>{{ name }}</p></template>`);
  const w = await mount(C);
  assert.equal(w.container.querySelector('img'), null);
  assert.equal(w.text(), '<img src=x onerror=alert(1)>');
}

// --- привязки: false убирает булев атрибут, null/undefined — любой; v-bind объектом; сокращение :id (3.4)
{
  const C = await sfc(`<script setup>
const disabled = false; const title = null; const id = 'sku-7'; const attrs = { 'data-sku': 'tea', role: 'button' };
</script>
<template><button :disabled="disabled" :title="title" :id v-bind="attrs">Купить</button></template>`);
  const b = (await mount(C)).container.querySelector('button');
  assert.equal(b.hasAttribute('disabled'), false);
  assert.equal(b.hasAttribute('title'), false);
  assert.equal(b.id, 'sku-7');
  assert.equal(b.dataset.sku, 'tea');
}

// --- в шаблоне — выражения, а не инструкции; глобальные — только из белого списка
{
  assert.throws(() => compile('<p>{{ if (ok) { 1 } }}</p>', { prefixIdentifiers: true }), /Error parsing JavaScript expression/);
  const C = await sfc(`<template><p>{{ Math.max(1, 2) }}|{{ typeof window }}</p></template>`);
  assert.equal((await mount(C)).text(), '2|undefined');   // Math доступен, window — нет
}

// --- v-if пересоздаёт (состояние сбрасывается), v-show прячет стилем
{
  const Counter = await sfc(`<script setup>import { ref } from 'vue'; const n = ref(0);</script><template><button @click="n++">{{ n }}</button></template>`, 'Counter.vue');
  window.__Counter = Counter;
  const C = await sfc(`<script setup>
import { ref } from 'vue'; const Counter = window.__Counter;
const a = ref(true); const b = ref(true);
defineExpose({ a, b });
</script>
<template><div class="if"><Counter v-if="a" /></div><div class="show"><Counter v-show="b" /></div></template>`);
  const w = await mount(C);
  w.container.querySelector('.if button').click();
  w.container.querySelector('.show button').click();
  await flush();
  w.vm.a = false; w.vm.b = false; await flush();
  assert.equal(w.container.querySelector('.if button'), null);              // узла нет
  assert.equal(w.container.querySelector('.show button').style.display, 'none');   // узел есть
  w.vm.a = true; w.vm.b = true; await flush();
  assert.equal(w.container.querySelector('.if button').textContent, '0');   // состояние потеряно
  assert.equal(w.container.querySelector('.show button').textContent, '1'); // сохранено
}

// --- v-if выше v-for по приоритету: переменная цикла в v-if недоступна
{
  const before = warnings.length;
  const C = await sfc(`<script setup>const items = [{ id: 1, ok: true }];</script>
<template><ul><li v-for="i in items" v-if="i.ok" :key="i.id">x</li></ul></template>`);
  await assert.rejects(mount(C), /Cannot read properties of undefined \(reading 'ok'\)/);
  assert.ok(warnings.slice(before).some((m) => m.includes('Property "i" was accessed during render but is not defined')));
}

// --- v-for: диапазон начинается с 1, объект даёт значение, ключ и индекс
{
  const C = await sfc(`<script setup>const prices = { tea: 490, pot: 1500 };</script>
<template><p><span v-for="n in 3" :key="n">{{ n }}</span>|<span v-for="(v, k, i) in prices" :key="k">{{ i }}{{ k }}{{ v }};</span></p></template>`);
  assert.equal((await mount(C)).text(), '123|0tea490;1pot1500;');
}

// --- key: индекс вместо id путает состояние элементов при удалении
{
  const Row = await sfc(`<script setup>import { ref } from 'vue'; defineProps(['title']); const note = ref('');</script>
<template><li>{{ title }}<input v-model="note"></li></template>`, 'Row.vue');
  window.__Row = Row;
  for (const [keyExpr, expectedNote] of [['index', 'про чай'], ['p.id', '']]) {
    const C = await sfc(`<script setup>
import { ref } from 'vue'; const Row = window.__Row;
const list = ref([{ id: 1, title: 'Чай' }, { id: 2, title: 'Кофе' }]);
defineExpose({ list });
</script>
<template><ul><Row v-for="(p, index) in list" :key="${keyExpr}" :title="p.title" /></ul></template>`);
    const w = await mount(C);
    const input = w.container.querySelector('li input');
    input.value = 'про чай'; input.dispatchEvent(new Event('input')); await flush();
    w.vm.list.shift(); await flush();                 // удалили чай
    const li = w.container.querySelector('li');
    assert.equal(li.firstChild.textContent, 'Кофе');
    assert.equal(li.querySelector('input').value, expectedNote, keyExpr);   // с index заметка «уехала» к кофе
  }
}

// --- классы и стили: объект, массив, слияние со статическим классом
{
  const C = await sfc(`<script setup>const active = true; const error = false; const size = 'lg';</script>
<template><div class="card" :class="[{ active, error }, size]" :style="{ fontSize: '14px', '--accent': 'green' }"></div></template>`);
  const d = (await mount(C)).container.firstElementChild;
  assert.equal(d.className, 'card active lg');
  assert.equal(d.style.fontSize, '14px');
  assert.equal(d.style.getPropertyValue('--accent'), 'green');
}

// --- модификаторы событий
{
  const C = await sfc(`<script setup>
import { ref } from 'vue'; const log = ref([]);
defineExpose({ log });
</script>
<template>
<form @submit.prevent="log.push('submit')"><button>ok</button></form>
<div class="outer" @click="log.push('outer')"><button class="stop" @click.stop="log.push('inner')">x</button></div>
<button class="once" @click.once="log.push('once')">o</button>
<input class="enter" @keyup.enter="log.push('enter')">
</template>`);
  const w = await mount(C);
  const form = w.container.querySelector('form');
  const ev = new Event('submit', { cancelable: true });
  form.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true);
  w.container.querySelector('.stop').click();
  w.container.querySelector('.once').click(); w.container.querySelector('.once').click();
  const inp = w.container.querySelector('.enter');
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
  assert.deepEqual(w.vm.log, ['submit', 'inner', 'once', 'enter']);
}

// --- v-model: во что компилируется и модификаторы
{
  const code = c('<input v-model="q">');
  assert.match(code, /vModelText as _vModelText/);
  assert.match(code, /"onUpdate:modelValue": _cache\[0\] \|\| \(_cache\[0\] = \$event => \(\(_ctx\.q\) = \$event\)\)/);
  const comp = c('<MyInput v-model="q" />');
  assert.match(comp, /modelValue: _ctx\.q/);
  assert.match(comp, /"onUpdate:modelValue"/);

  const C = await sfc(`<script setup>
import { ref } from 'vue';
const q = ref(''); const lazy = ref(''); const qty = ref(1); const name = ref(''); const tags = ref([]); const agree = ref('no');
defineExpose({ q, lazy, qty, name, tags, agree });
</script>
<template>
<input class="q" v-model="q"><input class="lazy" v-model.lazy="lazy"><input class="qty" v-model.number="qty"><input class="name" v-model.trim="name">
<input type="checkbox" value="tea" v-model="tags"><input type="checkbox" value="pot" v-model="tags">
<input class="agree" type="checkbox" v-model="agree" true-value="yes" false-value="no">
</template>`);
  const w = await mount(C);
  const $ = (s) => w.container.querySelector(s);
  const type = (el, v, ev = 'input') => { el.value = v; el.dispatchEvent(new Event(ev)); };
  type($('.lazy'), 'x');
  assert.equal(w.vm.lazy, '');            // .lazy ждёт change, input игнорирует
  $('.lazy').dispatchEvent(new Event('change'));
  assert.equal(w.vm.lazy, 'x');
  type($('.q'), 'ча'); type($('.qty'), '3'); type($('.name'), '  Аня  ');
  await flush();
  assert.equal(w.vm.q, 'ча');
  assert.equal(w.vm.qty, 3);              // число, а не '3'
  assert.equal(w.vm.name, 'Аня');
  const boxes = w.container.querySelectorAll('input[type=checkbox]');
  boxes[1].click(); await flush(); boxes[0].click(); await flush();
  assert.deepEqual(w.vm.tags, ['pot', 'tea']);
  $('.agree').click(); await flush();
  assert.equal(w.vm.agree, 'yes');

  // IME: пока идёт набор (composition), v-model не обновляет значение
  $('.q').dispatchEvent(new Event('compositionstart'));
  type($('.q'), 'чаш'); await flush();
  assert.equal(w.vm.q, 'ча');
  $('.q').dispatchEvent(new Event('compositionend')); await flush();
  assert.equal(w.vm.q, 'чаш');
}

// --- динамический компонент и своя директива
{
  const A = { render: () => vue.h('b', 'A') }; const B = { render: () => vue.h('i', 'B') };
  window.__AB = { A, B };
  const C = await sfc(`<script setup>
import { ref, shallowRef } from 'vue';
const { A, B } = window.__AB;
const current = shallowRef(A);
const log = [];
const vFocus = { mounted: (el) => { el.focus(); log.push('mounted'); }, unmounted: () => log.push('unmounted') };
const show = ref(true);
defineExpose({ current, B, log, show });
</script>
<template><component :is="current" /><input v-if="show" v-focus></template>`);
  const w = await mount(C);
  assert.equal(w.container.querySelector('b').textContent, 'A');
  assert.equal(document.activeElement, w.container.querySelector('input'));
  w.vm.current = w.vm.B; w.vm.show = false; await flush();
  assert.equal(w.container.querySelector('i').textContent, 'B');
  assert.deepEqual(w.vm.log, ['mounted', 'unmounted']);
}

// --- во что компилируются v-if и v-for
assert.match(c('<p v-if="ok">a</p><p v-else>b</p>'), /\(_ctx\.ok\)\s*\? \(_openBlock\(\), _createElementBlock\("p"/);
assert.match(c('<li v-for="i in items" :key="i.id">{{ i.t }}</li>'), /_renderList\(_ctx\.items, \(i\) =>/);
console.log('templates ok');
