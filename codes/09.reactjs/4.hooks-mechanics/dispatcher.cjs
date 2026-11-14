// Глава 9.04 — «Кто отвечает на вызов: диспетчер»: mount/update-диспетчеры, заглушка вне рендера, две копии React.
// run: node dispatcher.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('./_env.cjs');

const internals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

(async () => {
  // до первого рендера диспетчера нет вовсе
  assert.equal(internals.H, null);

  const seen = [];
  let inEffect, set;
  function C() {
    const [s, setS] = React.useState(0);
    set = setS;
    seen.push(internals.H);
    React.useEffect(() => { inEffect = internals.H; });
    return h('i', null, s);
  }
  await mount(h(C));
  await React.act(async () => set(1));

  // mount и update — разные объекты-диспетчеры
  assert.notEqual(seen[0], seen[1]);
  assert.equal(typeof seen[0].useState, 'function');

  // в эффекте стоит заглушка: любой хук бросает Invalid hook call
  assert.throws(() => inEffect.useState(0), /^Error: Invalid hook call/);

  // две копии React: react-dom выставляет диспетчер в своей копии, компонент читает из другой — там null
  for (const k of Object.keys(require.cache)) if (/node_modules\/react\//.test(k)) delete require.cache[k];
  const OtherReact = require('react');
  assert.notEqual(OtherReact, React);
  errors.length = 0;
  function FromOtherCopy() { OtherReact.useState(0); return null; }
  let thrown;
  try { await mount(h(FromOtherCopy)); } catch (e) { thrown = e; }
  assert.ok(errors.some((e) => e.startsWith('Invalid hook call')), 'dev: console.error с текстом ошибки');
  assert.ok(thrown instanceof TypeError);
  assert.equal(thrown.message, "Cannot read properties of null (reading 'useState')");
  console.log('mount ≠ update, заглушка бросает Invalid hook call, две копии →', `${thrown.name}: ${thrown.message}`);
})().catch((e) => { console.log(e); process.exit(1); });
