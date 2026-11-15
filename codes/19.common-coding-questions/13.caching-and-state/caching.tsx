// Проверки к 19.13: LRU на Map и на двусвязном списке против примера LeetCode 146 и пакета lru-cache;
// rate limiter — фиксированное окно (всплеск 2× на границе), скользящее окно и token bucket на управляемых
// часах; селектор против настоящего reselect (и ловушка нестабильного входа); мини-стор против zustand/vanilla
// и подключение к React через useSyncExternalStore (неустойчивый снимок — ошибка React).
import assert from 'node:assert/strict';
import { useSyncExternalStore } from 'react';
import { LRUCache as NpmLRU } from 'lru-cache';
import { createSelector as reselect } from 'reselect';
import { createStore as zustandStore } from 'zustand/vanilla';

const { errors } = require('../../_lib/react.cjs') as { errors: string[] };
const { render, screen, act, cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');

// ===================== LRU =====================
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private capacity: number) {}
  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key)!;
    this.cache.delete(key);                     // удалить и вставить заново — элемент уходит в конец
    this.cache.set(key, value);
    return value;
  }
  put(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    if (this.cache.size > this.capacity) {
      const oldest = this.cache.keys().next().value as K; // первый ключ итерации — самый старый
      this.cache.delete(oldest);
    }
  }
  keys() { return [...this.cache.keys()]; }
}

type DNode<K, V> = { key: K; value: V; prev: DNode<K, V> | null; next: DNode<K, V> | null };
class LRUList<K, V> {
  private map = new Map<K, DNode<K, V>>();
  private head: DNode<K, V> | null = null;  // самый свежий
  private tail: DNode<K, V> | null = null;  // самый старый
  constructor(private capacity: number) {}
  private unlink(n: DNode<K, V>) {
    if (n.prev) n.prev.next = n.next; else this.head = n.next;
    if (n.next) n.next.prev = n.prev; else this.tail = n.prev;
    n.prev = n.next = null;
  }
  private pushFront(n: DNode<K, V>) {
    n.next = this.head;
    if (this.head) this.head.prev = n;
    this.head = n;
    if (!this.tail) this.tail = n;
  }
  get(key: K): V | undefined {
    const n = this.map.get(key);
    if (!n) return undefined;
    this.unlink(n); this.pushFront(n);       // освежить за O(1)
    return n.value;
  }
  put(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing) { existing.value = value; this.unlink(existing); this.pushFront(existing); return; }
    const n: DNode<K, V> = { key, value, prev: null, next: null };
    this.map.set(key, n); this.pushFront(n);
    if (this.map.size > this.capacity && this.tail) { const old = this.tail; this.unlink(old); this.map.delete(old.key); }
  }
}

// пример из LeetCode 146: get возвращает -1, если ключа нет
const leetcode = (cache: { get(k: number): number | undefined; put(k: number, v: number): void }) => {
  const out: number[] = [];
  const get = (k: number) => out.push(cache.get(k) ?? -1);
  cache.put(1, 1); cache.put(2, 2); get(1); cache.put(3, 3); get(2); cache.put(4, 4); get(1); get(3); get(4);
  return out;
};
assert.deepEqual(leetcode(new LRUCache(2)), [1, -1, -1, 3, 4]);
assert.deepEqual(leetcode(new LRUList(2)), [1, -1, -1, 3, 4]);
{ const npm = new NpmLRU<number, number>({ max: 2 }); assert.deepEqual(leetcode({ get: (k) => npm.get(k), put: (k, v) => { npm.set(k, v); } }), [1, -1, -1, 3, 4]); } // как пакет lru-cache (у него set вместо put)
{
  const c = new LRUCache<string, number>(3);
  c.put('a', 1); c.put('b', 2); c.put('c', 3);
  c.get('a');                                  // a освежён
  c.put('b', 20);                              // обновление тоже освежает
  c.put('d', 4);                               // вытесняется самый давний — c
  assert.deepEqual(c.keys(), ['a', 'b', 'd']);
  const undef = new LRUCache<string, undefined>(2); undef.put('x', undefined);
  assert.equal(undef.get('x'), undefined);     // осторожно: «нет ключа» и «значение undefined» неразличимы снаружи
  // почему не объект: целочисленные ключи идут первыми по возрастанию, независимо от порядка вставки
  const asObject: Record<string, number> = {}; for (const k of ['b', '20', 'a', '3']) asObject[k] = 1;
  assert.deepEqual(Object.keys(asObject), ['3', '20', 'b', 'a']);
  assert.deepEqual([...new Map(['b', '20', 'a', '3'].map((k) => [k, 1])).keys()], ['b', '20', 'a', '3']);
}

// ===================== rate limiter на управляемых часах =====================
const clock = { now: 0 };
function slidingWindow(limit: number, windowMs: number) {
  let stamps: number[] = [];
  return () => {
    const now = clock.now;
    stamps = stamps.filter((t) => now - t < windowMs); // только метки внутри окна
    if (stamps.length < limit) { stamps.push(now); return true; }
    return false;
  };
}
function fixedWindow(limit: number, windowMs: number) {
  let windowStart = -Infinity, count = 0;
  return () => {
    const now = clock.now;
    if (now - windowStart >= windowMs) { windowStart = now - (now % windowMs); count = 0; } // новое окно
    if (count < limit) { count++; return true; }
    return false;
  };
}
function tokenBucket(capacity: number, refillPerSec: number) {
  let tokens = capacity, last = clock.now;
  return () => {
    const now = clock.now;
    tokens = Math.min(capacity, tokens + ((now - last) / 1000) * refillPerSec); // долив пропорционально времени
    last = now;
    if (tokens >= 1) { tokens -= 1; return true; }
    return false;
  };
}
const burst = (allow: () => boolean, at: number, n: number) => { clock.now = at; return Array.from({ length: n }, allow).filter(Boolean).length; };
{
  clock.now = 0;
  const allow = slidingWindow(3, 1000);
  assert.equal(burst(allow, 0, 4), 3);           // 4 попытки — 3 разрешены
  assert.equal(burst(allow, 999, 1), 0);        // окно ещё не прошло
  assert.equal(burst(allow, 1000, 3), 3);       // старые метки вышли из окна
}
{
  // всплеск на стыке окон: фиксированное окно пропускает вдвое больше лимита за секунду
  clock.now = 0;
  const fixed = fixedWindow(3, 1000), sliding = slidingWindow(3, 1000);
  const fixedPassed = burst(fixed, 999, 3) + burst(fixed, 1000, 3);
  clock.now = 0;
  const slidingPassed = burst(sliding, 999, 3) + burst(sliding, 1000, 3);
  assert.equal(fixedPassed, 6);                 // 6 запросов за 2 мс при лимите 3 в секунду
  assert.equal(slidingPassed, 3);
}
{
  clock.now = 0;
  const allow = tokenBucket(5, 2);              // ведро на 5, доливается 2 токена в секунду
  assert.equal(burst(allow, 0, 10), 5);          // всплеск до ёмкости
  assert.equal(burst(allow, 250, 1), 0);        // за 250 мс накопилось 0,5 токена — мало
  assert.equal(burst(allow, 500, 1), 1);        // за 500 мс — ровно токен
  assert.equal(burst(allow, 3000, 10), 5);      // за долгую паузу — не больше ёмкости
}

// ===================== мемоизированный селектор против reselect =====================
function createSelector<S, A, R>(inputFn: (state: S) => A, resultFn: (input: A) => R) {
  let lastInput: A, lastResult: R, hasRun = false;
  return (state: S): R => {
    const input = inputFn(state);
    if (!hasRun || input !== lastInput) {       // вход тот же по ссылке — отдаём кеш
      lastResult = resultFn(input); lastInput = input; hasRun = true;
    }
    return lastResult;
  };
}
type Todo = { id: number; done: boolean };
type State = { todos: Todo[]; filter: string };
{
  let ours = 0, theirs = 0;
  const selOurs = createSelector((s: State) => s.todos, (todos) => { ours++; return todos.filter((t) => t.done); });
  const selReselect = reselect([(s: State) => s.todos], (todos) => { theirs++; return todos.filter((t) => t.done); }, { devModeChecks: { inputStabilityCheck: 'never', identityFunctionCheck: 'never' } });
  let state: State = { todos: [{ id: 1, done: true }, { id: 2, done: false }], filter: 'all' };
  const r1 = selOurs(state); selReselect(state);
  state = { ...state, filter: 'done' };          // поменялось другое поле, todos — та же ссылка
  const r2 = selOurs(state); selReselect(state);
  assert.equal(r1, r2);                          // тот же массив-результат — компонент не перерисуется
  state = { ...state, todos: [...state.todos, { id: 3, done: true }] };
  selOurs(state); selReselect(state);
  assert.deepEqual([ours, theirs], [2, 2]);      // пересчёт только при смене входа — как у reselect
  // ловушка: вход, который каждый раз создаёт новый массив, ломает мемоизацию
  let unstable = 0;
  const bad = createSelector((s: State) => s.todos.filter((t) => t.id > 0), (list) => { unstable++; return list.length; });
  bad(state); bad(state); bad(state);
  assert.equal(unstable, 3);                     // пересчёт на каждом вызове
  // reselect в режиме разработки предупреждает о нестабильном входе
  const warns: string[] = []; const origWarn = console.warn; console.warn = (m: unknown) => { warns.push(String(m)); };
  reselect([(s: State) => s.todos.filter((t) => t.id > 0)], (list) => list.length)(state);
  console.warn = origWarn;
  assert.match(warns.join(' '), /An input selector returned a different result when passed same arguments/);
  // чередование двух состояний: наш кеш на один вход пересчитывает каждый раз, reselect 5 помнит оба
  const s1: State = { todos: [{ id: 1, done: true }], filter: 'all' }, s2: State = { todos: [{ id: 2, done: true }], filter: 'all' };
  let oursAlt = 0, theirsAlt = 0;
  const altOurs = createSelector((s: State) => s.todos, (t) => { oursAlt++; return t.length; });
  const altReselect = reselect([(s: State) => s.todos], (t) => { theirsAlt++; return t.length; });
  for (const st of [s1, s2, s1, s2]) { altOurs(st); altReselect(st); }
  assert.deepEqual([oursAlt, theirsAlt], [4, 2]);  // weakMapMemoize по умолчанию кеширует по ссылкам без лимита
}

// ===================== мини-стор против zustand =====================
type Setter<S> = (partial: Partial<S> | ((s: S) => Partial<S>)) => void;
function createStore<S extends object>(initial: S) {
  let state = initial;
  const listeners = new Set<(s: S, prev: S) => void>();
  const setState: Setter<S> = (partial) => {
    const next = typeof partial === 'function' ? partial(state) : partial;
    if (Object.is(next, state)) return;
    const prev = state;
    state = { ...state, ...next };              // неизменяемое обновление
    for (const l of [...listeners]) l(state, prev);
  };
  return {
    getState: () => state,
    setState,
    subscribe(listener: (s: S, prev: S) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
{
  const scenario = (store: { getState(): { n: number; name: string }; setState: Setter<{ n: number; name: string }>; subscribe(l: (s: any, p: any) => void): () => void }) => {
    const seen: string[] = [];
    const unsub = store.subscribe((s, prev) => seen.push(`${prev.n}→${s.n}:${s.name}`));
    store.setState({ n: 1 });
    store.setState((s) => ({ n: s.n + 1 }));    // функциональное обновление
    unsub();
    store.setState({ n: 99 });
    return { seen, name: store.getState().name };
  };
  const ours = scenario(createStore({ n: 0, name: 'Анна' }));
  const zustand = scenario(zustandStore<{ n: number; name: string }>()(() => ({ n: 0, name: 'Анна' })));
  assert.deepEqual(ours, zustand);              // то же поведение, что у zustand/vanilla
  assert.deepEqual(ours.seen, ['0→1:Анна', '1→2:Анна']); // частичное обновление сохраняет остальные поля
}

// ===================== подключение к React через useSyncExternalStore =====================
async function main() {
  const store = createStore({ count: 0, user: { name: 'Анна' } });
  function useStore<T>(selector: (s: ReturnType<typeof store.getState>) => T): T {
    return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
  }
  let renders = 0;
  function Counter() { const count = useStore((s) => s.count); renders++; return <p>счёт: {count}</p>; }
  render(<Counter />);
  act(() => store.setState({ count: 1 }));
  assert.equal(screen.getByText(/счёт/).textContent, 'счёт: 1');
  const before = renders;
  act(() => store.setState({ user: { name: 'Борис' } }));  // изменилось другое поле
  assert.equal(renders, before);                // селектор вернул то же число — перерисовки нет
  cleanup();

  // селектор, создающий новый объект на каждый вызов, — нестабильный снимок
  errors.length = 0;
  function Broken() { const v = useStore((s) => ({ count: s.count })); return <p>{v.count}</p>; }
  let thrown = '';
  try { render(<Broken />); } catch (e: any) { thrown = e.message; }
  assert.match(errors.join(' ') + thrown, /getSnapshot should be cached|Maximum update depth exceeded/);
  cleanup();

  assert.equal(typeof require('zustand/react/shallow').useShallow, 'function'); // useShallow для составных снимков
  console.log('caching ok');
}
main().catch((e) => { process.stdout.write(String(e?.stack ?? e) + '\n'); process.exit(1); });
