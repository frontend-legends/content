// Глава 9.04 — «Что делает setState»: батчинг, eager bailout, лишний вызов без детей, апдейтеры, мутация, ленивый инициализатор.
// run: node setstate.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('./_env.cjs');
const { useState } = React;

(async () => {
  // батчинг и снимок: два setN(n + 1) и апдейтер → 2, в обработчике n === 0, рендер один
  {
    let click, renders = 0, logged;
    function Counter() {
      const [n, setN] = useState(0);
      renders++;
      click = () => { setN(n + 1); setN(n + 1); setN((x) => x + 1); logged = n; };
      return h('b', null, n);
    }
    const { container } = await mount(h(Counter));
    await React.act(async () => click());
    assert.equal(container.textContent, '2');
    assert.equal(logged, 0);
    assert.equal(renders, 2);
  }

  // eager bailout: то же значение — компонент не вызывается; «лишний» вызов после недавнего апдейта — без детей
  {
    let set, parent = 0, child = 0;
    function Child() { child++; return null; }
    function P() { const [s, setS] = useState(1); set = setS; parent++; return h(Child); }
    await mount(h(P));
    const steps = [];
    for (const v of [1, 2, 2, 2]) { await React.act(async () => set(v)); steps.push(`${parent}/${child}`); }
    console.log('set(1) set(2) set(2) set(2) → вызовов родитель/ребёнок:', steps.join(' '));
    assert.deepEqual(steps, ['1/1', '2/2', '3/2', '3/2']);
  }

  // функция в setState — всегда апдейтер; сохранить функцию — обернуть
  {
    let set, cur;
    function C() { const [f, setF] = useState(() => () => 'initial'); set = setF; cur = f; return null; }
    await mount(h(C));
    await React.act(async () => set(() => 'mine'));
    assert.equal(cur, 'mine'); // вызвана как апдейтер, в state — строка
    const keep = () => 'kept';
    await React.act(async () => set(() => keep));
    assert.equal(cur, keep);
  }

  // мутация: та же ссылка → Object.is → рендера нет
  {
    let mutate, replace, renders = 0;
    function N() {
      const [user, setUser] = useState({ name: 'Ann' });
      renders++;
      mutate = () => { user.name = 'Bob'; setUser(user); };
      replace = () => setUser({ ...user, name: 'Bob' });
      return h('i', null, user.name);
    }
    const { container } = await mount(h(N));
    await React.act(async () => mutate());
    assert.equal(renders, 1);
    assert.equal(container.textContent, 'Ann');
    await React.act(async () => replace());
    assert.equal(container.textContent, 'Bob');
  }

  // начальное значение: useState(expensive()) вызывает expensive на каждом рендере, useState(() => …) — один раз
  {
    let eager = 0, lazy = 0, set;
    const expensive = (k) => () => { k === 'e' ? eager++ : lazy++; return 0; };
    function L() {
      const [a, setA] = useState(expensive('e')());
      useState(() => expensive('l')());
      set = setA;
      return null;
    }
    await mount(h(L));
    await React.act(async () => set(1));
    await React.act(async () => set(2));
    assert.deepEqual([eager, lazy], [3, 1]);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
