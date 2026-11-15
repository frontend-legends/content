// Глава 12.05 — формы: число рендеров у контролируемой формы на useState и у react-hook-form,
// валидация схемой через резолвер, нативная проверка ограничений.
// run: node forms.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { fireEvent } = require('@testing-library/react');
const { useForm } = require('react-hook-form');
const { zodResolver } = require('@hookform/resolvers/zod');
const { z } = require('zod');
const { useState } = React;
for (const k of ['Event', 'InputEvent', 'FocusEvent', 'HTMLInputElement', 'HTMLFormElement', 'Element', 'Node']) if (window[k]) globalThis[k] = window[k];

const type = async (input, text) => {
  for (let i = 1; i <= text.length; i++) {
    await React.act(async () => { fireEvent.input(input, { target: { value: text.slice(0, i) } }); });
  }
};

(async () => {
  // --- контролируемая форма: рендер формы на каждый символ
  let controlledRenders = 0;
  function Controlled() {
    controlledRenders++;
    const [form, setForm] = useState({ email: '', address: '' });
    return h('form', null,
      h('input', { name: 'email', value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }) }),
      h('input', { name: 'address', value: form.address, onChange: (e) => setForm({ ...form, address: e.target.value }) }));
  }
  const c = await mount(h(Controlled));
  controlledRenders = 0;
  await type(c.container.querySelector('[name=email]'), 'anna@shop.ru');
  assert.equal(controlledRenders, 12);                                // 12 символов — 12 рендеров всей формы

  // --- react-hook-form: поля не контролируются React, рендеров нет
  let rhfRenders = 0;
  let submitted = null;
  const schema = z.object({ email: z.email('Некорректный email'), address: z.string().min(5, 'Слишком короткий адрес') });
  function Checkout() {
    rhfRenders++;
    const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), mode: 'onSubmit' });
    return h('form', { onSubmit: handleSubmit((data) => { submitted = data; }) },
      h('input', register('email')),
      errors.email && h('p', { className: 'err-email' }, errors.email.message),
      h('input', register('address')),
      errors.address && h('p', { className: 'err-address' }, errors.address.message),
      h('button', { type: 'submit' }, 'Оформить'));
  }
  const r = await mount(h(Checkout));
  rhfRenders = 0;
  const email = r.container.querySelector('[name=email]');
  await type(email, 'anna@shop');
  assert.equal(rhfRenders, 0);                                        // ввод не перерисовывает форму
  await React.act(async () => { fireEvent.submit(r.container.querySelector('form')); });
  await React.act(async () => { await new Promise((res) => setTimeout(res, 10)); });
  assert.equal(r.container.querySelector('.err-email').textContent, 'Некорректный email');
  assert.equal(r.container.querySelector('.err-address').textContent, 'Слишком короткий адрес');
  assert.equal(submitted, null);
  assert.ok(rhfRenders > 0 && rhfRenders <= 3);                       // рендер — когда появились ошибки
  await type(email, 'anna@shop.ru');
  await type(r.container.querySelector('[name=address]'), 'Москва, Тверская 1');
  await React.act(async () => { fireEvent.submit(r.container.querySelector('form')); });
  await React.act(async () => { await new Promise((res) => setTimeout(res, 10)); });
  assert.deepEqual(submitted, { email: 'anna@shop.ru', address: 'Москва, Тверская 1' });

  // --- нативная проверка ограничений
  const form = document.createElement('form');
  form.innerHTML = '<input name="email" type="email" required><input name="qty" type="number" min="1" max="10" value="20">';
  const [mail, qty] = form.elements;
  assert.equal(mail.validity.valueMissing, true);
  mail.value = 'не почта';
  assert.equal(mail.validity.typeMismatch, true);
  assert.equal(qty.validity.rangeOverflow, true);
  assert.equal(form.checkValidity(), false);
  mail.value = 'anna@shop.ru'; qty.value = '2';
  mail.setCustomValidity('Этот email уже зарегистрирован');     // своя ошибка, например ответ сервера
  assert.equal(mail.validationMessage, 'Этот email уже зарегистрирован');
  assert.equal(form.checkValidity(), false);
  mail.setCustomValidity('');
  assert.equal(form.checkValidity(), true);
  console.log('forms ok');
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
