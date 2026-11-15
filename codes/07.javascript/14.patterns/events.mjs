// Глава 7.14 — EventEmitter: on/off/once, отписка во время emit не пропускает соседа, ошибка слушателя;
// middleware по схеме «луковицы».
// run: node events.mjs
import assert from 'node:assert/strict';

class Emitter {
  #handlers = new Map();
  on(event, fn) { (this.#handlers.get(event) ?? this.#handlers.set(event, []).get(event)).push(fn); return () => this.off(event, fn); }
  off(event, fn) { const list = this.#handlers.get(event); if (list) this.#handlers.set(event, list.filter((h) => h !== fn)); }
  once(event, fn) { const off = this.on(event, (...args) => { off(); fn(...args); }); return off; }
  emit(event, ...args) { for (const fn of [...(this.#handlers.get(event) ?? [])]) fn(...args); }
}

const bus = new Emitter();
const log = [];
const unsubscribe = bus.on('cart:add', (item) => log.push(`бейдж ${item}`));
bus.once('cart:add', (item) => log.push(`подсказка ${item}`));
bus.on('cart:add', (item) => log.push(`аналитика ${item}`));
bus.emit('cart:add', 'чай');
bus.emit('cart:add', 'кофе');
unsubscribe();
bus.emit('cart:add', 'сахар');
assert.deepEqual(log, ['бейдж чай', 'подсказка чай', 'аналитика чай', 'бейдж кофе', 'аналитика кофе', 'аналитика сахар']);

// наивный emit по «живому» массиву пропускает слушателя после отписавшегося
const naive = { list: [], emit() { for (let i = 0; i < this.list.length; i++) this.list[i](); } };
const seen = [];
const selfRemoving = () => { seen.push('once'); naive.list.splice(naive.list.indexOf(selfRemoving), 1); };
naive.list.push(selfRemoving, () => seen.push('следующий'));
naive.emit();
assert.deepEqual(seen, ['once']);                   // «следующий» пропущен

// middleware «луковица»: до next — по порядку, после — в обратном
function composeMiddleware(middlewares) {
  return (ctx) => {
    const dispatch = (i) => (i < middlewares.length ? Promise.resolve(middlewares[i](ctx, () => dispatch(i + 1))) : Promise.resolve());
    return dispatch(0);
  };
}
const trace = [];
const run = composeMiddleware([
  async (ctx, next) => { trace.push('auth in'); ctx.token = 'abc'; await next(); trace.push('auth out'); },
  async (ctx, next) => { trace.push('log in'); const t = Date.now(); await next(); ctx.ms = Date.now() - t; trace.push('log out'); },
  async (ctx) => { trace.push(`request with ${ctx.token}`); ctx.status = 200; },
]);
const ctx = {};
await run(ctx);
assert.deepEqual(trace, ['auth in', 'log in', 'request with abc', 'log out', 'auth out']);
assert.equal(ctx.status, 200);
// Node EventEmitter: emit('error') без подписчика бросает; EventTarget вызывает всех слушателей, даже если один упал
const { EventEmitter } = await import('node:events');
assert.throws(() => new EventEmitter().emit('error', new Error('нет подписчика')), /нет подписчика/);
const target = new EventTarget();
const called = [];
target.addEventListener('x', () => { throw new Error('слушатель упал'); });
target.addEventListener('x', () => called.push('второй вызван'));
const reported = [];
process.once('uncaughtException', (e) => reported.push(e.message));
target.dispatchEvent(new Event('x'));
await new Promise((r) => setTimeout(r, 10));
assert.deepEqual(called, ['второй вызван']);
assert.deepEqual(reported, ['слушатель упал']);
console.log('ok');
