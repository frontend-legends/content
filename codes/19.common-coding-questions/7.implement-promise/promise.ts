// Проверки к 19.07: свой Promise с процедурой разрешения по Promises/A+ прогоняется официальным набором
// тестов promises-aplus-tests (872 теста). Плюс: исходная версия из текста ломала цепочки — колбэк, вернувший
// промис, отдавал дальше функцию; порядок «синхронно → микрозадачи → макрозадачи»; работа с await и с
// нативными промисами; finally ждёт промис из колбэка, как нативный.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

type State = 'pending' | 'fulfilled' | 'rejected';
type Executor<T> = (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void;

class MyPromise<T> {
  private state: State = 'pending';
  private value: any;
  private handlers: Array<() => void> = [];

  constructor(executor: Executor<T>) {
    let called = false;                                   // учитывается только первый вызов resolve/reject
    const resolve = (value: T | PromiseLike<T>) => { if (!called) { called = true; this.resolveWith(value); } };
    const reject = (reason?: unknown) => { if (!called) { called = true; this.settle('rejected', reason); } };
    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);                                        // ошибка в executor — reject
    }
  }

  private settle(state: State, value: unknown) {
    if (this.state !== 'pending') return;                 // переход только один раз
    this.state = state;
    this.value = value;
    this.handlers.forEach((h) => h());
    this.handlers = [];
  }

  // процедура разрешения (Promises/A+, 2.3): «принять» состояние любого thenable
  private resolveWith(x: any) {
    if (x === this) return this.settle('rejected', new TypeError('Chaining cycle detected for promise'));
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let then: unknown;
      try { then = x.then; } catch (e) { return this.settle('rejected', e); } // геттер then может бросить
      if (typeof then === 'function') {
        let called = false;                               // thenable может вызвать оба колбэка — берём первый
        try {
          then.call(x,
            (y: unknown) => { if (!called) { called = true; this.resolveWith(y); } },
            (r: unknown) => { if (!called) { called = true; this.settle('rejected', r); } });
        } catch (e) {
          if (!called) { called = true; this.settle('rejected', e); }
        }
        return;
      }
    }
    this.settle('fulfilled', x);
  }

  then<U = T, V = never>(onFulfilled?: ((value: T) => U | PromiseLike<U>) | null, onRejected?: ((reason: any) => V | PromiseLike<V>) | null): MyPromise<U | V> {
    return new MyPromise<U | V>((resolve, reject) => {
      const run = () => queueMicrotask(() => {           // колбэки всегда асинхронны — в микрозадаче
        const cb = this.state === 'fulfilled' ? onFulfilled : onRejected;
        if (typeof cb !== 'function') {                  // нет обработчика — передать исход дальше
          return this.state === 'fulfilled' ? resolve(this.value) : reject(this.value);
        }
        try {
          resolve(cb(this.value));                       // результат (в том числе промис) разрешает следующий
        } catch (err) {
          reject(err);                                   // ошибка в колбэке — reject следующего
        }
      });
      if (this.state === 'pending') this.handlers.push(run);
      else run();
    });
  }

  catch<V = never>(onRejected: (reason: any) => V | PromiseLike<V>) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally: () => unknown) {
    return this.then(
      (value) => MyPromise.resolve(onFinally()).then(() => value),            // ждём onFinally, отдаём исходное значение
      (reason) => MyPromise.resolve(onFinally()).then(() => { throw reason; }), // и исходную ошибку
    );
  }

  static resolve<T>(value: T | PromiseLike<T>): MyPromise<T> {
    return value instanceof MyPromise ? value : new MyPromise<T>((res) => res(value));
  }

  static reject<T = never>(reason?: unknown): MyPromise<T> {
    return new MyPromise<T>((_, rej) => rej(reason));
  }
}

async function main() {
  // --- исходная версия из текста: resolveValue возвращал функцию вместо значения ---
  {
    const original = <T>(value: T) => ({ then: (fn: (v: T) => unknown) => fn(value) }); // минимальный промис-подобный объект
    const resolveValueOriginal = (value: any) => (value && typeof value.then === 'function' ? value.then.bind(value) : value);
    const next = resolveValueOriginal(original(42));
    assert.equal(typeof next, 'function');               // дальше по цепочке ушла бы функция, а не 42
  }

  // --- цепочки, ошибки, пропуск обработчиков ---
  const chain = await new MyPromise<number>((res) => res(1))
    .then((v) => v + 1)
    .then((v) => new MyPromise<number>((res) => setTimeout(() => res(v * 10), 1))) // колбэк вернул промис — ждём его
    .then((v) => v);
  assert.equal(chain, 20);
  const recovered = await MyPromise.reject<number>(new Error('сбой'))
    .then((v) => v + 1)                                  // нет onRejected — ошибка идёт дальше
    .catch((e) => `поймали: ${e.message}`);
  assert.equal(recovered, 'поймали: сбой');
  const thrown = await new MyPromise((res) => res(1)).then(() => { throw new Error('из колбэка'); }).catch((e) => e.message);
  assert.equal(thrown, 'из колбэка');
  const once = await new MyPromise((res, rej) => { res('первый'); res('второй'); rej(new Error('поздно')); });
  assert.equal(once, 'первый');                          // состояние меняется один раз
  const self: MyPromise<unknown> = new MyPromise((res) => res(1)).then(() => self);
  await assert.rejects(self as unknown as Promise<unknown>, TypeError); // промис не может разрешиться сам собой

  // --- порядок: синхронный код, затем микрозадачи, затем макрозадачи ---
  {
    const log: string[] = [];
    setTimeout(() => log.push('setTimeout'), 0);
    new MyPromise((res) => res(1)).then(() => log.push('MyPromise.then'));
    Promise.resolve().then(() => log.push('Promise.then'));
    log.push('sync');
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(log, ['sync', 'MyPromise.then', 'Promise.then', 'setTimeout']);
    // если колбэки планировать через setTimeout, «then» выполнится после чужой макрозадачи
    const log2: string[] = [];
    setTimeout(() => log2.push('чужой setTimeout'), 0);
    setTimeout(() => log2.push('then через setTimeout'), 0);
    Promise.resolve().then(() => log2.push('нативный then'));
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(log2, ['нативный then', 'чужой setTimeout', 'then через setTimeout']);
  }

  // --- совместимость: await и нативные промисы понимают наш thenable, и наоборот ---
  assert.equal(await new MyPromise<number>((res) => res(5)), 5);
  assert.deepEqual(await Promise.all([new MyPromise<number>((res) => res(1)), 2]), [1, 2]); // нативный all принимает наш thenable
  assert.equal(await MyPromise.resolve(Promise.resolve('из нативного')), 'из нативного');

  // --- finally ждёт промис из колбэка и не меняет исход ---
  {
    const log: string[] = [];
    const value = await MyPromise.resolve('значение').finally(() => new MyPromise((res) => setTimeout(() => { log.push('cleanup'); res(undefined); }, 5)));
    assert.equal(value, 'значение');
    assert.deepEqual(log, ['cleanup']);                  // значение пришло после завершения cleanup
    const err = await MyPromise.reject(new Error('исход')).finally(() => 'игнорируется').catch((e) => e.message);
    assert.equal(err, 'исход');
    const nativeLog: string[] = [];
    await Promise.resolve(1).finally(() => new Promise((r) => setTimeout(() => { nativeLog.push('cleanup'); r(0); }, 5)));
    assert.deepEqual(nativeLog, ['cleanup']);            // нативный finally ведёт себя так же
  }

  // --- официальный набор тестов Promises/A+ ---
  const adapter = {
    resolved: (v: unknown) => MyPromise.resolve(v),
    rejected: (r: unknown) => MyPromise.reject(r),
    deferred: () => {
      let resolve!: (v: unknown) => void, reject!: (r: unknown) => void;
      const promise = new MyPromise((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    },
  };
  const aplus = createRequire(import.meta.url)('promises-aplus-tests');
  const failures: number = await new Promise((resolve) => {
    aplus(adapter, { reporter: function Silent() {}, bail: false } /* тихий репортёр: число провалов приходит в колбэк */, (err: { failures?: number } | null) => resolve(err?.failures ?? (err ? 1 : 0)));
  });
  assert.equal(failures, 0);                              // все тесты спецификации прошли
  console.log('promise ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
