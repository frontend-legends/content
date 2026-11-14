// Глава 9.02 — «Списки и ключи»: индекс как ключ переносит состояние на чужую строку, key сбрасывает состояние.
// run: node keys.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState } = React;

function Row({ item }) {
  const [note, setNote] = useState('');
  return h('li', { 'data-note': note, onClick: () => setNote(`заметка к ${item.name}`) }, item.name);
}
const rows = (container) => [...container.querySelectorAll('li')].map((li) => `${li.textContent}:${li.dataset.note}`);

(async () => {
  for (const keyBy of ['index', 'id']) {
    let setItems;
    function List() {
      const [items, set] = useState([{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }]);
      setItems = set;
      return h('ul', null, items.map((item, i) => h(Row, { key: keyBy === 'index' ? i : item.id, item })));
    }
    const { container } = await mount(h(List));
    await React.act(async () => container.querySelector('li').click()); // заметка к Ann
    await React.act(async () => setItems((list) => [{ id: 3, name: 'Eve' }, ...list])); // вставка в начало
    const got = rows(container);
    console.log(`key=${keyBy}:`, got.join(' | '));
    if (keyBy === 'index') assert.deepEqual(got, ['Eve:заметка к Ann', 'Ann:', 'Bob:']); // заметка уехала на Eve
    else assert.deepEqual(got, ['Eve:', 'Ann:заметка к Ann', 'Bob:']);
  }

  // без key — предупреждение в dev
  errors.length = 0;
  await mount(h('ul', null, ['a', 'b'].map((x) => h('li', null, x))));
  assert.ok(errors.some((e) => e.startsWith('Each child in a list should have a unique "key" prop.')));

  // key вне списка: смена key = новый экземпляр с чистым состоянием
  function Draft({ user }) { const [text] = useState(user.bio); return h('textarea', { defaultValue: text }); }
  const m = await mount(h(Draft, { user: { id: 1, bio: 'ann' }, key: 1 }));
  await m.render(h(Draft, { user: { id: 2, bio: 'bob' }, key: 2 }));
  assert.equal(m.container.querySelector('textarea').value, 'bob');
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
