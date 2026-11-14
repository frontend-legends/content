// Глава 9.03 — «Переменная против состояния», «Снимок», «Иммутабельность», батчинг в таймере.
// run: node state.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, memo } = React;
const click = (el) => React.act(async () => el.click());

(async () => {
  // обычная переменная: меняется, но экран не обновляется и значение не переживает рендер
  {
    function Counter() {
      let count = 0;
      return h('button', { onClick: () => { count++; } }, count);
    }
    const { container } = await mount(h(Counter));
    await click(container.querySelector('button'));
    assert.equal(container.textContent, '0');
  }

  // снимок: асинхронный колбэк видит значение своего рендера
  {
    let seen;
    function Counter() {
      const [count, setCount] = useState(0);
      return h('button', {
        onClick: () => {
          setCount(count + 1);
          setTimeout(() => { seen = count; }, 0);
        },
      }, count);
    }
    const { container } = await mount(h(Counter));
    await click(container.querySelector('button'));
    await click(container.querySelector('button'));
    await React.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.equal(container.textContent, '2');
    assert.equal(seen, 1); // второй клик был в рендере, где count === 1
  }

  // батчинг в таймере: два апдейта — один рендер
  {
    let renders = 0;
    function Pair() {
      const [a, setA] = useState(0);
      const [b, setB] = useState(0);
      renders++;
      return h('button', { onClick: () => setTimeout(() => { setA(1); setB(1); }, 0) }, `${a}${b}`);
    }
    const { container } = await mount(h(Pair));
    await click(container.querySelector('button'));
    await React.act(async () => new Promise((r) => setTimeout(r, 5)));
    assert.equal(container.textContent, '11');
    assert.equal(renders, 2);
  }

  // мутация массива: та же ссылка — рендера нет
  {
    let add, renders = 0;
    function List() {
      const [items, setItems] = useState(['a']);
      renders++;
      add = (mutate) => mutate ? (items.push('b'), setItems(items)) : setItems([...items, 'b']);
      return h('i', null, items.join(','));
    }
    const { container } = await mount(h(List));
    await React.act(async () => add(true));
    assert.equal(renders, 1);
    assert.equal(container.textContent, 'a');
    await React.act(async () => add(false));
    assert.equal(container.textContent, 'a,b,b'); // мутированный массив тоже здесь: 'b' добавлен дважды
  }

  // поверхностная копия делит вложенный объект: «старый» снимок тоже меняется
  {
    const history = [];
    let move;
    function Profile() {
      const [user, setUser] = useState({ name: 'Ann', address: { city: 'Riga' } });
      history.push(user);
      move = (deep) => {
        if (deep) setUser({ ...user, address: { ...user.address, city: 'Oslo' } });
        else { const next = { ...user }; next.address.city = 'Oslo'; setUser(next); }
      };
      return h('i', null, user.address.city);
    }
    const { container } = await mount(h(Profile));
    await React.act(async () => move(false));
    assert.equal(container.textContent, 'Oslo');
    assert.equal(history[0].address.city, 'Oslo'); // прошлое состояние испорчено
  }

  // memo-строка не видит мутированный todo
  {
    let toggle;
    const Row = memo(function Row({ todo }) { return h('li', null, `${todo.title}:${todo.done}`); });
    function Todos({ mutate }) {
      const [todos, setTodos] = useState([{ id: 1, title: 'buy', done: false }]);
      toggle = () => setTodos(mutate
        ? (todos[0].done = !todos[0].done, [...todos])
        : todos.map((t) => (t.id === 1 ? { ...t, done: !t.done } : t)));
      return h('ul', null, todos.map((t) => h(Row, { key: t.id, todo: t })));
    }
    const bad = await mount(h(Todos, { mutate: true }));
    await React.act(async () => toggle());
    assert.equal(bad.container.textContent, 'buy:false'); // не обновилось
    const good = await mount(h(Todos, { mutate: false }));
    await React.act(async () => toggle());
    assert.equal(good.container.textContent, 'buy:true');
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
