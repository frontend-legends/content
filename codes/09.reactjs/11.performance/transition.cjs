// Глава 9.11 — «Приоритеты: useTransition и useDeferredValue». Без act, с настоящим планировщиком:
// isPending и два рендера; ввод прерывает рендер transition и тот начинается заново; апдейт из setTimeout
// transition не прерывает; один долгий компонент не прерывается; второй клик по вкладке бросает первую только
// с useTransition (isPending — срочный апдейт), голый startTransition её доделывает; useDeferredValue без memo не помогает.
// run: node transition.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { createRoot } = require('react-dom/client');
const { useState, useTransition, useDeferredValue, startTransition, memo } = React;

const busy = (ms) => { const end = performance.now() + ms; while (performance.now() < end); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const compact = (log) => {
  const out = [];
  for (const l of log) { const last = out[out.length - 1]; if (last && last.l === l) last.n++; else out.push({ l, n: 1 }); }
  return out.map(({ l, n }) => (n > 1 ? `${l} x${n}` : l));
};

// поле ввода и «тяжёлый» список: 50 строк по 2 мс
function setup({ memoList = true, deferred = false } = {}) {
  const log = [];
  function Item({ q }) { log.push(`item:${q}`); busy(2); return h('li', null, q); }
  const ListImpl = ({ q }) => h('ul', null, Array.from({ length: 50 }, (_, i) => h(Item, { key: i, q })));
  const List = memoList ? memo(ListImpl) : ListImpl;
  function App() {
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const dq = useDeferredValue(text);
    const shown = deferred ? dq : q;
    log.push(`App text=${text} list=${shown}`);
    const onChange = (e) => { setText(e.target.value); if (!deferred) startTransition(() => setQ(e.target.value)); };
    return h('div', null, h('input', { value: text, onChange }), h(List, { q: shown }));
  }
  return { log, App };
}

async function start(App) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = false; // настоящий планировщик, а не очередь act
  const c = document.createElement('div');
  document.body.appendChild(c);
  const root = createRoot(c);
  root.render(h(App));
  await sleep(300);
  const input = c.querySelector('input');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const type = (v) => { setValue.call(input, v); input.dispatchEvent(new window.Event('input', { bubbles: true })); };
  const shown = [];
  new window.MutationObserver(() => shown.push(c.querySelector('li').textContent)).observe(c.querySelector('ul'), { subtree: true, characterData: true, childList: true });
  return { c, root, type, shown };
}

(async () => {
  // 1. isPending: сначала срочный рендер (true, старый state), потом рендер transition (false, новый)
  {
    const seen = [];
    let click;
    function Tabs() {
      const [isPending, startT] = useTransition();
      const [tab, setTab] = useState('posts');
      seen.push(`${isPending}/${tab}`);
      click = () => startT(() => setTab('contact'));
      return null;
    }
    await mount(h(Tabs));
    await React.act(async () => click());
    assert.deepEqual(seen, ['false/posts', 'true/posts', 'false/contact']);
  }

  // 2. ввод прерывает рендер transition: 'a' брошен на середине и не попал на экран, 'ab' отрендерен с нуля
  {
    const { log, App } = setup();
    const { type, shown, root } = await start(App);
    log.length = 0;
    type('a');
    setTimeout(() => type('ab'), 20);
    await sleep(600);
    const items = (q) => log.filter((l) => l === `item:${q}`).length;
    console.log(compact(log).join(' | '));
    assert.equal(log[0], 'App text=a list=');          // срочный рендер: поле уже 'a', список старый
    assert.equal(items(''), 0);                         // memo-список в срочном рендере пропущен
    assert.ok(items('a') > 0 && items('a') < 50);       // transition 'a' начат и брошен
    assert.equal(items('ab'), 50);                      // 'ab' — целиком
    assert.ok(!shown.includes('a'));                    // 'a' в DOM не было
    assert.equal(shown.at(-1), 'ab');
    root.unmount();
  }

  // 3. апдейт из setTimeout (обычный приоритет) transition не прерывает: 'a' докоммичен первым
  {
    const { log, App } = setup();
    let bump;
    function Wrap() { const [n, setN] = useState(0); bump = () => setN((x) => x + 1); return h('div', null, h('i', null, n), h(App)); }
    const { c, root, type } = await start(Wrap);
    log.length = 0;
    const order = [];
    new window.MutationObserver(() => order.push(`li=${c.querySelector('li').textContent} i=${c.querySelector('i').textContent}`))
      .observe(c, { subtree: true, characterData: true, childList: true });
    type('a');
    setTimeout(() => bump(), 20);
    await sleep(600);
    const items = log.filter((l) => l === 'item:a').length;
    assert.equal(items, 50);                            // рендер 'a' не перезапускался
    assert.equal(order.find((o) => o.startsWith('li=a')), 'li=a i=0'); // 'a' на экране раньше, чем счётчик
    root.unmount();
  }

  // 4. один долгий компонент не прерывается: событие ждёт, пока он досчитает
  {
    let firedAt;
    function Heavy({ q }) { busy(q ? 60 : 0); return h('p', null, q); }
    function App() { const [q, setQ] = useState(''); return h('div', null, h('input', { value: '', onChange: (e) => startTransition(() => setQ(e.target.value)) }), h('ul', null, h('li', null, q)), h(Heavy, { q })); }
    const { type, root } = await start(App);
    const t0 = performance.now();
    type('a');
    setTimeout(() => { firedAt = performance.now() - t0; }, 10);
    await sleep(300);
    console.log('таймер на 10 мс сработал через', firedAt.toFixed(0), 'мс');
    assert.ok(firedAt >= 55);
    root.unmount();
  }

  // 4b. второй клик по вкладке: с useTransition рендер первой вкладки брошен (isPending=true — срочный апдейт),
  //     с голым startTransition первая вкладка докоммичена, вторая рендерится следом (transition не прерывает transition)
  for (const useHook of [true, false]) {
    const log = [];
    let select;
    function Item({ t }) { log.push(t); busy(2); return h('li', null, t); }
    function Tabs() {
      const [, startT] = useTransition();
      const [tab, setTab] = useState('home');
      select = (next) => (useHook ? startT : startTransition)(() => setTab(next));
      return h('ul', null, tab === 'home' ? null : Array.from({ length: 50 }, (_, i) => h(Item, { key: i, t: tab })));
    }
    const { c, root } = await start(Tabs);
    const shownTabs = [];
    new window.MutationObserver(() => { const li = c.querySelector('li'); if (li) shownTabs.push(li.textContent); })
      .observe(c, { subtree: true, childList: true, characterData: true });
    select('posts');
    setTimeout(() => select('contact'), 20);
    await sleep(600);
    const posts = log.filter((t) => t === 'posts').length;
    console.log(useHook ? 'useTransition:' : 'startTransition:', 'posts', posts, 'contact', log.filter((t) => t === 'contact').length);
    if (useHook) { assert.ok(posts > 0 && posts < 50); assert.ok(!shownTabs.includes('posts')); }
    else { assert.equal(posts, 50); assert.ok(shownTabs.includes('posts')); }
    assert.equal(shownTabs.at(-1), 'contact');
    root.unmount();
  }

  // 5. useDeferredValue: срочный рендер со старым значением, фоновый — с новым; без memo список считается дважды
  for (const memoList of [true, false]) {
    const { log, App } = setup({ memoList, deferred: true });
    const { type, shown, root } = await start(App);
    log.length = 0;
    type('a');
    await sleep(400);
    const c = compact(log);
    console.log(`memo=${memoList}:`, c.join(' | '));
    assert.equal(c[0], 'App text=a list=');
    if (memoList) assert.deepEqual(c, ['App text=a list=', 'App text=a list=a', 'item:a x50']);
    else assert.deepEqual(c, ['App text=a list=', 'item: x50', 'App text=a list=a', 'item:a x50']);
    assert.equal(shown.at(-1), 'a');
    root.unmount();
  }
  console.log('ok');
})().catch((e) => { console.log(e); process.exit(1); });
