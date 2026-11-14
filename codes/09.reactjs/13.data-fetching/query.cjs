// Глава 9.13 — TanStack Query: дедупликация, кеш и staleTime, stale-while-revalidate, повторы по умолчанию,
// инвалидация после мутации, оптимистичное обновление с откатом.
// run: node query.cjs
const assert = require('node:assert/strict');
const { React, h, mount } = require('../../_lib/react.cjs');
const { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } = require('@tanstack/react-query');

const wait = (ms) => React.act(async () => new Promise((r) => setTimeout(r, ms)));

function api() {
  const calls = [];
  let name = 'Ann';
  return {
    calls,
    rename: (n) => { name = n; },
    user: (id) => { calls.push(`user ${id}`); return new Promise((r) => setTimeout(() => r({ id, name }), 20)); },
  };
}

(async () => {
  // два компонента с одним ключом — один запрос
  {
    const server = api();
    const client = new QueryClient();
    function Name() { const { data } = useQuery({ queryKey: ['user', 1], queryFn: () => server.user(1) }); return h('i', null, data?.name ?? '...'); }
    const { container } = await mount(h(QueryClientProvider, { client }, h(Name), h(Name)));
    await wait(50);
    assert.equal(container.textContent, 'AnnAnn');
    assert.deepEqual(server.calls, ['user 1']);
  }

  // stale-while-revalidate: при повторном монтировании сразу кеш, в фоне — новый запрос (staleTime = 0)
  {
    const server = api();
    const client = new QueryClient();
    function Name() { const { data, isFetching } = useQuery({ queryKey: ['user', 1], queryFn: () => server.user(1) }); return h('i', null, `${data?.name ?? '...'}${isFetching ? '*' : ''}`); }
    const a = await mount(h(QueryClientProvider, { client }, h(Name)));
    await wait(50);
    await React.act(async () => a.root.unmount());
    server.rename('Anna');
    const b = await mount(h(QueryClientProvider, { client }, h(Name)));
    assert.equal(b.container.textContent, 'Ann*');   // старые данные сразу + фоновый запрос
    await wait(50);
    assert.equal(b.container.textContent, 'Anna');
    assert.equal(server.calls.length, 2);

    // со staleTime данные свежие — повторного запроса нет
    const fresh = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });
    const s2 = api();
    function N2() { const { data } = useQuery({ queryKey: ['u'], queryFn: () => s2.user(1) }); return h('i', null, data?.name ?? '...'); }
    const c = await mount(h(QueryClientProvider, { client: fresh }, h(N2)));
    await wait(50);
    await React.act(async () => c.root.unmount());
    await mount(h(QueryClientProvider, { client: fresh }, h(N2)));
    await wait(50);
    assert.equal(s2.calls.length, 1);
  }

  // по умолчанию 3 повтора: 4 попытки
  {
    let attempts = 0;
    const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
    function Fails() { const { status } = useQuery({ queryKey: ['x'], queryFn: async () => { attempts++; throw new Error('500'); } }); return h('i', null, status); }
    const { container } = await mount(h(QueryClientProvider, { client }, h(Fails)));
    await wait(100);
    assert.equal(attempts, 4);
    assert.equal(container.textContent, 'error');
  }

  // мутация + инвалидация: ключ помечен устаревшим, активный запрос перезапрошен
  {
    const server = api();
    const client = new QueryClient();
    let rename;
    function Profile() {
      const qc = useQueryClient();
      const { data } = useQuery({ queryKey: ['user', 1], queryFn: () => server.user(1) });
      const m = useMutation({
        mutationFn: async (n) => { server.rename(n); },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['user'] }),
      });
      rename = m.mutate;
      return h('i', null, data?.name ?? '...');
    }
    const { container } = await mount(h(QueryClientProvider, { client }, h(Profile)));
    await wait(50);
    await React.act(async () => rename('Bob'));
    await wait(50);
    assert.equal(container.textContent, 'Bob');
    assert.equal(server.calls.length, 2);
  }

  // оптимистичное обновление с откатом при ошибке
  {
    const client = new QueryClient();
    const seen = [];
    let like;
    function Post() {
      const qc = useQueryClient();
      const { data } = useQuery({ queryKey: ['post', 1], queryFn: async () => ({ liked: false }) });
      const m = useMutation({
        mutationFn: () => new Promise((_, reject) => setTimeout(() => reject(new Error('offline')), 20)),
        onMutate: async () => {
          await qc.cancelQueries({ queryKey: ['post', 1] });
          const prev = qc.getQueryData(['post', 1]);
          qc.setQueryData(['post', 1], (p) => ({ ...p, liked: !p.liked }));
          return { prev };
        },
        onError: (_e, _v, ctx) => qc.setQueryData(['post', 1], ctx.prev),
      });
      like = m.mutate;
      if (data) seen.push(data.liked);
      return h('i', null, String(data?.liked));
    }
    const { container } = await mount(h(QueryClientProvider, { client }, h(Post)));
    await wait(10);
    await React.act(async () => like());
    await wait(5);                                 // уведомления TanStack приходят в следующей задаче
    assert.equal(container.textContent, 'true');   // до ответа сервера (он придёт через 20 мс)
    await wait(60);
    assert.equal(container.textContent, 'false');  // откат
  }
  console.log('ok');
  process.exit(0); // таймеры сборки мусора кеша (gcTime 5 минут) держат процесс
})().catch((e) => { console.log(e); process.exit(1); });
