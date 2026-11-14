// Глава 9.19 — React Testing Library: запросы по ролям, get/query/find, userEvent против fireEvent,
// предупреждение act, renderHook, async-компонент на клиенте.
// run: node rtl.cjs
const assert = require('node:assert/strict');
const { React, h, errors } = require('../../_lib/react.cjs');
const { render, screen, fireEvent, renderHook, act, cleanup, waitFor } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;
const { useState, useEffect } = React;

(async () => {
  // getByRole находит кнопку по доступному имени; div с onClick — нет
  {
    render(h('div', null, h('button', null, 'Добавить в корзину'), h('div', { onClick() {} }, 'Купить')));
    assert.equal(screen.getByRole('button', { name: /в корзину/i }).tagName, 'BUTTON');
    assert.equal(screen.queryByRole('button', { name: 'Купить' }), null); // недоступно — и для теста, и для скринридера
    cleanup();
  }

  // get бросает с понятным сообщением, query возвращает null, find ждёт
  {
    function Delayed() { const [shown, setShown] = useState(false); useEffect(() => { const t = setTimeout(() => setShown(true), 50); return () => clearTimeout(t); }, []); return shown ? h('p', null, 'Загружено') : h('p', null, 'Загрузка'); }
    render(h(Delayed));
    assert.throws(() => screen.getByText('Загружено'), /Unable to find an element with the text: Загружено/);
    assert.equal(screen.queryByText('Загружено'), null);
    assert.equal((await screen.findByText('Загружено')).tagName, 'P');
    cleanup();
  }

  // userEvent.type проходит весь путь клавиатуры, fireEvent.change только меняет value
  {
    const keys = [];
    function Search() { const [q, setQ] = useState(''); return h('input', { 'aria-label': 'Поиск', value: q, onChange: (e) => setQ(e.target.value), onKeyDown: (e) => keys.push(e.key) }); }
    render(h(Search));
    const input = screen.getByRole('textbox', { name: 'Поиск' });
    fireEvent.change(input, { target: { value: 'чай' } });
    assert.equal(input.value, 'чай');
    assert.deepEqual(keys, []);
    await userEvent.clear(input);
    await userEvent.type(input, 'кофе');
    assert.equal(input.value, 'кофе');
    assert.deepEqual(keys, ['к', 'о', 'ф', 'е']);
    cleanup();
  }

  // userEvent не кликает туда, куда не попадёт и пользователь
  {
    render(h('button', { style: { pointerEvents: 'none' } }, 'x'));
    await assert.rejects(userEvent.click(screen.getByRole('button')), /pointer-events: none/);
    cleanup();
  }

  // обновление после теста, которое никто не дождался, — предупреждение act
  {
    errors.length = 0;
    function Late() { const [v, setV] = useState('…'); useEffect(() => { setTimeout(() => setV('готово'), 10); }, []); return h('p', null, v); }
    render(h(Late));
    await new Promise((r) => setTimeout(r, 30)); // ждём таймер вне act
    assert.ok(errors.some((e) => e.includes('inside a test was not wrapped in act(...)')));
    cleanup();
  }

  // renderHook: хук в тестовом компоненте
  {
    function useCounter() { const [count, setCount] = useState(0); return { count, increment: () => setCount((c) => c + 1) }; }
    const { result } = renderHook(() => useCounter());
    act(() => result.current.increment());
    assert.equal(result.current.count, 1);
  }

  // async-компонент нельзя отрендерить на клиенте
  {
    errors.length = 0;
    async function ServerOnly() { return h('p', null, 'x'); }
    let thrown;
    try { render(h(ServerOnly)); await waitFor(() => {}); } catch (e) { thrown = e.message; }
    const all = [thrown, ...errors].join(' | ');
    assert.match(all, /async Client Component|async\/await is not yet supported in Client Components/);
    cleanup();
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
