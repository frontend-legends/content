// Глава 9.08 — порталы: DOM в body, события всплывают по дереву React, контекст проходит,
// нативный слушатель на DOM-родителе портала не видит; закрытие модалки по клику на оверлей.
// run: node portals.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { createContext, useContext, useState } = React;
const { createPortal } = require('react-dom');

(async () => {
  const Theme = createContext('light');
  const calls = [];
  function Modal({ onClose, children }) {
    const theme = useContext(Theme);
    return createPortal(
      h('div', { className: 'overlay', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('div', { role: 'dialog', 'aria-modal': 'true', className: theme }, children)),
      document.body,
    );
  }
  function Card() {
    const [open, setOpen] = useState(true);
    return h(Theme, { value: 'dark' },
      h('article', { id: 'card', onClick: () => calls.push('card onClick') },
        open && h(Modal, { onClose: () => { calls.push('close'); setOpen(false); } }, h('button', { id: 'inside' }, 'ok'))));
  }
  const { container } = await mount(h(Card));
  let nativeOnCard = 0;
  container.querySelector('#card').addEventListener('click', () => nativeOnCard++);

  const dialog = document.body.querySelector('[role=dialog]');
  assert.ok(dialog);
  assert.equal(container.querySelector('[role=dialog]'), null); // в DOM модалка не внутри карточки
  assert.equal(dialog.className, 'dark');                      // контекст прошёл через портал

  await React.act(async () => document.getElementById('inside').click());
  assert.deepEqual(calls, ['card onClick']); // React-всплытие дошло до карточки, оверлей не закрыл
  assert.equal(nativeOnCard, 0);             // нативный слушатель карточки клика не видел

  await React.act(async () => document.body.querySelector('.overlay').click());
  assert.deepEqual(calls, ['card onClick', 'close', 'card onClick']);
  assert.equal(document.body.querySelector('[role=dialog]'), null);
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
