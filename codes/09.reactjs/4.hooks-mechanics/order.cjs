// Глава 9.04 — «Порядок вызовов вместо имён»: таблица ошибок при нарушении правил и условный useContext.
// run: node order.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('./_env.cjs');
const { useState, useRef, useMemo, useEffect, useContext, createContext } = React;

async function rerender(Comp, a, b) {
  errors.length = 0;
  let thrown;
  try {
    const m = await mount(h(Comp, a));
    await m.render(h(Comp, b));
  } catch (e) { thrown = e.message; }
  return { thrown, warned: errors.map((e) => e.split('\n')[0]) };
}
const ORDER_WARNING = 'React has detected a change in the order of Hooks called by %s.';

(async () => {
  function D({ show }) { useState('a'); if (show) useState('b'); return null; }
  let r = await rerender(D, { show: false }, { show: true });
  assert.equal(r.thrown, 'Rendered more hooks than during the previous render.');
  assert.ok(r.warned.some((w) => w.startsWith(ORDER_WARNING)));

  r = await rerender(D, { show: true }, { show: false });
  assert.equal(r.thrown, 'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.');

  // то же количество, другой порядок типов: предупреждение, дальше — падение на чужой ячейке
  function E({ flip }) { if (flip) { useRef(1); useState(0); } else { useState(0); useRef(1); } return null; }
  r = await rerender(E, { flip: false }, { flip: true });
  assert.ok(r.warned.some((w) => w.startsWith(ORDER_WARNING)));
  assert.match(r.thrown, /^Should have a queue\. You are likely calling Hooks conditionally/);

  // хук внутри колбэка useMemo — dev-предупреждение; внутри useEffect — Invalid hook call
  errors.length = 0;
  function G() { useMemo(() => { useState(1); }, []); return null; }
  try { await mount(h(G)); } catch {}
  assert.ok(errors.some((e) => e.startsWith('Do not call Hooks inside useEffect(...), useMemo(...), or other built-in Hooks.')));
  let inEffect;
  function F() { useEffect(() => { try { useState(1); } catch (e) { inEffect = e.message; } }, []); return null; }
  await mount(h(F));
  assert.match(inEffect, /^Invalid hook call/);

  // безусловный setState в рендере
  function H() { const [n, setN] = useState(0); setN(n + 1); return null; }
  let thrown;
  try { await mount(h(H)); } catch (e) { thrown = e.message; }
  assert.equal(thrown, 'Too many re-renders. React limits the number of renders to prevent an infinite loop.');

  // useContext ячейку не занимает: условный вызов не ломает список, но dev-проверка порядка его видит
  const Ctx = createContext('a');
  function C({ on }) { useState(1); const v = on ? useContext(Ctx) : '-'; useRef(0); return h('i', null, v); }
  errors.length = 0;
  const m = await mount(h(C, { on: false }));
  await m.render(h(C, { on: true }));
  assert.equal(m.container.textContent, 'a');
  assert.ok(errors.some((e) => e.startsWith(ORDER_WARNING)));
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
