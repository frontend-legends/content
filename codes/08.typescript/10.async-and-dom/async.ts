// Глава 8.10 — типы промисов и асинхронных функций, any из json(), граница данных, отмена.
import assert from 'node:assert/strict';
import { z } from 'zod';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

// --- async всегда возвращает Promise
async function total() { return 980; }
ok<Equal<ReturnType<typeof total>, Promise<number>>>();
// @ts-expect-error — TS1064: The return type of an async function must be the global Promise<T> type
async function wrong(): number { return 1; }
void wrong;
async function noValue() {}
ok<Equal<ReturnType<typeof noValue>, Promise<void>>>();

// --- new Promise без параметра — Promise<unknown>
const p1 = new Promise((resolve) => resolve(1));
ok<Equal<typeof p1, Promise<unknown>>>();
const p2 = new Promise<number>((resolve) => resolve(1));
ok<Equal<typeof p2, Promise<number>>>();
// @ts-expect-error — resolve без аргумента допустим только для Promise<void>
new Promise<number>((resolve) => resolve());
new Promise<void>((resolve) => resolve());

// --- комбинаторы сохраняют кортеж
async function main() {
  const [user, count] = await Promise.all([Promise.resolve({ id: 1 }), Promise.resolve(3)]);
  ok<Equal<typeof user, { id: number }>>();
  ok<Equal<typeof count, number>>();

  const settled = await Promise.allSettled([Promise.resolve(1), Promise.reject(new Error('x'))]);
  const first = settled[0];
  ok<Equal<typeof first, PromiseSettledResult<number>>>();
  if (first.status === 'fulfilled') ok<Equal<typeof first.value, number>>();
  const second = settled[1];
  if (second.status === 'rejected') ok<Equal<typeof second.reason, any>>();
  assert.equal(second.status, 'rejected');

  // --- catch у промиса — any даже под strict
  await Promise.reject(new Error('boom')).catch((e) => {
    ok<Equal<typeof e, any>>();
    assert.equal(e.message, 'boom');
  });
  // в try/catch — unknown
  try { await Promise.reject(new Error('boom')); } catch (e) {
    ok<Equal<typeof e, unknown>>();
  }

  // --- json() — Promise<any>: любой тип «подходит»
  const res = new Response(JSON.stringify({ id: 1, name: 'Аня' }));
  const data = await res.json();
  ok<Equal<typeof data, any>>();
  const wrongShape: { email: string } = data;   // компилируется
  assert.equal(wrongShape.email, undefined);

  // дженерик-обёртка — тот же as
  async function fetchJson<T>(r: Response): Promise<T> { return r.json() as Promise<T>; }
  const u = await fetchJson<{ email: string }>(new Response('{"id":1}'));
  assert.throws(() => u.email.toUpperCase(), TypeError);

  // схема — тип выводится из проверки
  const User = z.object({ id: z.number(), name: z.string() });
  async function fetchUser(r: Response) { return User.parse(await r.json()); }
  const parsed = await fetchUser(new Response('{"id":1,"name":"Аня"}'));
  ok<Equal<typeof parsed, { id: number; name: string }>>();
  await assert.rejects(fetchUser(new Response('{"id":"1"}')), z.ZodError);

  // safeParse — без исключений, размеченный результат
  const r = User.safeParse({ id: 1 });
  if (!r.success) assert.ok(r.error.issues.length > 0);
  assert.equal(r.success, false);

  // --- результат вместо исключения
  type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
  async function safe<T>(p: Promise<T>): Promise<Result<T>> {
    try { return { ok: true, value: await p }; } catch (e) {
      return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }
  const sr = await safe(Promise.reject('строка'));
  assert.equal(sr.ok, false);
  if (!sr.ok) assert.equal(sr.error.message, 'строка');

  // --- отмена: AbortSignal.timeout и причина
  const slow = (signal: AbortSignal) => new Promise<string>((resolve, reject) => {
    const t = setTimeout(() => resolve('done'), 200);
    signal.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });
  await assert.rejects(slow(AbortSignal.timeout(10)), (e: unknown) => e instanceof DOMException && e.name === 'TimeoutError');
  const ctrl = new AbortController();
  const pr = slow(ctrl.signal);
  ctrl.abort();
  await assert.rejects(pr, (e: unknown) => e instanceof DOMException && e.name === 'AbortError');
  function isAbort(e: unknown) { return e instanceof DOMException && (e.name === 'AbortError' || e.name === 'TimeoutError'); }
  assert.equal(isAbort(new Error('x')), false);

  // --- забытый await tsc не ловит
  async function save() { return 1; }
  function handler() { save(); }   // плавающий промис — без ошибки компиляции
  handler();
  // а использование промиса как значения — ловит
  async function isReady() { return false; }
  // @ts-expect-error — TS2801: This condition will always return true since this 'Promise<boolean>' is always defined
  if (isReady()) { /* ... */ }
}

main().then(() => console.log('async ok'), (e) => { console.error(e); process.exit(1); });
