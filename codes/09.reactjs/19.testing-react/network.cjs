// Глава 9.19 — сеть в тестах: MSW перехватывает fetch на уровне сети; тест ошибки с TanStack Query
// не дожидается ошибки из-за повторов по умолчанию, пока в тестовом QueryClient не выключить retry.
// run: node network.cjs
const assert = require('node:assert/strict');
const { React, h } = require('../../_lib/react.cjs');
const { render, screen, cleanup } = require('@testing-library/react');
const { http, HttpResponse } = require('msw');
const { setupServer } = require('msw/node');
const { QueryClient, QueryClientProvider, useQuery } = require('@tanstack/react-query');

const server = setupServer(
  http.get('https://api.shop.test/users/1', () => HttpResponse.json({ name: 'Аня' })),
  http.get('https://api.shop.test/users/2', () => new HttpResponse(null, { status: 500 })),
);
server.listen({ onUnhandledRequest: 'error' });

function User({ id }) {
  const { data, error, isPending } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const r = await fetch(`https://api.shop.test/users/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  if (isPending) return h('p', null, 'Загрузка');
  if (error) return h('p', { role: 'alert' }, 'Не удалось загрузить');
  return h('h1', null, data.name);
}
const renderWithClient = (ui, client) => render(h(QueryClientProvider, { client }, ui));

(async () => {
  // компонент получает ответ MSW, не зная о моке
  renderWithClient(h(User, { id: 1 }), new QueryClient());
  assert.equal((await screen.findByRole('heading')).textContent, 'Аня');
  cleanup();

  // повторы по умолчанию: ошибка не успевает появиться за 1 секунду ожидания findBy
  renderWithClient(h(User, { id: 2 }), new QueryClient());
  await assert.rejects(screen.findByRole('alert'), /Unable to find role="alert"/);
  cleanup();

  // тестовый клиент без повторов: ошибка видна сразу
  const testClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  renderWithClient(h(User, { id: 2 }), testClient);
  assert.equal((await screen.findByRole('alert')).textContent, 'Не удалось загрузить');
  cleanup();

  server.close();
  console.log('ok');
  process.exit(0);
})().catch((e) => { console.log(e); process.exit(1); });
