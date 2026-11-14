// Глава 9.01 — «Рендер и commit» и «Что запускает рендер»: DOM-узлы переиспользуются, меняется только разница;
// ребёнок рендерится вместе с родителем, даже если его props не менялись.
// run: node render-commit.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo } = React;

(async () => {
  // сквозной пример: LikeButton
  let toggle;
  function LikeButton() {
    const [liked, setLiked] = useState(false);
    toggle = () => setLiked((v) => !v);
    return h('button', { className: liked ? 'active' : '' }, liked ? 'Liked' : 'Like');
  }
  const { container } = await mount(h(LikeButton));
  const before = container.querySelector('button');
  const textBefore = before.firstChild;

  // считаем мутации DOM во время commit
  const mutations = [];
  const mo = new window.MutationObserver((list) => mutations.push(...list));
  mo.observe(container, { subtree: true, childList: true, attributes: true, characterData: true });
  await React.act(async () => toggle());
  await new Promise((r) => setTimeout(r, 0));
  mo.disconnect();

  const after = container.querySelector('button');
  assert.equal(after, before, 'тот же <button>, а не новый');
  assert.equal(after.firstChild, textBefore, 'тот же текстовый узел');
  assert.equal(after.outerHTML, '<button class="active">Liked</button>');
  const kinds = mutations.map((m) => m.type).sort();
  assert.deepEqual(kinds, ['attributes', 'characterData']); // class и текст — больше ничего
  console.log('commit: узлы переиспользованы, мутаций:', kinds.join(', '));

  // что запускает рендер: состояние родителя → рендер детей, хотя их props те же
  const renders = { child: 0, memoChild: 0, slot: 0 };
  function Child() { renders.child++; return null; }
  const MemoChild = memo(function MemoChild() { renders.memoChild++; return null; });
  function Slot() { renders.slot++; return null; }
  let bump;
  function Parent({ children }) {
    const [n, setN] = useState(0);
    bump = () => setN((x) => x + 1);
    return h('div', null, n, h(Child, { label: 'same' }), h(MemoChild, { label: 'same' }), children);
  }
  await mount(h(Parent, null, h(Slot)));
  await React.act(async () => bump());
  await React.act(async () => bump());
  // Child — 3 (mount + 2), memo-ребёнок и элемент из children — только mount
  assert.deepEqual(renders, { child: 3, memoChild: 1, slot: 1 });
  console.log('рендеры после двух апдейтов родителя:', JSON.stringify(renders));
})().catch((e) => { console.log(e); process.exit(1); });
