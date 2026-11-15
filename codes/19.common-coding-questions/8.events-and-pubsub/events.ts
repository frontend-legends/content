// Проверки к 19.08: EventEmitter, pub/sub, observable и мини-стор — каждый сверен с эталоном на краевых
// случаях: node:events (снимок слушателей при emit, off для once-слушателя, дубли подписок), EventTarget
// (дубли отсекаются), настоящий Redux (подписка во время dispatch, dispatch из редьюсера). Плюс: once,
// отписывающийся после вызова, уходит в рекурсию; observable с === повторно уведомляет о NaN.
import assert from 'node:assert/strict';
import { EventEmitter as NodeEmitter } from 'node:events';
import { legacy_createStore } from 'redux';

type Listener = ((...args: any[]) => void) & { listener?: Listener };

class EventEmitter {
  private events = new Map<string, Set<Listener>>();
  on(event: string, listener: Listener): this {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(listener);
    return this;                                           // чейнинг
  }
  off(event: string, listener: Listener): this {
    const set = this.events.get(event);
    if (!set) return this;
    for (const l of set) if (l === listener || l.listener === listener) { set.delete(l); break; } // и обёртка once
    return this;
  }
  emit(event: string, ...args: unknown[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.size === 0) return false;
    for (const l of [...listeners]) l.apply(this, args);  // снимок: изменения во время emit не влияют на этот emit
    return true;
  }
  once(event: string, listener: Listener): this {
    const wrapper: Listener = (...args) => {
      this.off(event, wrapper);                            // отписка ДО вызова
      listener.apply(this, args);
    };
    wrapper.listener = listener;                           // чтобы off(event, listener) нашёл обёртку
    return this.on(event, wrapper);
  }
}

// одинаковый сценарий для своей реализации и для node:events
const scenario = (make: () => { on: Function; off: Function; emit: Function; once: Function }) => {
  const log: string[] = [];
  const e = make();
  const b = () => log.push('b');
  e.on('x', () => { log.push('a'); e.off('x', b); e.on('x', () => log.push('new')); });
  e.on('x', b);
  e.emit('x');                                             // b снят во время emit, new добавлен во время emit
  const first = [...log];
  log.length = 0;
  e.emit('x');
  return { first, second: [...log] };
};
assert.deepEqual(scenario(() => new EventEmitter()), scenario(() => new NodeEmitter()));
assert.deepEqual(scenario(() => new EventEmitter()).first, ['a', 'b']); // снимок: снятый b ещё вызван, new — нет
{
  const e = new EventEmitter();
  let calls = 0;
  const handler = () => calls++;
  e.once('ready', handler);
  e.off('ready', handler);                                 // снимаем по оригиналу
  e.emit('ready');
  assert.equal(calls, 0);                                  // как в node:events
  e.once('ready', handler);
  e.emit('ready'); e.emit('ready');
  assert.equal(calls, 1);                                  // once — ровно один раз
  assert.equal(e.emit('нет-слушателей'), false);
  assert.ok(e.on('a', () => {}).on('b', () => {}) instanceof EventEmitter); // чейнинг
}
// дубли подписок: Set отсекает, как EventTarget; node:events — нет
{
  let ours = 0, node = 0, dom = 0;
  const a = () => ours++, b = () => node++, c = () => dom++;
  const e = new EventEmitter(); e.on('x', a); e.on('x', a); e.emit('x');
  const n = new NodeEmitter(); n.on('x', b); n.on('x', b); n.emit('x');
  const t = new EventTarget(); t.addEventListener('x', c); t.addEventListener('x', c); t.dispatchEvent(new Event('x'));
  assert.deepEqual([ours, node, dom], [1, 2, 1]);
}
// 'error' в node:events без слушателя бросает — особое событие
assert.throws(() => new NodeEmitter().emit('error', new Error('без слушателя')), /без слушателя/);

// once, который отписывается ПОСЛЕ вызова: повторный emit внутри обработчика уходит в рекурсию
{
  const e = new EventEmitter();
  let depth = 0;
  const onceAfter = (event: string, listener: Listener) => {
    const wrapper: Listener = (...args) => { listener(...args); e.off(event, wrapper); };
    e.on(event, wrapper);
  };
  onceAfter('save', () => { depth++; if (depth < 50) e.emit('save'); }); // предохранитель вместо переполнения стека
  e.emit('save');
  assert.equal(depth, 50);                                 // обработчик «один раз» сработал 50 раз
  depth = 0;
  e.once('save2', () => { depth++; if (depth < 50) e.emit('save2'); });
  e.emit('save2');
  assert.equal(depth, 1);                                  // с отпиской до вызова — один раз
}

// --- pub/sub с функцией отписки ---
class PubSub {
  private subscribers = new Map<string, Set<Listener>>();
  subscribe(event: string, callback: Listener): () => void {
    if (!this.subscribers.has(event)) this.subscribers.set(event, new Set());
    this.subscribers.get(event)!.add(callback);
    return () => { this.subscribers.get(event)?.delete(callback); }; // повторный вызов безопасен
  }
  publish(event: string, data?: unknown) {
    const subs = this.subscribers.get(event);
    if (subs) for (const cb of [...subs]) cb(data);
  }
}
{
  const bus = new PubSub();
  const got: unknown[] = [];
  const unsub = bus.subscribe('login', (user) => got.push(user));
  bus.publish('login', { name: 'Анна' });
  unsub(); unsub();                                        // идемпотентно
  bus.publish('login', { name: 'Борис' });
  assert.deepEqual(got, [{ name: 'Анна' }]);
  let added = 0;
  bus.subscribe('tick', () => bus.subscribe('tick', () => added++)); // подписка из обработчика
  bus.publish('tick');
  assert.equal(added, 0);                                  // по снимку: новый подписчик не вызван в том же publish
}

// --- observable ---
class Observable<T> {
  private observers = new Set<(value: T) => void>();
  constructor(private value: T) {}
  get(): T { return this.value; }
  set(next: T) {
    if (Object.is(next, this.value)) return;               // не уведомляем, если не изменилось (и NaN — тоже «то же»)
    this.value = next;
    for (const fn of [...this.observers]) fn(next);
  }
  subscribe(fn: (value: T) => void): () => void {
    this.observers.add(fn);
    fn(this.value);                                        // сразу отдаём текущее значение
    return () => { this.observers.delete(fn); };
  }
}
{
  const price = new Observable(100);
  const seen: number[] = [];
  const stop = price.subscribe((v) => seen.push(v));
  price.set(100); price.set(120); stop(); price.set(150);
  assert.deepEqual(seen, [100, 120]);                      // текущее сразу, повтор не уведомляет, после отписки тихо
  const strictEq = { value: NaN, notified: 0, set(next: number) { if (next === this.value) return; this.value = next; this.notified++; } };
  strictEq.set(NaN); strictEq.set(NaN);
  assert.equal(strictEq.notified, 2);                      // с === каждое NaN — «изменение»
  const n = new Observable(NaN); let notified = 0; n.subscribe(() => notified++); n.set(NaN); n.set(NaN);
  assert.equal(notified, 1);                               // с Object.is — только начальное значение
}

// --- мини-стор и сравнение с настоящим Redux ---
function createStore<S, A extends { type: string }>(reducer: (state: S, action: A) => S, initial: S) {
  let state = initial;
  let dispatching = false;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action: A) {
      if (dispatching) throw new Error('Reducers may not dispatch actions.');
      try { dispatching = true; state = reducer(state, action); } finally { dispatching = false; }
      for (const l of [...listeners]) l();                 // снимок подписчиков, как в Redux
      return action;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
type Act = { type: 'inc' | 'nested' };
const runStore = (make: (r: (s: number, a: Act) => number, init: number) => any) => {
  const calls: string[] = [];
  let store: any;
  const reducer = (s = 0, a: Act) => { if (a.type === 'nested') store.dispatch({ type: 'inc' }); return a.type === 'inc' ? s + 1 : s; };
  store = make(reducer, 0);
  store.subscribe(() => { calls.push('первый'); store.subscribe(() => calls.push('добавленный')); });
  const returned = store.dispatch({ type: 'inc' });
  let nestedError = '';
  try { store.dispatch({ type: 'nested' }); } catch (e: any) { nestedError = e.message; }
  return { state: store.getState(), calls, returned, nestedError };
};
const ours = runStore((r, init) => createStore(r, init));
const redux = runStore((r) => legacy_createStore(r as any));
assert.deepEqual(ours, redux);                             // то же поведение, что у Redux
assert.deepEqual(ours.calls, ['первый']);                  // подписчик, добавленный во время dispatch, не вызван в нём
assert.equal(ours.nestedError, 'Reducers may not dispatch actions.');
assert.deepEqual(ours.returned, { type: 'inc' });          // dispatch возвращает action

console.log('events ok');
