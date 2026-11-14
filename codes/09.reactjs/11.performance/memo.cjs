// Глава 9.11 — «memo: пропустить рендер ребёнка» и «useMemo и useCallback»: Object.is по каждому prop,
// новые ссылки ломают memo, стабильные ссылки чинят; useMemo пересчитывает только при смене deps и помнит одно значение.
// run: node memo.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo, useMemo, useCallback } = React;

(async () => {
  // 1. memo сравнивает каждый prop через Object.is
  {
    let set, rows = 0;
    const Row = memo(function Row() { rows++; return null; });
    const item = { id: 1, name: 'Ann' };
    function App() {
      const [n, setN] = useState(0);
      set = setN;
      return h(Row, { item, count: n < 2 ? 0 : n });
    }
    await mount(h(App));
    await React.act(async () => set(1)); // item та же ссылка, count 0 → 0
    assert.equal(rows, 1);
    await React.act(async () => set(2)); // count 0 → 2
    assert.equal(rows, 2);
  }

  // 2. «memo не работает»: объект, функция и JSX-children создаются заново на каждый рендер
  {
    const counts = { style: 0, onSelect: 0, children: 0, fixed: 0 };
    const make = (k) => memo(function R() { counts[k]++; return null; });
    const A = make('style'), B = make('onSelect'), C = make('children'), D = make('fixed');
    let set;
    const item = { id: 1 };
    function App() {
      const [n, setN] = useState(0);
      set = setN;
      const style = useMemo(() => ({ color: 'red' }), []);
      const onSelect = useCallback(() => console.log(item.id), []);
      return h('div', null,
        h(A, { item, style: { color: 'red' } }),
        h(B, { item, onSelect: () => console.log(item.id) }),
        h(C, { item }, h('b', null, 'Ann')),
        h(D, { item, style, onSelect }),
      );
    }
    await mount(h(App));
    for (let i = 1; i <= 3; i++) await React.act(async () => set(i));
    assert.deepEqual(counts, { style: 4, onSelect: 4, children: 4, fixed: 1 });
  }

  // 3. memo не защищает от собственного state
  {
    let setOwn, renders = 0;
    const Box = memo(function Box() { const [, s] = useState(0); setOwn = s; renders++; return null; });
    await mount(h(Box));
    await React.act(async () => setOwn(1));
    assert.equal(renders, 2);
  }

  // 4. useMemo: пересчёт только при смене deps; хранится одно последнее значение, A → B → A считает заново
  {
    let set, calls = 0;
    function List({ tab }) {
      useMemo(() => { calls++; return tab; }, [tab]);
      return null;
    }
    function App() { const [s, setS] = useState({ tab: 'all', n: 0 }); set = setS; return h(List, { tab: s.tab }); }
    await mount(h(App));
    await React.act(async () => set({ tab: 'all', n: 1 })); // рендер, deps те же
    assert.equal(calls, 1);
    await React.act(async () => set({ tab: 'done', n: 2 }));
    await React.act(async () => set({ tab: 'all', n: 3 })); // 'all' уже считали, но кеш хранит только последнее
    assert.equal(calls, 3);
  }

  // 5. useCallback возвращает ту же функцию, пока deps те же; при смене deps — новую
  {
    let set; const seen = [];
    function C({ id }) { seen.push(useCallback(() => id, [id])); return null; }
    function App() { const [s, setS] = useState({ id: 1, n: 0 }); set = setS; return h(C, { id: s.id }); }
    await mount(h(App));
    await React.act(async () => set({ id: 1, n: 1 }));
    await React.act(async () => set({ id: 2, n: 2 }));
    assert.equal(seen[0], seen[1]);
    assert.notEqual(seen[1], seen[2]);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
