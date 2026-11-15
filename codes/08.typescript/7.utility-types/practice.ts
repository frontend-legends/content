// Глава 8.07 — практика: CRUD-типы, распределяющий Omit, типы из функции API.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const ok = <T extends true>() => {};

// 1. CRUD
type User = { id: number; name: string; email: string; role: 'admin' | 'user'; createdAt: Date };
type ServerFields = 'id' | 'createdAt';
type CreateUser = Omit<User, ServerFields>;
type UpdateUser = Pick<User, 'id'> & Partial<Omit<User, ServerFields>>;
type UserListItem = Pick<User, 'id' | 'name' | 'role'>;
const create: CreateUser = { name: 'Аня', email: 'a@shop.ru', role: 'user' };
const update: UpdateUser = { id: 1, role: 'admin' };
const item: UserListItem = { id: 1, name: 'Аня', role: 'user' };
// @ts-expect-error — id обязателен
const upd2: UpdateUser = { role: 'admin' };
// @ts-expect-error — id в создании лишний
const cr2: CreateUser = { id: 1, name: 'Аня', email: 'a@shop.ru', role: 'user' };
void create; void update; void item; void upd2; void cr2;

// 2. распределяющий Omit
type ShapeProps =
  | { kind: 'circle'; r: number; id: string }
  | { kind: 'square'; side: number; id: string };
ok<Equal<keyof Omit<ShapeProps, 'id'>, 'kind'>>();
function WrapperBroken(props: Omit<ShapeProps, 'id'>) {
  // @ts-expect-error — r не существует
  if (props.kind === 'circle') return props.r;
}
void WrapperBroken;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
function Wrapper(props: DistributiveOmit<ShapeProps, 'id'>) {
  if (props.kind === 'circle') return props.r;
  return props.side;
}
assert.equal(Wrapper({ kind: 'circle', r: 3 }), 3);

// 3. типы из функции
async function loadCart(userId: number, opts?: { signal?: AbortSignal }) {
  void opts;
  return { userId, items: [{ sku: 'tea', qty: 2 }], total: 980 };
}
type Cart = Awaited<ReturnType<typeof loadCart>>;
type LoadCartArgs = Parameters<typeof loadCart>;
ok<Equal<Cart['items'][number]['qty'], number>>();
ok<Equal<LoadCartArgs, [userId: number, opts?: { signal?: AbortSignal }]>>();
let calls = 0;
async function flaky(...args: LoadCartArgs): Promise<Cart> {
  calls++;
  if (calls === 1) throw new Error('network');
  return loadCart(...args);
}
async function withRetry(...args: LoadCartArgs): Promise<Cart> {
  try { return await flaky(...args); } catch { return flaky(...args); }
}
void (async () => {
  const cart = await withRetry(1);
  assert.equal(cart.total, 980);
  assert.equal(calls, 2);
})().catch((e) => { console.error(e); process.exit(1); });
