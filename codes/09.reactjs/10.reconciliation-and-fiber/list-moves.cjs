// Глава 9.10 — «Как сравниваются списки»: сколько DOM-перемещений даёт перестановка в списке с ключами.
// React двигает элементы, которые «уехали левее» последнего оставшегося на месте: перенос последнего
// в начало — n-1 перемещений, перенос первого в конец — одно.
// run: node list-moves.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');

async function moves(from, to) {
  const list = (ids) => h('ul', null, ids.map((id) => h('li', { key: id }, id)));
  const m = await mount(list(from));
  const ul = m.container.querySelector('ul');
  const nodes = new Map([...ul.children].map((li) => [li.textContent, li]));
  const moved = [];
  const mo = new window.MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => moved.push(n.textContent))));
  mo.observe(ul, { childList: true });
  await m.render(list(to));
  await new Promise((r) => setTimeout(r, 0));
  mo.disconnect();
  // узлы те же — только переставлены
  [...ul.children].forEach((li) => assert.equal(nodes.get(li.textContent), li));
  assert.deepEqual([...ul.children].map((li) => li.textContent), to);
  return moved;
}

(async () => {
  const abcde = ['A', 'B', 'C', 'D', 'E'];
  const lastToFirst = await moves(abcde, ['E', 'A', 'B', 'C', 'D']);
  const firstToLast = await moves(abcde, ['B', 'C', 'D', 'E', 'A']);
  const swap = await moves(abcde, ['A', 'D', 'C', 'B', 'E']);
  console.log('E в начало:', lastToFirst.join(','), '| A в конец:', firstToLast.join(','), '| swap B↔D:', swap.join(','));
  assert.deepEqual(lastToFirst, ['A', 'B', 'C', 'D']);
  assert.deepEqual(firstToLast, ['A']);
  assert.deepEqual(swap, ['C', 'B']);
})().catch((e) => { console.log(e); process.exit(1); });
