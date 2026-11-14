// Глава 9.11 — «Откуда рендеры» и «Рендер — не обновление DOM»: рендер родителя рендерит детей без props,
// рендер с тем же результатом не трогает DOM, тот же объект элемента React пропускает, контекст пробивает memo.
// run: node renders.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo, createContext, useContext } = React;

(async () => {
  // 1. рендер родителя → рендер ребёнка, хотя props у ребёнка нет вообще
  {
    let type, chart = 0;
    function Chart() { chart++; return h('svg'); }
    function App() {
      const [query, setQuery] = useState('');
      type = setQuery;
      return h('div', null, h('input', { value: query, onChange: () => {} }), h(Chart));
    }
    const { container } = await mount(h(App));
    // рендер ≠ DOM: Chart отрендерился снова, но его DOM-узел не тронут
    const svg = container.querySelector('svg');
    const records = [];
    const mo = new window.MutationObserver((r) => records.push(...r));
    mo.observe(svg, { attributes: true, childList: true, subtree: true });
    for (const q of ['a', 'ab', 'abc']) await React.act(async () => type(q));
    assert.equal(chart, 4); // 1 mount + 3 буквы
    assert.equal(container.querySelector('svg'), svg); // тот же узел
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(records.length, 0); // ни одной мутации DOM внутри Chart
    mo.disconnect();
    // а value у input — единственное, что поменялось
    assert.equal(container.querySelector('input').value, 'abc');
  }

  // 2. тот же объект элемента: React пропускает ребёнка без memo
  {
    let set, chart = 0;
    function Chart() { chart++; return null; }
    const chartEl = h(Chart); // создан один раз, вне рендера
    function App() { const [n, setN] = useState(0); set = setN; return h('div', null, n, chartEl); }
    await mount(h(App));
    await React.act(async () => set(1));
    await React.act(async () => set(2));
    assert.equal(chart, 1);
  }

  // 3. контекст пробивает memo: потребитель рендерится, хотя props не менялись
  {
    const Theme = createContext('light');
    let set, consumer = 0, plain = 0;
    const Consumer = memo(function Consumer() { useContext(Theme); consumer++; return null; });
    const Plain = memo(function Plain() { plain++; return null; });
    function App() {
      const [theme, setTheme] = useState('light');
      set = setTheme;
      return h(Theme.Provider, { value: theme }, h(Consumer), h(Plain));
    }
    await mount(h(App));
    await React.act(async () => set('dark'));
    assert.deepEqual([consumer, plain], [2, 1]);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
