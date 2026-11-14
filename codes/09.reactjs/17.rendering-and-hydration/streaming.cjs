// Глава 9.17 — стриминг SSR: оболочка с fallback уходит сразу, медленный блок приходит отдельным куском
// со скриптом, который ставит его на место fallback. renderToString так не умеет — он отдаёт fallback навсегда.
// run: node streaming.cjs
const assert = require('node:assert/strict');
const React = require('react');
const { renderToPipeableStream, renderToString } = require('react-dom/server');
const { Writable } = require('node:stream');
const h = React.createElement;

// ресурс, который «грузится» 100 мс: бросает промис, пока не готов (так работает use() с кешем)
function createResource(value, ms) {
  let status = 'pending', result;
  const promise = new Promise((r) => setTimeout(() => { status = 'done'; result = value; r(); }, ms));
  return { read() { if (status === 'pending') throw promise; return result; } };
}

function Page({ reviews }) {
  return h('main', null,
    h('h1', null, 'Чайник'),
    h(React.Suspense, { fallback: h('p', null, 'загружаем отзывы…') }, h(Reviews, { reviews })));
}
function Reviews({ reviews }) { return h('ul', null, reviews.read().map((r) => h('li', { key: r }, r))); }

(async () => {
  const chunks = [];
  const t0 = Date.now();
  await new Promise((resolve) => {
    const sink = new Writable({
      write(chunk, _enc, cb) { chunks.push({ at: Date.now() - t0, html: chunk.toString() }); cb(); },
      final(cb) { cb(); resolve(); },
    });
    const { pipe } = renderToPipeableStream(h(Page, { reviews: createResource(['отлично', 'шумный'], 100) }), {
      onShellReady() { pipe(sink); },
    });
  });

  const first = chunks[0];
  assert.ok(first.at < 50, 'оболочка ушла сразу');
  assert.ok(first.html.includes('<h1>Чайник</h1>'));
  assert.ok(first.html.includes('загружаем отзывы…'));
  assert.ok(!first.html.includes('отлично'));
  const later = chunks.filter((c) => c.html.includes('отлично'));
  assert.equal(later.length, 1);
  assert.ok(later[0].at >= 90, 'отзывы пришли позже');
  assert.ok(later[0].html.includes('hidden') && later[0].html.includes('<script>'), 'скрытый блок + скрипт подмены');
  console.log(`оболочка: ${first.at} мс, отзывы: ${later[0].at} мс, кусков: ${chunks.length}`);

  // renderToString не ждёт Suspense: отдаёт fallback
  const html = renderToString(h(Page, { reviews: createResource(['x'], 50) }));
  assert.ok(html.includes('загружаем отзывы…') && !html.includes('<li>'));
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
