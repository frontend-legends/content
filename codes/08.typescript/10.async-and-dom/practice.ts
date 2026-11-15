// Глава 8.10 — практика: getJson со схемой и различимыми ошибками.
import assert from 'node:assert/strict';
import { z } from 'zod';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

type LoadError =
  | { kind: 'http'; status: number }
  | { kind: 'aborted' }
  | { kind: 'invalid'; issues: z.core.$ZodIssue[] }
  | { kind: 'network'; error: unknown };
type Result<T> = { ok: true; value: T } | { ok: false; error: LoadError };

async function getJson<S extends z.ZodType>(url: string, schema: S, signal?: AbortSignal): Promise<Result<z.infer<S>>> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError')) {
      return { ok: false, error: { kind: 'aborted' } };
    }
    return { ok: false, error: { kind: 'network', error: e } };
  }
  if (!res.ok) return { ok: false, error: { kind: 'http', status: res.status } };
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) return { ok: false, error: { kind: 'invalid', issues: parsed.error.issues } };
  return { ok: true, value: parsed.data };
}

// подменённый fetch
const routes: Record<string, () => Response> = {
  '/api/products/1': () => Response.json({ id: 1, title: 'Чай' }),
  '/api/products/2': () => Response.json({ id: '2' }),
  '/api/products/404': () => new Response('nope', { status: 404 }),
};
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  if (url === '/api/slow') {
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(Response.json({})), 500);
      init?.signal?.addEventListener('abort', () => { clearTimeout(t); reject(init.signal!.reason); });
    });
  }
  const r = routes[url];
  if (!r) throw new TypeError('fetch failed');
  return r();
}) as typeof fetch;

const Product = z.object({ id: z.number(), title: z.string() });

void (async () => {
  const r = await getJson('/api/products/1', Product);
  if (r.ok) {
    ok<Equal<typeof r.value, { id: number; title: string }>>();
    assert.equal(r.value.title, 'Чай');
  } else assert.fail();

  const bad = await getJson('/api/products/2', Product);
  assert.equal(!bad.ok && bad.error.kind, 'invalid');
  const nf = await getJson('/api/products/404', Product);
  assert.ok(!nf.ok && nf.error.kind === 'http' && nf.error.status === 404);
  const ab = await getJson('/api/slow', Product, AbortSignal.timeout(10));
  assert.equal(!ab.ok && ab.error.kind, 'aborted');
  const net = await getJson('/api/missing', Product);
  assert.equal(!net.ok && net.error.kind, 'network');
  console.log('practice ok');
})().catch((e) => { console.error(e); process.exit(1); });
