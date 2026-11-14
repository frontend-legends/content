// Глава 9.11 — «Длинные списки»: ключ-индекс при вставке в начало заставляет все memo-строки
// рендериться и сдвигает их state; ключ-id — рендерится одна новая строка. Плюс расчёт окна виртуализации.
// run: node lists.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo } = React;

// окно виртуализации: какие строки рендерить при данной прокрутке
function getRange({ scrollTop, viewport, rowHeight, count, overscan = 3 }) {
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewport / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start, end, offsetTop: start * rowHeight, totalHeight: count * rowHeight };
}

(async () => {
  for (const keyBy of ['index', 'id']) {
    let prepend, rows = 0;
    const Row = memo(function Row({ item }) {
      rows++;
      const [note] = useState(`note for ${item.name}`); // локальный state строки
      return h('li', null, `${item.name}: ${note}`);
    });
    function List() {
      const [items, setItems] = useState(Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `p${i}` })));
      prepend = () => setItems((xs) => [{ id: -1, name: 'new' }, ...xs]);
      return h('ul', null, items.map((item, i) => h(Row, { key: keyBy === 'id' ? item.id : i, item })));
    }
    const { container } = await mount(h(List));
    rows = 0;
    await React.act(async () => prepend());
    const first = container.querySelector('li').textContent;
    console.log(`key=${keyBy}: строк отрендерено ${rows}, первая — «${first}»`);
    if (keyBy === 'index') {
      assert.equal(rows, 1001);                       // у каждого индекса новый item → memo не спасает
      assert.equal(first, 'new: note for p0');        // state строки p0 «переехал» к новой
    } else {
      assert.equal(rows, 1);                          // только новая строка
      assert.equal(first, 'new: note for new');
    }
  }

  // 10 000 строк по 40px, окно 600px, прокрутка 4000px → в DOM 21 строка
  const r = getRange({ scrollTop: 4000, viewport: 600, rowHeight: 40, count: 10000 });
  assert.deepEqual(r, { start: 97, end: 118, offsetTop: 3880, totalHeight: 400000 });
  assert.equal(r.end - r.start, 21);
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
