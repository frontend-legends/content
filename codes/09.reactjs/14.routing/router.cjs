// Глава 9.14 — React Router: вложенные маршруты и Outlet, параметры, search params,
// загрузчики родителя и ребёнка стартуют параллельно, redirect из загрузчика, action + перезагрузка данных, lazy.
// run: node router.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { createMemoryRouter, RouterProvider, Outlet, Link, useLoaderData, useParams, useSearchParams, redirect, Form } = require('react-router');
const wait = (ms) => React.act(async () => new Promise((r) => setTimeout(r, ms)));
async function until(container, text) { for (let i = 0; i < 50 && !container.textContent.includes(text); i++) await wait(10); }

(async () => {
  const log = [];
  let user = null;
  let likes = 0;
  const t0 = performance.now();
  const at = () => Math.round(performance.now() - t0);
  const delay = (v, ms = 40) => new Promise((r) => setTimeout(() => r(v), ms));

  function Layout() { return h('div', null, h('nav', null, h(Link, { to: '/catalog/tea?sort=price' }, 'Чай')), h('main', null, h(Outlet))); }
  function Category() {
    const { items } = useLoaderData();
    const { category } = useParams();
    const [params] = useSearchParams();
    return h('section', null, `${category}:${params.get('sort')}:${items.join(',')}`, h(Outlet));
  }
  function Product() {
    const { product, likes } = useLoaderData();
    return h('article', null, `${product} ♥${likes}`, h(Form, { method: 'post' }, h('button', { type: 'submit' }, 'like')));
  }

  const router = createMemoryRouter([
    {
      path: '/', element: h(Layout), children: [
        { index: true, element: h('p', null, 'home') },
        {
          path: 'catalog/:category', element: h(Category),
          loader: async ({ params }) => { log.push(`category start ${at()}`); return { items: await delay([`${params.category}-1`]) }; },
          children: [{
            path: ':id', element: h(Product),
            loader: async ({ params }) => { log.push(`product start ${at()}`); return { product: await delay(`p${params.id}`), likes }; },
            action: async () => { likes++; return null; },
          }],
        },
        { path: 'account', loader: () => (user ? null : redirect('/login?next=/account')), element: h('p', null, 'account') },
        { path: 'login', element: h('p', null, 'login') },
        { path: 'stats', lazy: async () => { log.push('stats chunk'); return { Component: () => h('p', null, 'stats page') }; } },
      ],
    },
  ], { initialEntries: ['/'] });

  const { container } = await mount(h(RouterProvider, { router }));
  assert.equal(container.querySelector('main').textContent, 'home');

  // Link: клиентский переход с параметрами и query
  await React.act(async () => container.querySelector('a').click());
  await until(container, 'tea:price');
  assert.equal(container.querySelector('section').textContent, 'tea:price:tea-1');

  // вложенный маршрут: загрузчики родителя и ребёнка стартуют одновременно
  log.length = 0;
  await React.act(async () => router.navigate('/catalog/coffee/7'));
  await until(container, 'p7');
  assert.equal(container.querySelector('main').textContent, 'coffee:null:coffee-1p7 ♥0like');
  const [c, p] = log.map((l) => Number(l.split(' ').pop()));
  assert.ok(Math.abs(c - p) < 10, `параллельно: ${log.join(', ')}`);

  // action → после него загрузчики маршрута перезапускаются сами
  await React.act(async () => container.querySelector('button').click());
  await until(container, '♥1');
  assert.match(container.querySelector('article').textContent, /♥1/);

  // защита маршрута в загрузчике: redirect до рендера страницы
  await React.act(async () => router.navigate('/account'));
  await until(container, 'login');
  assert.equal(router.state.location.pathname + router.state.location.search, '/login?next=/account');

  // lazy: код маршрута загружается только при переходе
  assert.ok(!log.includes('stats chunk'));
  await React.act(async () => router.navigate('/stats'));
  await until(container, 'stats page');
  assert.ok(log.includes('stats chunk'));
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
