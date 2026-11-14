// Глава 9.11 — «Transitions и Suspense», «Async-функция в startTransition», ловушка useDeferredValue с объектом.
// 1) обычный апдейт, который приостановил уже показанный контент, показывает fallback; тот же апдейт в transition —
//    нет: на экране старый контент, isPending=true; 2) useDeferredValue + Suspense: поле новое, результаты старые,
//    fallback не появляется; 3) вложенный Suspense, показанный впервые, transition не ждёт — у него свой fallback;
// 4) async-функция в startTransition: isPending=true до конца await; 5) объект, созданный в рендере,
//    в useDeferredValue — лишний фоновый рендер на каждый рендер родителя; примитив — нет;
// 6) initialValue у useDeferredValue откладывает и первый рендер.
// run: node suspense.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, useTransition, useDeferredValue, Suspense, use, startTransition } = React;
const { act } = React;

// «запрос» с ручным resolve: кеш по ключу, как требует use()
function resource() {
  const cache = new Map();
  const pending = new Map();
  return {
    read(q) {
      if (!cache.has(q)) {
        let resolve;
        const p = new Promise((r) => { resolve = r; });
        cache.set(q, p);
        pending.set(q, () => resolve(`results:${q}`));
      }
      return use(cache.get(q));
    },
    async resolve(q) { await act(async () => { pending.get(q)(); }); },
  };
}

(async () => {
  // 1. обычный апдейт против transition, когда уже показанный контент приостанавливается
  for (const inTransition of [false, true]) {
    const r = resource();
    let go;
    const pendingFlag = () => container.firstChild.dataset.pending;
    function Results({ q }) { return h('p', null, r.read(q)); }
    function App() {
      const [isPending, startT] = useTransition();
      const [q, setQ] = useState('a');
      go = (next) => (inTransition ? startT(() => setQ(next)) : setQ(next));
      // isPending пишем в DOM: так видно закоммиченное значение, а не значение брошенной попытки рендера
      return h('div', { 'data-pending': String(isPending) }, h(Suspense, { fallback: h('i', null, 'loading') }, h(Results, { q })));
    }
    const { container } = await mount(h(App));
    await r.resolve('a');
    assert.equal(container.textContent, 'results:a');
    await act(async () => go('b'));
    if (inTransition) {
      assert.equal(container.textContent, 'results:a'); // старый контент остаётся на экране
      assert.equal(pendingFlag(), 'true');
    } else {
      // контент спрятан за fallback: React оставляет узел в DOM, но скрывает его display: none
      assert.equal(container.querySelector('p').style.display, 'none');
      assert.equal(container.querySelector('i').textContent, 'loading');
    }
    await r.resolve('b');
    assert.equal(container.textContent, 'results:b');
    assert.equal(container.querySelector('p').style.display, '');
    assert.equal(pendingFlag(), 'false');
  }

  // 2. useDeferredValue + Suspense: поле уже 'b', результаты старые, fallback не показан
  {
    const r = resource();
    let set;
    function Results({ q }) { return h('p', null, r.read(q)); }
    function App() {
      const [q, setQ] = useState('a');
      set = setQ;
      const dq = useDeferredValue(q);
      return h('div', null, h('b', null, q), h(Suspense, { fallback: h('i', null, 'loading') }, h(Results, { q: dq })));
    }
    const { container } = await mount(h(App));
    await r.resolve('a');
    await act(async () => set('b'));
    assert.equal(container.textContent, 'b' + 'results:a');
    assert.equal(container.querySelector('i'), null);       // fallback не показан
    await r.resolve('b');
    assert.equal(container.textContent, 'b' + 'results:b');
  }

  // 3. вложенный Suspense, который появляется впервые: transition его не ждёт, показывает его fallback
  {
    const r = resource();
    let go;
    function Details() { return h('p', null, r.read('details')); }
    function App() {
      const [tab, setTab] = useState('home');
      go = () => startTransition(() => setTab('details'));
      return h(Suspense, { fallback: h('i', null, 'page-loading') },
        h('h1', null, tab),
        tab === 'details' ? h(Suspense, { fallback: h('i', null, 'details-loading') }, h(Details)) : null);
    }
    const { container } = await mount(h(App));
    assert.equal(container.textContent, 'home');
    await act(async () => go());
    assert.equal(container.textContent, 'details' + 'details-loading'); // коммит не ждёт вложенный Suspense
    await r.resolve('details');
    assert.equal(container.textContent, 'details' + 'results:details');
  }

  // 4. async-функция в startTransition: isPending=true, пока идёт await; апдейт после await снова обёрнут
  {
    const seen = [];
    let resolve; let click;
    function Save() {
      const [isPending, startT] = useTransition();
      const [status, setStatus] = useState('idle');
      seen.push(`${isPending}/${status}`);
      click = () => startT(async () => {
        await new Promise((r) => { resolve = r; });
        startT(() => setStatus('saved'));
      });
      return null;
    }
    await mount(h(Save));
    await act(async () => click());
    assert.deepEqual(seen, ['false/idle', 'true/idle']);   // ждём await — isPending всё ещё true
    await act(async () => resolve());
    assert.equal(seen.at(-1), 'false/saved');                // isPending сброшен вместе с результатом
    assert.ok(!seen.includes('false/idle', 1));              // между ними не было рендера с false и старым state
  }

  // 5. useDeferredValue({ q }) — объект из рендера: рендер родителя без смены q даёт ещё и фоновый рендер
  for (const asObject of [false, true]) {
    let renders = 0; let bump;
    function App() {
      const [, setN] = useState(0);
      bump = () => setN((n) => n + 1);
      const d = useDeferredValue(asObject ? { q: 'a' } : 'a');
      renders++;
      return h('p', null, typeof d === 'string' ? d : d.q);
    }
    await mount(h(App));
    renders = 0;
    await act(async () => bump());
    assert.equal(renders, asObject ? 2 : 1);
  }
  // 6. initialValue: без него первый рендер не откладывается; с ним — сначала initialValue, потом фоновый рендер
  for (const withInitial of [false, true]) {
    const seen = [];
    function App() {
      const d = withInitial ? useDeferredValue('full', 'skeleton') : useDeferredValue('full');
      seen.push(d);
      return null;
    }
    await mount(h(App));
    assert.deepEqual(seen, withInitial ? ['skeleton', 'full'] : ['full']);
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
