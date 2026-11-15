// Глава 10.16 — безопасность Vue: экранирование интерполяции (и при SSR), v-html, javascript:-ссылки не блокируются,
// атрибуты из пользовательского объекта, компиляция пользовательского шаблона = выполнение кода, CSP и полная сборка.
// run: node security.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { sfc, mount, dom, vue } from '../../_lib/vue.mjs';
import { renderToString } from 'vue/server-renderer';
import createDOMPurify from 'dompurify';
const { h, createSSRApp, defineComponent } = vue;

const evil = '<img src=x onerror="alert(1)"><b>жирный</b>';

// --- интерполяция экранирует, в том числе на сервере
{
  const html = await renderToString(createSSRApp({ render: () => h('p', evil) }));
  assert.equal(html, '<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;b&gt;жирный&lt;/b&gt;</p>');
  const attr = await renderToString(createSSRApp({ render: () => h('a', { title: '"><script>x</script>' }, 'x') }));
  assert.equal(attr, '<a title="&quot;&gt;&lt;script&gt;x&lt;/script&gt;">x</a>');
}

// --- v-html вставляет как есть; DOMPurify вычищает
{
  const C = await sfc(`<script setup>defineProps(['raw', 'clean']);</script>
<template><div class="raw" v-html="raw"></div><div class="clean" v-html="clean"></div></template>`);
  const DOMPurify = createDOMPurify(dom.window);
  const w = await mount(C, { props: { raw: evil, clean: DOMPurify.sanitize(evil) } });
  assert.equal(w.container.querySelector('.raw img').getAttribute('onerror'), 'alert(1)');   // обработчик на месте
  assert.equal(w.container.querySelector('.clean img').hasAttribute('onerror'), false);
  assert.equal(w.container.querySelector('.clean b').textContent, 'жирный');                 // разметка сохранена
}

// --- javascript: в :href Vue не блокирует
{
  const C = await sfc(`<script setup>defineProps(['site']);</script><template><a :href="site">Сайт продавца</a></template>`);
  const w = await mount(C, { props: { site: 'javascript:alert(document.cookie)' } });
  assert.equal(w.container.querySelector('a').getAttribute('href'), 'javascript:alert(document.cookie)');
  // проверка протокола
  const safeUrl = (u) => { try { const p = new URL(u, 'https://shop.example').protocol; return p === 'https:' || p === 'http:' ? u : '#'; } catch { return '#'; } };
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl(' JaVaScRiPt:alert(1)'), '#');
  assert.equal(safeUrl('https://seller.example'), 'https://seller.example');
  assert.equal(safeUrl('/catalog'), '/catalog');
}

// --- v-bind пользовательского объекта: строковый onclick становится атрибутом-обработчиком
{
  const C = await sfc(`<script setup>defineProps(['attrs']);</script><template><button v-bind="attrs">Купить</button></template>`);
  const w = await mount(C, { props: { attrs: { title: 'ok', onclick: 'alert(1)', style: 'position:fixed;inset:0' } } });
  const b = w.container.querySelector('button');
  assert.equal(b.getAttribute('onclick'), 'alert(1)');
  assert.match(b.getAttribute('style'), /position: fixed; inset: 0/);   // перекрыть страницу — кликджекинг внутри сайта
}

// --- пользовательский текст как шаблон — выполнение кода
{
  const userBio = "Привет {{ ''.constructor.constructor('return 6 * 7')() }}";
  const w = await mount(defineComponent({ template: `<p>${userBio}</p>` }));
  assert.equal(w.text(), 'Привет 42');                    // выражение из пользовательских данных выполнилось
  const safe = await mount(defineComponent({ props: ['bio'], template: '<p>{{ bio }}</p>' }), { props: { bio: userBio } });
  assert.equal(safe.text(), userBio);                     // как данные — просто текст
}

// --- монтирование на готовый HTML: содержимое корня компилируется как шаблон; v-pre отключает
{
  const root = document.createElement('div');
  root.innerHTML = '<p class="comment">Комментарий: {{ 6 * 7 }}</p><p class="pre" v-pre>Комментарий: {{ 6 * 7 }}</p>';   // сервер экранировал HTML, но не {{ }}
  vue.createApp({}).mount(root);
  assert.equal(root.querySelector('.comment').textContent, 'Комментарий: 42');
  assert.equal(root.querySelector('.pre').textContent, 'Комментарий: {{ 6 * 7 }}');
}

// --- полная сборка компилирует шаблоны через new Function — под CSP нужен 'unsafe-eval'
{
  const require = createRequire(import.meta.url);
  const full = readFileSync(require.resolve('vue/dist/vue.global.js'), 'utf8');
  const runtime = readFileSync(require.resolve('vue/dist/vue.runtime.global.js'), 'utf8');
  assert.match(full, /const render = new Function\(code\)\(\)/);   // шаблон-строка → код → new Function
  assert.doesNotMatch(runtime, /new Function/);
}
console.log('security ok');
