// Глава 9.08 — refs: когда ref.current заполнен, callback ref и cleanup (React 19), ref как prop,
// useImperativeHandle, фокус сразу после setState.
// run: node refs.cjs
const assert = require('node:assert/strict');
const { React, h, mount, errors } = require('../../_lib/react.cjs');
const { useRef, useState, useEffect, useLayoutEffect, useImperativeHandle, useCallback, forwardRef } = React;
const { flushSync } = require('react-dom');

(async () => {
  // ref.current: null во время первого рендера, узел — уже в useLayoutEffect, null после размонтирования
  {
    const seen = [];
    let refOut;
    function Input() {
      const ref = useRef(null);
      refOut = ref;
      seen.push(`render ${ref.current}`);
      useLayoutEffect(() => { seen.push(`layout ${ref.current.tagName}`); });
      useEffect(() => { seen.push(`effect ${ref.current.tagName}`); });
      return h('input', { ref });
    }
    const { root } = await mount(h(Input));
    assert.deepEqual(seen, ['render null', 'layout INPUT', 'effect INPUT']);
    await React.act(async () => root.unmount());
    assert.equal(refOut.current, null);
  }

  // inline callback ref без cleanup: null + узел на каждом рендере; со стабильным колбэком — один раз
  for (const mode of ['inline', 'stable', 'cleanup']) {
    const calls = [];
    let bump;
    function Box() {
      const [n, setN] = useState(0);
      bump = () => setN((x) => x + 1);
      const stable = useCallback((node) => calls.push(node ? 'node' : 'null'), []);
      const ref = mode === 'stable' ? stable
        : mode === 'inline' ? (node) => { calls.push(node ? 'node' : 'null'); }
        : (node) => { calls.push('node'); return () => calls.push('cleanup'); };
      return h('div', { ref }, n);
    }
    const { root } = await mount(h(Box));
    await React.act(async () => bump());
    await React.act(async () => root.unmount());
    const expected = {
      inline: ['node', 'null', 'node', 'null'],
      stable: ['node', 'null'],
      cleanup: ['node', 'cleanup', 'node', 'cleanup'], // React 19: вместо null вызывается cleanup
    }[mode];
    assert.deepEqual(calls, expected, mode);
  }

  // React 19: ref — обычный prop функционального компонента; без передачи дальше ref пустой
  {
    function TextField({ label, ref }) { return h('label', null, label, h('input', { ref })); }
    function Ignores() { return h('input'); }
    const a = { current: null };
    const b = { current: null };
    await mount(h('div', null, h(TextField, { label: 'Email', ref: a }), h(Ignores, { ref: b })));
    assert.equal(a.current.tagName, 'INPUT');
    assert.equal(b.current, null);
    // forwardRef по-прежнему работает
    const Old = forwardRef(function Old(props, ref) { return h('input', { ref }); });
    const c = { current: null };
    await mount(h(Old, { ref: c }));
    assert.equal(c.current.tagName, 'INPUT');
  }

  // useImperativeHandle: наружу — свой API, а не DOM-узел; готов в эффекте родителя
  {
    const log = [];
    function VideoPlayer({ ref }) {
      const video = useRef(null);
      useImperativeHandle(ref, () => ({ play: () => log.push(`play ${video.current.tagName}`) }), []);
      return h('video', { ref: video });
    }
    function Page() {
      const player = useRef(null);
      useEffect(() => { player.current.play(); assert.equal(player.current.tagName, undefined); }, []);
      return h(VideoPlayer, { ref: player });
    }
    await mount(h(Page));
    assert.deepEqual(log, ['play VIDEO']);
  }

  // фокус сразу после setState: узла ещё нет; flushSync или эффект решают
  for (const mode of ['naive', 'flushSync']) {
    let start, err = null;
    function Title() {
      const [editing, setEditing] = useState(false);
      const input = useRef(null);
      start = () => {
        try {
          if (mode === 'naive') { setEditing(true); input.current.focus(); }
          else { flushSync(() => setEditing(true)); input.current.focus(); }
        } catch (e) { err = e.constructor.name; }
      };
      return editing ? h('input', { ref: input }) : h('span', null, 'Заголовок');
    }
    const { container } = await mount(h(Title));
    await React.act(async () => start());
    if (mode === 'naive') assert.equal(err, 'TypeError');
    else assert.equal(document.activeElement, container.querySelector('input'));
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
