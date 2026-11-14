// Глава 9.03 — «Управляемые и неуправляемые поля»: value без onChange, смена режима, React возвращает value.
// run: node forms.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState } = React;
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
async function type(input, v) {
  setter.call(input, v);
  await React.act(async () => input.dispatchEvent(new window.Event('input', { bubbles: true })));
}

(async () => {
  // value без onChange: предупреждение и поле, которое нельзя изменить
  errors.length = 0;
  const ro = await mount(h('input', { value: 'fixed' }));
  assert.ok(errors.some((e) => e.startsWith('You provided a `value` prop to a form field without an `onChange` handler.')));
  await type(ro.container.querySelector('input'), 'fixedX');
  assert.equal(ro.container.querySelector('input').value, 'fixed'); // React вернул значение из props

  // управляемое поле: значение — из state, можно форматировать на лету
  function Upper() {
    const [v, setV] = useState('');
    return h('input', { value: v, onChange: (e) => setV(e.target.value.toUpperCase()) });
  }
  const up = await mount(h(Upper));
  await type(up.container.querySelector('input'), 'riga');
  assert.equal(up.container.querySelector('input').value, 'RIGA');

  // undefined → строка: неуправляемое стало управляемым
  errors.length = 0;
  function Name({ user }) {
    const [name, setName] = useState(user?.name);
    return h('input', { value: name, onChange: (e) => setName(e.target.value) });
  }
  const n = await mount(h(Name, { user: null }));
  await type(n.container.querySelector('input'), 'A');
  assert.ok(errors.some((e) => e.startsWith('A component is changing an uncontrolled input to be controlled.')));
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
