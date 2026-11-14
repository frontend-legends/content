// Глава 9.17 — гидратация: DOM переиспользуется, обработчики появляются только после hydrateRoot;
// расхождение текста — ошибка и клиентский перерендер; расхождение атрибутов — только предупреждение,
// в DOM остаётся серверное значение; suppressHydrationWarning; useId одинаков на сервере и клиенте; <div> в <p>.
// run: node hydration.cjs
const assert = require('node:assert/strict');
const { React, h, errors, mount } = require('../../_lib/react.cjs');
const { renderToString } = require('react-dom/server');
const { hydrateRoot } = require('react-dom/client');
const { useState, useId } = React;

function serverRender(el) {
  const container = document.createElement('div');
  container.innerHTML = renderToString(el);
  document.body.appendChild(container);
  return container;
}
async function hydrate(container, el) {
  const recoverable = [];
  await React.act(async () => { hydrateRoot(container, el, { onRecoverableError: (e) => recoverable.push(e.message) }); });
  return recoverable;
}

(async () => {
  // DOM переиспользуется; клики работают только после гидратации
  {
    function Counter() { const [n, setN] = useState(0); return h('button', { onClick: () => setN(n + 1) }, n); }
    const container = serverRender(h(Counter));
    const btn = container.querySelector('button');
    btn.click();
    assert.equal(btn.textContent, '0'); // HTML есть, обработчиков нет
    await hydrate(container, h(Counter));
    assert.equal(container.querySelector('button'), btn); // тот же узел
    await React.act(async () => btn.click());
    assert.equal(btn.textContent, '1');
  }

  // расхождение текста: ошибка и клиентский рендер, на экране — клиентское значение
  {
    const container = serverRender(h('p', null, 'server time'));
    errors.length = 0;
    const rec = await hydrate(container, h('p', null, 'client time'));
    assert.ok(rec.some((m) => m.startsWith("Hydration failed because the server rendered text didn't match the client.")));
    assert.equal(container.textContent, 'client time');
  }

  // расхождение атрибута: предупреждение, но DOM сохраняет серверное значение
  {
    const container = serverRender(h('p', { className: 'server' }, 'x'));
    errors.length = 0;
    const rec = await hydrate(container, h('p', { className: 'client' }, 'x'));
    assert.equal(rec.length, 0);
    assert.ok(errors.some((e) => e.includes("A tree hydrated but some attributes of the server rendered HTML didn't match the client properties")));
    assert.equal(container.querySelector('p').className, 'server'); // не исправлено!
  }

  // suppressHydrationWarning — для текста одного элемента, который заведомо разный
  {
    const container = serverRender(h('time', { suppressHydrationWarning: true }, '10:00'));
    errors.length = 0;
    const rec = await hydrate(container, h('time', { suppressHydrationWarning: true }, '10:01'));
    assert.equal(rec.length, 0);
    assert.equal(errors.length, 0);
    assert.equal(container.textContent, '10:00'); // текст не обновился: React просто промолчал
  }

  // useId: одинаковые id на сервере и клиенте; счётчик-самоделка расходится
  {
    let counter = 0;
    function Field({ label }) {
      const id = useId();
      return h('div', null, h('label', { htmlFor: id }, label), h('input', { id }));
    }
    function BadField({ label }) {
      const id = `f${++counter}`;
      return h('div', null, h('label', { htmlFor: id }, label), h('input', { id }));
    }
    const form = (F) => h('form', null, h(F, { label: 'Имя' }), h(F, { label: 'Email' }));
    const c1 = serverRender(form(Field));
    const serverIds = [...c1.querySelectorAll('input')].map((i) => i.id);
    errors.length = 0;
    await hydrate(c1, form(Field));
    assert.equal(errors.length, 0);
    assert.notEqual(serverIds[0], serverIds[1]);
    assert.deepEqual([...c1.querySelectorAll('input')].map((i) => i.id), serverIds);

    const c2 = serverRender(form(BadField)); // сервер: f1, f2
    errors.length = 0;
    await hydrate(c2, form(BadField));       // клиент: f3, f4
    assert.ok(errors.some((e) => e.includes("didn't match the client properties")));
    assert.equal(c2.querySelector('input').id, 'f1'); // в DOM серверный id, а label на клиенте ждёт f3
  }

  // <div> внутри <p>: браузерный парсер ломает вложенность, React предупреждает
  {
    const html = renderToString(h('p', null, h('div', null, 'блок')));
    assert.equal(html, '<p><div>блок</div></p>'); // сервер отдаёт как есть
    errors.length = 0;
    await mount(h('p', null, h('div', null, 'блок'))); // клиентский dev-рендер предупреждает
    assert.ok(errors.some((e) => e.startsWith('In HTML, %s cannot be a descendant of <%s>.')));
    const container = document.createElement('div');
    container.innerHTML = html;
    assert.equal(container.innerHTML, '<p></p><div>блок</div><p></p>'); // парсер «починил» разметку
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
