// Глава 9.09 — «useDebugValue» и утверждения об исходниках React: форматтер отложен, ячейки нет,
// useState на апдейте — это useReducer, у dispatch из useReducer нет eager bailout.
// run: node debug-value.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { React, h, mount, fiberOf } = require('../../_lib/react.cjs');

(async () => {
  // форматтер не вызывается при рендере: его вызывает только DevTools при инспекции
  let formats = 0, bump;
  function useMediaQuery(query) {
    const matches = false;
    React.useDebugValue(matches, (m) => { formats++; return `${query}: ${m ? 'да' : 'нет'}`; });
    return matches;
  }
  function TaskBoard() { const [, s] = React.useState(0); bump = s; useMediaQuery('(max-width: 600px)'); return h('i', { id: 'b' }); }
  const { container } = await mount(h(TaskBoard));
  await React.act(async () => bump(1));
  assert.equal(formats, 0);

  // ячейки нет: в списке fiber только useState
  let count = 0;
  for (let hook = fiberOf(container.querySelector('#b')).memoizedState; hook; hook = hook.next) count++;
  assert.equal(count, 1);

  // исходники react-dom (dev): реализация useDebugValue в диспетчерах только регистрирует тип хука
  const src = fs.readFileSync(require('node:path').join(require('node:path').dirname(require.resolve('react-dom/package.json')), 'cjs/react-dom-client.development.js'), 'utf8');
  const impls = [...src.matchAll(/useDebugValue: function \(\) \{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(impls.length >= 4);
  assert.ok(impls.every((body) => !/format|value/.test(body)), 'значение и форматтер не используются');

  // useState на апдейте — updateReducer(basicStateReducer)
  assert.match(src, /function basicStateReducer\(state, action\) \{\s*return "function" === typeof action \? action\(state\) : action;/);
  assert.match(src, /return updateReducer\(basicStateReducer\);/);

  // eager-расчёт есть в dispatchSetState и отсутствует в dispatchReducerAction
  const body = (name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n    function ', src.indexOf(`function ${name}(`) + 10));
  assert.ok(body('dispatchSetStateInternal').includes('eagerState = alternate(currentState, action)'));
  assert.ok(!body('dispatchReducerAction').includes('eagerState ='));

  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
