// Глава 9.02 — «JSX — это выражения»: что рендерится из значений, имена компонентов, атрибуты, props только для чтения.
// run: node jsx-rules.cjs
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { React, h, mount, errors } = require('../../_lib/react.cjs');

const html = async (el) => (await mount(el)).container.innerHTML;

(async () => {
  // что попадает на экран из значений в {}
  assert.equal(await html(h('p', null, 0)), '<p>0</p>');
  assert.equal(await html(h('p', null, NaN)), '<p>NaN</p>');
  assert.equal(await html(h('p', null, '')), '<p></p>');
  for (const v of [false, true, null, undefined]) assert.equal(await html(h('p', null, v)), '<p></p>');
  // классическая ловушка: 0 && <List/> → «0»
  const items = [];
  assert.equal(await html(h('div', null, items.length && h('ul'))), '<div>0</div>');
  assert.equal(await html(h('div', null, items.length > 0 && h('ul'))), '<div></div>');

  // имя с маленькой буквы — строка, то есть HTML-тег; с большой — ссылка на переменную
  const js = esbuild.transformSync('<><card /><Card /></>', { loader: 'jsx', jsx: 'automatic' }).code;
  assert.match(js, /jsx\("card", \{\}\)/);
  assert.match(js, /jsx\(Card, \{\}\)/);

  // атрибуты: className, style-объект с px, boolean
  assert.equal(
    await html(h('input', { className: 'f', style: { width: 10, opacity: 0.5 }, disabled: false, readOnly: true })),
    '<input class="f" style="width: 10px; opacity: 0.5;" readonly="">',
  );

  // props заморожены в dev: в strict mode (модули, классы) мутация бросает TypeError, в sloppy — молча не работает
  let thrown, after;
  function Mutates(props) { 'use strict'; try { props.title = 'x'; } catch (e) { thrown = e.constructor.name; } return null; }
  function Sloppy(props) { props.title = 'x'; after = props.title; return null; }
  await mount(h(Mutates, { title: 'a' }));
  await mount(h(Sloppy, { title: 'a' }));
  assert.equal(thrown, 'TypeError');
  assert.equal(after, 'a');

  // компонент может вернуть undefined (с React 18) — пустота, без ошибки
  errors.length = 0;
  function Nothing() { return undefined; }
  assert.equal(await html(h('div', null, h(Nothing))), '<div></div>');
  assert.equal(errors.length, 0);

  // defaultProps у функциональных компонентов в React 19 убран: JSX (jsx()) его не применяет —
  // значения по умолчанию задают в деструктуризации. Старый React.createElement ещё применяет.
  const { jsx } = require('react/jsx-runtime');
  function Badge({ color = 'gray' }) { return h('span', null, color); }
  function Old(props) { return h('span', null, String(props.color)); }
  Old.defaultProps = { color: 'gray' };
  assert.equal(await html(h(Badge)), '<span>gray</span>');
  assert.equal(await html(jsx(Old, {})), '<span>undefined</span>');
  assert.equal(await html(h(Old)), '<span>gray</span>');
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
