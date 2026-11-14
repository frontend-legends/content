// Глава 9.04 — код из решений раздела «Практика» (+ нюанс с key={user.id})
// run: node practice.cjs

const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><title>t</title><div id="root"></div>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { act, useState, useEffect, useLayoutEffect, StrictMode } = React;
const h = React.createElement;
const { createRoot } = require('react-dom/client');

let errors = [];
const origError = console.error;
console.error = (...a) => errors.push(a.map(String).join(' '));
const realLog = console.log;

async function mount(el) {
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c, { onUncaughtError: (e) => errors.push('UNCAUGHT: ' + e.message) });
  await act(async () => root.render(el));
  return { root, c };
}

const P2_PLAIN = ['render 1', 'layout 1', 'effect 1', 'render 2', 'layout cleanup 1', 'layout 2',
  'effect cleanup 1', 'effect 2', 'layout cleanup 2', 'effect cleanup 2'];
const P2_STRICT = ['render 1', 'render 1', 'layout 1', 'effect 1', 'layout cleanup 1', 'effect cleanup 1',
  'layout 1', 'effect 1', 'render 2', 'render 2', 'layout cleanup 1', 'layout 2', 'effect cleanup 1',
  'effect 2', 'layout cleanup 2', 'effect cleanup 2'];

(async () => {
  // ---- practice 1: fix variant
  {
    const logs = [];
    let click;
    function Counter() {
      const [n, setN] = useState(0);
      click = () => { setN((x) => x + 1); setN((x) => x + 1); setN((x) => x + 1); };
      useEffect(() => { logs.push(n); }, [n]);
      return h('button', null, n);
    }
    const { c } = await mount(h(Counter));
    await act(async () => click());
    realLog('P1 fix: screen =', c.textContent, '| effect logs =', JSON.stringify(logs));
    assert.equal(c.textContent, '3');
    assert.deepEqual(logs, [0, 3]);
  }

  // ---- practice 2: with and without StrictMode
  for (const strict of [false, true]) {
    const logs = [];
    console.log = (...a) => logs.push(a.join(' '));
    function Item({ v }) {
      console.log('render', v);
      useLayoutEffect(() => { console.log('layout', v); return () => console.log('layout cleanup', v); }, [v]);
      useEffect(() => { console.log('effect', v); return () => console.log('effect cleanup', v); }, [v]);
      return null;
    }
    const wrap = (v) => (strict ? h(StrictMode, null, h(Item, { v })) : h(Item, { v }));
    const { root } = await mount(wrap(1));
    await act(async () => root.render(wrap(2)));
    await act(async () => root.unmount());
    console.log = realLog;
    realLog(`P2 strict=${strict}:\n  ` + logs.join('\n  '));
    assert.deepEqual(logs, strict ? P2_STRICT : P2_PLAIN);
  }

  // ---- practice 3: buggy version
  {
    errors = [];
    const LoginPrompt = () => h('i', null, 'login');
    const ProfileView = ({ user, draft }) => h('b', null, user.name + ':' + draft);
    function Profile({ user }) {
      const [tab] = useState('posts');
      if (!user) return h(LoginPrompt);
      const [draft] = useState(user.bio);
      useEffect(() => { document.title = user.name; }, [user.name]);
      return h(ProfileView, { user, tab, draft });
    }
    const { root } = await mount(h(Profile, { user: { name: 'Ann', bio: 'a' } }));
    try { await act(async () => root.render(h(Profile, { user: null }))); } catch (e) { errors.push('THROWN: ' + e.message); }
    assert.ok(errors.includes('THROWN: Rendered fewer hooks than expected. This may be caused by an accidental early return statement.'));
    realLog('P3 bug logout errors:', JSON.stringify(errors.filter((e) => /hooks/i.test(e)).map((e) => e.slice(0, 120))));
    errors = [];
    const r2 = await mount(h(Profile, { user: null }));
    try { await act(async () => r2.root.render(h(Profile, { user: { name: 'Ann', bio: 'a' } }))); } catch (e) { errors.push('THROWN: ' + e.message); }
    assert.ok(errors.includes('THROWN: Rendered more hooks than during the previous render.'));
    assert.ok(errors.some((e) => e.startsWith('React has detected a change in the order of Hooks called by %s') && /%s\. [^]*\sProfile\b/.test(e))); // → «called by Profile.»
    realLog('P3 bug login errors:', JSON.stringify(errors.filter((e) => /hooks/i.test(e)).map((e) => e.slice(0, 120))));
  }

  // ---- practice 3: fixed version (+ key nuance)
  for (const useKey of [false, true]) {
    errors = [];
    const LoginPrompt = () => h('i', null, 'login');
    const ProfileView = ({ user, draft }) => h('b', null, user.name + ':' + draft);
    function AuthorizedProfile({ user, tab }) {
      const [draft] = useState(user.bio);
      useEffect(() => { document.title = user.name; }, [user.name]);
      return h(ProfileView, { user, tab, draft });
    }
    function Profile({ user }) {
      const [tab] = useState('posts');
      if (!user) return h(LoginPrompt);
      return h(AuthorizedProfile, useKey ? { key: user.id, user, tab } : { user, tab });
    }
    const ann = { id: 1, name: 'Ann', bio: 'ann bio' };
    const bob = { id: 2, name: 'Bob', bio: 'bob bio' };
    const { root, c } = await mount(h(Profile, { user: ann }));
    const seq = [c.textContent];
    await act(async () => root.render(h(Profile, { user: null })));
    seq.push(c.textContent);
    await act(async () => root.render(h(Profile, { user: ann })));
    seq.push(c.textContent);
    await act(async () => root.render(h(Profile, { user: bob })));
    seq.push(c.textContent + ' title=' + document.title);
    realLog(`P3 fixed key=${useKey}:`, seq.join(' -> '), '| errors:', errors.length);
    assert.equal(errors.length, 0);
    // без key Bob получает черновик Ann: useState читает начальное значение только при монтировании
    assert.equal(seq[3], (useKey ? 'Bob:bob bio' : 'Bob:ann bio') + ' title=Bob');
  }
  console.error = origError;
})().catch((e) => { console.error = origError; console.error(e); process.exit(1); });
