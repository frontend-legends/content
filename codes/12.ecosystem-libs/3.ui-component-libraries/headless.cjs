// Глава 12.03 — что даёт headless-библиотека: Radix Dialog против наивной модалки на div.
// Роль и подписи, фокус внутрь и обратно, Escape, блокировка остального для скринридера — и никаких стилей.
// run: node headless.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
// Radix использует браузерные API, которых обвязка не выставляет глобально
for (const k of ['getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'HTMLElement', 'Node', 'Element', 'KeyboardEvent', 'MutationObserver', 'NodeFilter', 'HTMLInputElement', 'DocumentFragment', 'ShadowRoot']) {
  if (!(k in globalThis)) globalThis[k] = typeof window[k] === 'function' && /^[a-z]/.test(k) ? window[k].bind(window) : window[k];
}
// события — из jsdom, иначе jsdom не примет их в dispatchEvent
for (const k of ['Event', 'CustomEvent', 'FocusEvent', 'MouseEvent', 'PointerEvent']) if (window[k]) globalThis[k] = window[k];
const Dialog = require('@radix-ui/react-dialog');
const { useState } = React;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // --- наивная модалка: выглядит как модалка, но ничего из этого не умеет
  function NaiveModal() {
    const [open, setOpen] = useState(false);
    return h('div', null,
      h('button', { id: 'naive-open', onClick: () => setOpen(true) }, 'Быстрый просмотр'),
      open && h('div', { className: 'modal' }, h('h2', null, 'Улун'), h('button', { onClick: () => setOpen(false) }, '×')));
  }
  const naive = await mount(h(NaiveModal));
  const openBtn = naive.container.querySelector('#naive-open');
  openBtn.focus();
  await React.act(async () => openBtn.click());
  const modal = naive.container.querySelector('.modal');
  assert.equal(modal.getAttribute('role'), null);                     // скринридер не знает, что это диалог
  assert.equal(document.activeElement, openBtn);                     // фокус остался под модалкой
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await wait(10);
  assert.ok(naive.container.querySelector('.modal'));                // Escape не закрывает
  naive.root.unmount();

  // --- Radix Dialog: поведение и доступность из коробки, внешний вид — твой
  function QuickView() {
    return h(Dialog.Root, null,
      h(Dialog.Trigger, { id: 'open' }, 'Быстрый просмотр'),
      h(Dialog.Portal, null,
        h(Dialog.Overlay, { className: 'overlay' }),
        h(Dialog.Content, { className: 'modal' },
          h(Dialog.Title, null, 'Улун'),
          h(Dialog.Description, null, 'Китайский чай, 100 г'),
          h('input', { id: 'qty', defaultValue: 1 }),
          h(Dialog.Close, { id: 'close' }, '×'))));
  }
  const { container } = await mount(h('div', null, h(QuickView), h('main', { id: 'page' }, 'Каталог')));
  const trigger = container.querySelector('#open');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.focus();
  await React.act(async () => trigger.click());
  await wait(20);
  const dialog = document.querySelector('[role=dialog]');
  assert.ok(dialog);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  const title = document.getElementById(dialog.getAttribute('aria-labelledby'));
  assert.equal(title.textContent, 'Улун');                            // диалог подписан заголовком
  assert.equal(document.getElementById(dialog.getAttribute('aria-describedby')).textContent, 'Китайский чай, 100 г');
  assert.ok(dialog.contains(document.activeElement));                 // фокус переехал внутрь
  assert.equal(container.querySelector('#page').closest('[aria-hidden=true]') !== null, true);   // остальное скрыто от скринридера
  // единственный стиль библиотеки — блокировка прокрутки страницы под модалкой, внешнего вида она не задаёт
  const styles = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
  assert.match(styles, /body\[data-scroll-locked\] \{\s*overflow: hidden !important;/);
  assert.ok(document.body.hasAttribute('data-scroll-locked'));
  assert.equal(dialog.className, 'modal');
  await React.act(async () => {
    document.activeElement.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  await wait(20);
  assert.equal(document.querySelector('[role=dialog]'), null);        // Escape закрыл
  assert.equal(document.activeElement, trigger);                      // фокус вернулся на кнопку
  assert.ok(!document.body.hasAttribute('data-scroll-locked'));       // прокрутка разблокирована
  console.log('headless ok');
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
