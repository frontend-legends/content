// Глава 9.13 — «Водопады»: вложенные компоненты грузят последовательно, загрузка на уровне страницы — параллельно.
// run: node waterfall.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { useState, useEffect } = React;

const delay = (v, ms = 50) => new Promise((r) => setTimeout(() => r(v), ms));
const api = { user: () => delay({ id: 1 }), posts: () => delay(['p1']), friends: () => delay(['f1']) };

function useData(fn, deps) {
  const [data, setData] = useState(null);
  useEffect(() => { let ignore = false; fn().then((d) => { if (!ignore) setData(d); }); return () => { ignore = true; }; }, deps);
  return data;
}

async function measure(App) {
  const t0 = performance.now();
  const { container } = await mount(h(App));
  while (!container.textContent.includes('done')) await React.act(async () => new Promise((r) => setTimeout(r, 5)));
  return Math.round(performance.now() - t0);
}

(async () => {
  // каждый уровень начинает грузить только после того, как отрисовался
  function Friends() { const f = useData(api.friends, []); return f ? h('i', null, 'done') : 'loading friends'; }
  function Posts() { const p = useData(api.posts, []); return p ? h(Friends) : 'loading posts'; }
  function Page() { const u = useData(api.user, []); return u ? h(Posts) : 'loading user'; }
  const sequential = await measure(Page);

  // все независимые запросы стартуют сразу
  function ParallelPage() {
    const data = useData(() => Promise.all([api.user(), api.posts(), api.friends()]), []);
    return data ? h('i', null, 'done') : 'loading';
  }
  const parallel = await measure(ParallelPage);
  console.log(`водопад: ${sequential} мс, параллельно: ${parallel} мс`);
  assert.ok(sequential >= 150 && parallel < 110);
})().catch((e) => { console.log(e); process.exit(1); });
