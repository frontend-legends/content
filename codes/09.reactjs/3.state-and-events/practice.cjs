// Глава 9.03 — код из решений «Практики»: актуальное значение через ref, поле с ?? ''.
// run: node practice.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useState, useRef, useEffect } = React;

(async () => {
  // P1: замыкание видит снимок, ref — актуальное значение
  {
    const alerts = [];
    function Counter({ useLatest }) {
      const [count, setCount] = useState(0);
      const latest = useRef(count);
      useEffect(() => { latest.current = count; });
      return h('button', {
        onClick: () => {
          setCount(count + 1);
          setTimeout(() => alerts.push(useLatest ? latest.current : count), 10);
        },
      }, count);
    }
    for (const useLatest of [false, true]) {
      alerts.length = 0;
      const { container } = await mount(h(Counter, { useLatest }));
      const b = container.querySelector('button');
      await React.act(async () => b.click());
      await React.act(async () => b.click());
      await React.act(async () => new Promise((r) => setTimeout(r, 30)));
      assert.equal(container.textContent, '2');
      assert.deepEqual(alerts, useLatest ? [2, 2] : [0, 1]);
    }
  }

  // P3: value всегда строка — нет предупреждения о смене режима
  {
    errors.length = 0;
    function Name({ user }) {
      const [name, setName] = useState(user?.name ?? '');
      return h('input', { value: name, onChange: (e) => setName(e.target.value) });
    }
    const { container } = await mount(h(Name, { user: null }));
    const input = container.querySelector('input');
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, 'A');
    await React.act(async () => input.dispatchEvent(new window.Event('input', { bubbles: true })));
    assert.equal(input.value, 'A');
    assert.equal(errors.length, 0);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
