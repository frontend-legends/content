// Глава 9.01 — «Что возвращает компонент»: JSX компилируется в вызовы jsx(), результат — обычный неизменяемый объект.
// run: node elements.cjs
const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { jsx } = require('react/jsx-runtime');

// JSX → jsx()/jsxs() из react/jsx-runtime (автоматический runtime)
const out = esbuild.transformSync('<LikeButton liked={true} key="a">Like</LikeButton>', { loader: 'jsx', jsx: 'automatic' }).code;
assert.match(out, /import \{ jsx \} from "react\/jsx-runtime"/);
assert.match(out, /jsx\(LikeButton, \{ liked: true, children: "Like" \}, "a"\)/);
// старый runtime — React.createElement, поэтому раньше в каждом файле был import React
const classic = esbuild.transformSync('<div className="x" />', { loader: 'jsx', jsx: 'transform' }).code;
assert.match(classic, /React\.createElement\("div", \{ className: "x" \}\)/);

// элемент — описание, а не экземпляр: type, props, key и метка $$typeof
function LikeButton() { return null; }
const el = jsx(LikeButton, { liked: true, children: 'Like' }, 'a');
assert.equal(el.type, LikeButton);
assert.deepEqual(el.props, { liked: true, children: 'Like' });
assert.equal(el.key, 'a');
assert.equal(String(el.$$typeof), 'Symbol(react.transitional.element)');
assert.ok(Object.isFrozen(el) && Object.isFrozen(el.props)); // в dev элементы заморожены
// создание элемента не вызывает компонент
let called = 0;
function Spy() { called++; return null; }
h(Spy);
assert.equal(called, 0);

(async () => {
  // объект, похожий на элемент, но без Symbol $$typeof (например, пришёл из JSON) React не отрисует
  const fromJson = JSON.parse('{"type":"img","props":{"src":"x","onError":"alert(1)"},"key":null}');
  let thrown;
  try { await mount(h('div', null, fromJson)); } catch (e) { thrown = e.message; }
  assert.match(thrown, /^Objects are not valid as a React child/);
  // и Symbol в JSON не передать: JSON.stringify его выбрасывает
  assert.equal(JSON.stringify({ $$typeof: Symbol.for('react.transitional.element') }), '{}');
  console.log('JSX → jsx(), элемент — замороженный объект, объект из JSON не элемент:', thrown.split('.')[0]);
})().catch((e) => { console.log(e); process.exit(1); });
