// Глава 9.15 — compound components: вариант на cloneElement ломается, если обернуть Trigger; вариант на контексте — нет.
// Children.count видит фрагмент как одного ребёнка. Использование вне Tabs даёт понятную ошибку.
// run: node compound.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, createContext, useContext, Children, cloneElement, Fragment } = React;

(async () => {
  // Children видит фрагмент одним ребёнком
  assert.equal(Children.count([h(Fragment, null, h('a'), h('b'))]), 1);
  assert.equal(Children.count([h('a'), h('b')]), 2);

  // 1. cloneElement: TabsOld добавляет props прямым детям
  function TabsOld({ children }) {
    const [active, setActive] = useState('a');
    return h('div', null, Children.map(children, (child) => cloneElement(child, { active, onSelect: setActive })));
  }
  function TriggerOld({ value, active, onSelect, children }) {
    return h('button', { 'aria-selected': String(active === value), onClick: () => onSelect(value) }, children);
  }
  function Tooltip({ children }) { return h('span', { title: 'hint' }, children); }
  {
    const { container } = await mount(h(TabsOld, null, h(TriggerOld, { value: 'a' }, 'A'), h(Tooltip, null, h(TriggerOld, { value: 'b' }, 'B'))));
    let thrown;
    try { await React.act(async () => container.querySelectorAll('button')[1].click()); } catch (e) { thrown = e.constructor.name; }
    // props достались Tooltip, а не TriggerOld: onSelect у кнопки B не определён
    assert.equal(container.querySelectorAll('button')[1].getAttribute('aria-selected'), 'false');
    assert.equal(container.querySelectorAll('button')[0].getAttribute('aria-selected'), 'true'); // переключения не было
    console.log('cloneElement + обёртка: клик по B —', thrown ?? 'ошибки нет, но вкладка не переключилась');
  }

  // 2. контекст: обёртки не мешают
  const TabsContext = createContext(null);
  function Tabs({ defaultValue, children }) {
    const [active, setActive] = useState(defaultValue);
    return h(TabsContext, { value: { active, setActive } }, h('div', null, children));
  }
  function useTabs() {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('Tabs.Trigger нужно использовать внутри <Tabs>');
    return ctx;
  }
  function Trigger({ value, children }) {
    const { active, setActive } = useTabs();
    return h('button', { role: 'tab', 'aria-selected': String(active === value), onClick: () => setActive(value) }, children);
  }
  function Panel({ value, children }) { const { active } = useTabs(); return active === value ? h('section', null, children) : null; }
  {
    const { container } = await mount(h(Tabs, { defaultValue: 'a' },
      h(Trigger, { value: 'a' }, 'A'), h(Tooltip, null, h(Trigger, { value: 'b' }, 'B')),
      h(Panel, { value: 'a' }, 'панель A'), h(Panel, { value: 'b' }, 'панель B')));
    await React.act(async () => container.querySelectorAll('button')[1].click());
    assert.equal(container.querySelectorAll('button')[1].getAttribute('aria-selected'), 'true');
    assert.equal(container.querySelector('section').textContent, 'панель B');
  }
  {
    let thrown;
    const orig = console.error; console.error = () => {};
    try { await mount(h(Trigger, { value: 'a' }, 'A')); } catch (e) { thrown = e.message; }
    console.error = orig;
    assert.equal(thrown, 'Tabs.Trigger нужно использовать внутри <Tabs>');
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
