// Глава 9.03 — «События»: делегирование на корень, onChange = input, onScroll не всплывает,
// нативный stopPropagation ниже корня глушит React-обработчики.
// run: node events.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');

(async () => {
  // обработчик висит на корневом контейнере, не на кнопке
  {
    const calls = [];
    const { container } = await mount(h('div', { onClick: () => calls.push('div') },
      h('button', { onClick: (e) => calls.push(`button ${e.type} ${e.target.tagName} ${e.currentTarget.tagName}`) }, 'x')));
    const btn = container.querySelector('button');
    await React.act(async () => btn.click());
    assert.deepEqual(calls, ['button click BUTTON BUTTON', 'div']); // всплытие по React-дереву
  }

  // capture-фаза и stopPropagation
  {
    const calls = [];
    const { container } = await mount(h('div', {
      onClickCapture: () => calls.push('div capture'),
      onClick: () => calls.push('div bubble'),
    }, h('button', { onClick: (e) => { calls.push('button'); e.stopPropagation(); } }, 'x')));
    await React.act(async () => container.querySelector('button').click());
    assert.deepEqual(calls, ['div capture', 'button']);
  }

  // нативный слушатель между кнопкой и корнем остановил всплытие — React-обработчик не вызван
  {
    let reactCalled = false;
    const { container } = await mount(h('section', null, h('div', { id: 'mid' }, h('button', { onClick: () => { reactCalled = true; } }, 'x'))));
    container.querySelector('#mid').addEventListener('click', (e) => e.stopPropagation());
    await React.act(async () => container.querySelector('button').click());
    assert.equal(reactCalled, false);
  }

  // документ-слушатель срабатывает после React; e.stopPropagation() в React останавливает и его (с React 17)
  {
    const calls = [];
    const onDoc = () => calls.push('document');
    document.addEventListener('click', onDoc);
    const { container } = await mount(h('div', null,
      h('button', { id: 'a', onClick: () => calls.push('react a') }, 'a'),
      h('button', { id: 'b', onClick: (e) => { calls.push('react b'); e.stopPropagation(); } }, 'b')));
    await React.act(async () => container.querySelector('#a').click());
    await React.act(async () => container.querySelector('#b').click());
    document.removeEventListener('click', onDoc);
    assert.deepEqual(calls, ['react a', 'document', 'react b']);
  }

  // onChange в React срабатывает на каждое изменение (событие input), а не на blur, как DOM change
  {
    const values = [];
    const { container } = await mount(h('input', { defaultValue: '', onChange: (e) => values.push(e.target.value) }));
    const input = container.querySelector('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const v of ['a', 'ab']) {
      setter.call(input, v);
      await React.act(async () => input.dispatchEvent(new window.Event('input', { bubbles: true })));
    }
    assert.deepEqual(values, ['a', 'ab']);
  }

  // onScroll не всплывает (с React 17)
  {
    const calls = [];
    const { container } = await mount(h('div', { onScroll: () => calls.push('parent') },
      h('div', { id: 'inner', onScroll: () => calls.push('inner') })));
    await React.act(async () => container.querySelector('#inner').dispatchEvent(new window.Event('scroll')));
    assert.deepEqual(calls, ['inner']);
  }
  // createRoot сразу вешает слушатели всех событий на контейнер — в обеих фазах
  {
    const { createRoot } = require('react-dom/client');
    const seen = [];
    const orig = window.EventTarget.prototype.addEventListener;
    window.EventTarget.prototype.addEventListener = function (type, fn, opts) {
      if (type === 'click') seen.push(`${this.id || this.nodeName} ${opts === true || opts?.capture ? 'capture' : 'bubble'}`);
      return orig.call(this, type, fn, opts);
    };
    const root = document.createElement('div');
    root.id = 'app';
    createRoot(root);
    window.EventTarget.prototype.addEventListener = orig;
    assert.deepEqual(seen.sort(), ['app bubble', 'app capture']);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
