// Глава 10.17 — SSR во Vue: что выполняется на сервере, гидратация переиспользует узлы, расхождения текста
// и атрибутов, data-allow-mismatch, useId, стриминг, ленивая гидратация.
// run: node ssr.mjs
import assert from 'node:assert/strict';
import { mount, flush, warnings, vue } from '../../_lib/vue.mjs';
import { renderToString, renderToWebStream } from 'vue/server-renderer';
const { h, ref, createSSRApp, defineComponent, onMounted, onServerPrefetch, useId, watch, defineAsyncComponent, hydrateOnVisible, hydrateOnIdle, hydrateOnInteraction } = vue;

// --- на сервере: setup и onServerPrefetch выполняются, onMounted и watch — нет
{
  const log = [];
  const C = defineComponent({
    setup() {
      const product = ref(null);
      const n = ref(0);
      log.push('setup');
      onServerPrefetch(async () => { product.value = { title: 'Улун' }; log.push('prefetch'); });
      onMounted(() => log.push('mounted'));
      watch(n, () => log.push('watch'));
      n.value++;
      return () => h('h1', product.value?.title ?? '…');
    },
  });
  const html = await renderToString(createSSRApp(C));
  assert.equal(html, '<h1>Улун</h1>');               // рендер дождался onServerPrefetch
  assert.deepEqual(log, ['setup', 'prefetch']);
}

// --- гидратация переиспользует узлы сервера и навешивает обработчики
async function hydrate(Comp, serverHtml) {
  const container = document.createElement('div');
  container.innerHTML = serverHtml;
  document.body.appendChild(container);
  const before = container.firstElementChild;
  const app = createSSRApp(Comp);
  app.config.warnHandler = (m) => warnings.push(m);
  const vm = app.mount(container);
  await flush();
  return { container, before, vm };
}
{
  const Counter = defineComponent({ setup() { const n = ref(0); return () => h('button', { onClick: () => n.value++ }, `В корзине: ${n.value}`); } });
  const html = await renderToString(createSSRApp(Counter));
  const { container, before } = await hydrate(Counter, html);
  assert.equal(container.firstElementChild, before);   // тот же узел, не пересоздан
  before.click(); await flush();
  assert.equal(before.textContent, 'В корзине: 1');     // обработчик навешен
}

// --- расхождение: текст исправляется на клиентский, атрибут — остаётся серверным
{
  const isServer = { v: true };
  const Clock = defineComponent({ setup: () => () => h('p', { class: isServer.v ? 'server' : 'client' }, isServer.v ? '12:00' : '12:01') });
  const html = await renderToString(createSSRApp(Clock));
  isServer.v = false;
  const before = warnings.length;
  const { container } = await hydrate(Clock, html);
  const w = warnings.slice(before).join('\n');
  assert.match(w, /Hydration text content mismatch/);
  assert.match(w, /Hydration class mismatch/);
  assert.equal(container.firstElementChild.textContent, '12:01');   // текст — клиентский
  assert.equal(container.firstElementChild.className, 'server');    // класс — серверный
}

// --- data-allow-mismatch глушит ожидаемое расхождение
{
  const isServer = { v: true };
  const Time = defineComponent({ setup: () => () => h('time', { 'data-allow-mismatch': 'text' }, isServer.v ? 'сервер' : 'клиент') });
  const html = await renderToString(createSSRApp(Time));
  isServer.v = false;
  const before = warnings.length;
  await hydrate(Time, html);
  assert.equal(warnings.slice(before).filter((m) => m.includes('mismatch')).length, 0);
}

// --- useId совпадает на сервере и клиенте
{
  const Field = defineComponent({ setup() { const id = useId(); return () => h('div', [h('label', { for: id }, 'Email'), h('input', { id })]); } });
  const Form = defineComponent({ setup: () => () => h('form', [h(Field), h(Field)]) });
  const html = await renderToString(createSSRApp(Form));
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, 2);
  const before = warnings.length;
  const { container } = await hydrate(Form, html);
  assert.deepEqual([...container.querySelectorAll('input')].map((i) => i.id), ids);
  assert.equal(warnings.slice(before).filter((m) => m.includes('mismatch')).length, 0);
}

// --- стриминг: HTML отдаётся частями
{
  const Slow = defineComponent({ async setup() { await new Promise((r) => setTimeout(r, 10)); return () => h('section', 'отзывы'); } });
  const Page = defineComponent({ setup: () => () => h('main', [h('h1', 'Товар'), h(Slow)]) });
  const stream = renderToWebStream(createSSRApp(Page));
  const reader = stream.getReader();
  const chunks = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(typeof value === 'string' ? value : new TextDecoder().decode(value)); }
  assert.ok(chunks.length > 1);
  assert.equal(chunks.join(''), '<main><h1>Товар</h1><section>отзывы</section></main>');
}

// --- ленивая гидратация: стратегии экспортируются из vue
assert.equal(typeof hydrateOnVisible, 'function');
assert.equal(typeof hydrateOnIdle, 'function');
assert.equal(typeof hydrateOnInteraction, 'function');
const LazyReviews = defineAsyncComponent({ loader: () => Promise.resolve({ render: () => h('p') }), hydrate: hydrateOnVisible() });
assert.ok(LazyReviews);
console.log('ssr ok');
