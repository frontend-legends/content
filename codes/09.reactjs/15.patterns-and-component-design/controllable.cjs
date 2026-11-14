// Глава 9.15 — компонент, который работает и управляемым, и неуправляемым; баг с копией prop в state;
// сброс границы ошибок сменой key.
// run: node controllable.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState } = React;

function useControllableState({ value, defaultValue, onChange }) {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : inner;
  const set = (next) => {
    if (!isControlled) setInner(next);
    onChange?.(next);
  };
  return [current, set];
}
function Toggle({ checked, defaultChecked = false, onChange }) {
  const [on, setOn] = useControllableState({ value: checked, defaultValue: defaultChecked, onChange });
  return h('button', { role: 'switch', 'aria-checked': String(on), onClick: () => setOn(!on) });
}
const state = (c) => c.querySelector('button').getAttribute('aria-checked');
const click = (c) => React.act(async () => c.querySelector('button').click());

(async () => {
  // неуправляемый: состояние внутри
  {
    const { container } = await mount(h(Toggle, { defaultChecked: true }));
    await click(container);
    assert.equal(state(container), 'false');
  }
  // управляемый: без обновления от родителя не меняется; с обновлением — следует за родителем
  {
    const calls = [];
    const fixed = await mount(h(Toggle, { checked: false, onChange: (v) => calls.push(v) }));
    await click(fixed.container);
    assert.equal(state(fixed.container), 'false');
    assert.deepEqual(calls, [true]);

    let outside;
    function Parent() { const [v, setV] = useState(false); outside = setV; return h(Toggle, { checked: v, onChange: setV }); }
    const p = await mount(h(Parent));
    await click(p.container);
    assert.equal(state(p.container), 'true');
    await React.act(async () => outside(false)); // родитель сбрасывает извне
    assert.equal(state(p.container), 'false');
  }
  // баг: копия prop в state не следует за родителем
  {
    function BadToggle({ checked }) { const [on, setOn] = useState(checked); return h('button', { 'aria-checked': String(on), onClick: () => setOn(!on) }); }
    let outside;
    function Parent() { const [v, setV] = useState(true); outside = setV; return h(BadToggle, { checked: v }); }
    const { container } = await mount(h(Parent));
    await React.act(async () => outside(false));
    assert.equal(state(container), 'true'); // родитель сказал false, а переключатель остался включён
  }
  // граница ошибок сбрасывается сменой key
  {
    class Boundary extends React.Component {
      state = { error: null };
      static getDerivedStateFromError(error) { return { error }; }
      render() { return this.state.error ? h('p', null, 'ошибка') : this.props.children; }
    }
    function Widget({ broken }) { if (broken) throw new Error('x'); return h('p', null, 'ok'); }
    const orig = console.error; console.error = () => {};
    const m = await mount(h(Boundary, { key: 1 }, h(Widget, { broken: true })));
    assert.equal(m.container.textContent, 'ошибка');
    await m.render(h(Boundary, { key: 1 }, h(Widget, { broken: false })));
    assert.equal(m.container.textContent, 'ошибка'); // тот же key — граница помнит ошибку
    await m.render(h(Boundary, { key: 2 }, h(Widget, { broken: false })));
    assert.equal(m.container.textContent, 'ok');
    console.error = orig;
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
