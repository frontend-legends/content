// Глава 9.18 — Actions на клиенте: <form action={fn}>, useActionState, useFormStatus, useOptimistic,
// сброс неуправляемой формы после действия, async-функция в startTransition, use(promise), метаданные в <head>.
// run: node actions.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useActionState, useOptimistic, useTransition, use, Suspense, useState } = React;
const { useFormStatus } = require('react-dom');
// React строит FormData из глобального конструктора: в Node он свой и не знает DOM-форм jsdom
globalThis.FormData = window.FormData;
const wait = (ms) => React.act(async () => new Promise((r) => setTimeout(r, ms)));
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
const type = (input, v) => setter.call(input, v);

(async () => {
  // useActionState + useFormStatus: pending во время действия, результат после, форма сброшена
  {
    const seen = [];
    async function addTodo(prev, formData) {
      await new Promise((r) => setTimeout(r, 30));
      const text = formData.get('text');
      if (!text) return { ...prev, error: 'Пустая задача' };
      return { items: [...prev.items, text], error: null };
    }
    function SubmitButton() { const { pending } = useFormStatus(); seen.push(`button pending=${pending}`); return h('button', { type: 'submit', disabled: pending }, pending ? '…' : 'Добавить'); }
    function Todos() {
      const [state, formAction, isPending] = useActionState(addTodo, { items: [], error: null });
      return h('form', { action: formAction },
        h('input', { name: 'text' }), h(SubmitButton),
        h('ul', null, state.items.map((t) => h('li', { key: t }, t))),
        state.error && h('p', { role: 'alert' }, state.error),
        h('i', null, `pending=${isPending}`));
    }
    const { container } = await mount(h(Todos));
    const form = container.querySelector('form');
    type(container.querySelector('input'), 'купить чай');
    await React.act(async () => form.requestSubmit());
    assert.equal(container.querySelector('i').textContent, 'pending=true');
    assert.equal(container.querySelector('button').disabled, true);
    await wait(60);
    assert.equal(container.querySelector('li').textContent, 'купить чай');
    assert.equal(container.querySelector('input').value, '');            // неуправляемая форма сброшена
    assert.ok(seen.includes('button pending=true'));
    await React.act(async () => form.requestSubmit());
    await wait(60);
    assert.equal(container.querySelector('[role=alert]').textContent, 'Пустая задача');
  }

  // useOptimistic: значение сразу, откат после завершения действия, если реальное состояние не изменилось
  {
    let likeOk = true;
    async function save() { await new Promise((r) => setTimeout(r, 30)); if (!likeOk) throw new Error('offline'); }
    function Like() {
      const [liked, setLiked] = useState(false);
      const [optimistic, setOptimistic] = useOptimistic(liked);
      const [, startTransition] = useTransition();
      const toggle = () => startTransition(async () => {
        setOptimistic(!liked);
        try { await save(); startTransition(() => setLiked(!liked)); } catch {}
      });
      return h('button', { onClick: toggle }, optimistic ? '♥' : '♡');
    }
    const { container } = await mount(h(Like));
    const btn = container.querySelector('button');
    await React.act(async () => btn.click());
    assert.equal(btn.textContent, '♥');   // сразу
    await wait(60);
    assert.equal(btn.textContent, '♥');   // сервер подтвердил
    likeOk = false;
    await React.act(async () => btn.click());
    assert.equal(btn.textContent, '♡');   // сразу
    await wait(60);
    assert.equal(btn.textContent, '♥');   // ошибка — оптимистичное значение ушло, осталось реальное
  }

  // use(promise) под Suspense
  {
    const commentsPromise = new Promise((r) => setTimeout(() => r(['первый', 'второй']), 20));
    function Comments({ promise }) { return h('ul', null, use(promise).map((c) => h('li', { key: c }, c))); }
    const { container } = await mount(h(Suspense, { fallback: h('p', null, 'загрузка') }, h(Comments, { promise: commentsPromise })));
    assert.equal(container.textContent, 'загрузка');
    for (let i = 0; i < 40 && container.textContent === 'загрузка'; i++) await wait(10);
    assert.equal(container.textContent, 'первыйвторой');
  }

  // метаданные документа: <title> из компонента поднимается в <head>
  {
    function ProductPage() { return h('article', null, h('title', null, 'Чайник — магазин'), h('meta', { name: 'description', content: 'Чайник на 1,7 л' }), h('h1', null, 'Чайник')); }
    const { container } = await mount(h(ProductPage));
    assert.equal(document.head.querySelector('title').textContent, 'Чайник — магазин');
    assert.equal(document.head.querySelector('meta[name=description]').content, 'Чайник на 1,7 л');
    assert.equal(container.querySelector('title'), null);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
