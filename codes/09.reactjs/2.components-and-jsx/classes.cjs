// Глава 9.02 — «Классовые компоненты» и error boundary: порядок методов жизненного цикла, что ловит граница ошибок.
// run: node classes.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');

(async () => {
  const log = [];
  class Counter extends React.Component {
    state = { count: 0 };
    componentDidMount() { log.push('didMount'); }
    componentDidUpdate(prevProps, prevState) { log.push(`didUpdate ${prevState.count}→${this.state.count}`); }
    componentWillUnmount() { log.push('willUnmount'); }
    render() { log.push(`render ${this.state.count}`); return h('button', { onClick: () => this.setState({ count: this.state.count + 1 }) }, this.state.count); }
  }
  const { root, container } = await mount(h(Counter));
  await React.act(async () => container.querySelector('button').click());
  await React.act(async () => root.unmount());
  assert.deepEqual(log, ['render 0', 'didMount', 'render 1', 'didUpdate 0→1', 'willUnmount']);

  // error boundary: только класс; ловит ошибки рендера потомков, но не ошибки в обработчиках
  class Boundary extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error) { log.push(`caught ${error.message}`); }
    render() { return this.state.error ? h('p', null, 'Что-то сломалось') : this.props.children; }
  }
  function Broken() { throw new Error('render failed'); }
  errors.length = 0;
  const b = await mount(h(Boundary, null, h(Broken)));
  assert.equal(b.container.innerHTML, '<p>Что-то сломалось</p>');
  assert.ok(log.includes('caught render failed'));

  let handlerError;
  function Clicky() { return h('button', { onClick: () => { throw new Error('click failed'); } }, 'x'); }
  const c = await mount(h(Boundary, null, h(Clicky)));
  window.addEventListener('error', (e) => { handlerError = e.error?.message; e.preventDefault(); });
  await React.act(async () => c.container.querySelector('button').click());
  assert.equal(handlerError, 'click failed');
  assert.equal(c.container.innerHTML, '<button>x</button>'); // граница не сработала
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
