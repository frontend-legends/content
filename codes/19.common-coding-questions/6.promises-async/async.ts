// Проверки к 19.06: комбинаторы промисов руками, сверенные с нативными (порядок, не-промисы, пустой вход,
// любые итерируемые), promisify, retry с экспоненциальной задержкой, mapLimit (в полёте не больше limit),
// последовательная очередь. Исходные версии ломались: any([]) и all(new Set) висели вечно, а очередь
// после упавшей задачи застревала навсегда. Порядок задаётся вручную через deferred — без гонок по таймерам.
import assert from 'node:assert/strict';

async function main() {
const deferred = <T>() => {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const state = async (p: Promise<unknown>) => {
  const mark = Symbol('pending');
  const r = await Promise.race([p.then((v) => ({ v }), (e) => ({ e })), flush().then(() => mark)]);
  return r === mark ? 'pending' : r;
};

// --- Promise.all ---
function promiseAll<T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  const items = Array.from(iterable);                 // любой итерируемый, как нативный
  return new Promise((resolve, reject) => {
    const results: Awaited<T>[] = new Array(items.length);
    let completed = 0;
    if (items.length === 0) return resolve([]);
    items.forEach((p, index) => {
      Promise.resolve(p).then((value) => {
        results[index] = value as Awaited<T>;           // по индексу — исходный порядок
        if (++completed === items.length) resolve(results);
      }, reject);                                       // первая ошибка — сразу reject
    });
  });
}
{
  const a = deferred<string>(), b = deferred<string>();
  const all = promiseAll([a.promise, b.promise, 'не промис']);
  b.resolve('второй'); a.resolve('первый');           // завершились в обратном порядке
  assert.deepEqual(await all, ['первый', 'второй', 'не промис']);
  assert.deepEqual(await promiseAll([]), []);
  assert.deepEqual(await promiseAll(new Set([1, 2])), await Promise.all(new Set([1, 2]))); // [1, 2]
  const c = deferred<number>(), d = deferred<number>();
  const failing = promiseAll([c.promise, d.promise]);
  d.reject(new Error('упал второй'));
  await assert.rejects(failing, /упал второй/);       // не дожидаясь первого
}

// --- Promise.allSettled ---
function promiseAllSettled<T>(iterable: Iterable<T | PromiseLike<T>>) {
  return promiseAll(Array.from(iterable, (p) => Promise.resolve(p).then(
    (value) => ({ status: 'fulfilled' as const, value }),
    (reason) => ({ status: 'rejected' as const, reason }),
  )));
}
{
  const input = () => [Promise.resolve(1), Promise.reject('ошибка'), 3];
  assert.deepEqual(await promiseAllSettled(input()), await Promise.allSettled(input())); // та же форма, что у нативного
}

// --- Promise.race и Promise.any ---
function promiseRace<T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    for (const p of iterable) Promise.resolve(p).then(resolve, reject); // кто первый — тот и решает
  });
}
function promiseAny<T>(iterable: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>> {
  const items = Array.from(iterable);
  return new Promise((resolve, reject) => {
    const errors: unknown[] = new Array(items.length);
    let rejected = 0;
    if (items.length === 0) return reject(new AggregateError([], 'All promises were rejected')); // как нативный
    items.forEach((p, i) => {
      Promise.resolve(p).then(resolve, (err) => {
        errors[i] = err;
        if (++rejected === items.length) reject(new AggregateError(errors, 'All promises were rejected'));
      });
    });
  });
}
{
  const a = deferred<string>(), b = deferred<string>();
  const race = promiseRace([a.promise, b.promise]);
  b.reject(new Error('первым завершился с ошибкой'));
  await assert.rejects(race, /первым завершился/);  // race берёт первый исход, даже ошибку
  assert.equal(await state(promiseRace([])), 'pending'); // пустой race висит вечно — и нативный тоже
  assert.equal(await state(Promise.race([])), 'pending');

  const c = deferred<string>(), d = deferred<string>();
  const any = promiseAny([c.promise, d.promise]);
  c.reject(new Error('мимо'));
  d.resolve('успех');
  assert.equal(await any, 'успех');                  // any ждёт первый успешный
  const err = await promiseAny([Promise.reject('a'), Promise.reject('b')]).catch((e) => e);
  assert.ok(err instanceof AggregateError);
  assert.deepEqual(err.errors, ['a', 'b']);          // ошибки в исходном порядке
  const emptyAny = await promiseAny([]).catch((e) => e);
  const nativeEmptyAny = await Promise.any([]).catch((e) => e);
  assert.ok(emptyAny instanceof AggregateError && nativeEmptyAny instanceof AggregateError); // пустой any сразу отклоняется
}

// --- promisify ---
type NodeCallback<T> = (err: unknown, data?: T) => void;
function promisify<A extends unknown[], T>(fn: (...args: [...A, NodeCallback<T>]) => void) {
  return function (this: unknown, ...args: A): Promise<T> {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err: unknown, data?: T) => {
        if (err != null) reject(err);                 // null и undefined — успех; любой другой err — ошибка
        else resolve(data as T);
      });
    });
  };
}
{
  const readUser = (id: number, cb: NodeCallback<{ id: number }>) => setTimeout(() => (id > 0 ? cb(null, { id }) : cb(new Error('нет такого'))), 1);
  const readUserAsync = promisify(readUser);
  assert.deepEqual(await readUserAsync(7), { id: 7 });
  await assert.rejects(readUserAsync(-1), /нет такого/);
  const store = { prefix: 'u:', get(this: { prefix: string }, key: string, cb: NodeCallback<string>) { cb(null, this.prefix + key); } };
  assert.equal(await promisify(store.get).call(store, 'anna'), 'u:anna'); // this сохраняется через call
  const failsWithZero = (cb: NodeCallback<string>) => cb(0);
  await assert.rejects(promisify(failsWithZero)(), (e) => e === 0); // «ложная» ошибка 0 — всё равно ошибка; if (err) её бы пропустил
}

// --- sleep и retry ---
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500, waits: number[] = []): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    waits.push(delay);
    await sleep(delay);
    return retry(fn, retries - 1, delay * 2, waits);  // экспоненциальная задержка
  }
}
{
  let attempts = 0;
  const waits: number[] = [];
  const flaky = async () => { attempts++; if (attempts < 3) throw new Error(`сбой ${attempts}`); return 'ок'; };
  assert.equal(await retry(flaky, 3, 1, waits), 'ок');
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [1, 2]);                   // паузы растут вдвое
  attempts = 0;
  const alwaysFails = async () => { attempts++; throw new Error(`сбой ${attempts}`); };
  await assert.rejects(retry(alwaysFails, 3, 1), /сбой 4/); // retries = 3 — это 4 попытки, наружу последняя ошибка
  assert.equal(attempts, 4);
}

// --- mapLimit: не больше limit задач одновременно ---
async function mapLimit<T, U>(items: T[], limit: number, fn: (item: T) => Promise<U>): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;                       // синхронно: между чтением и инкрементом нет await
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
{
  let inFlight = 0, maxInFlight = 0;
  const started: number[] = [];
  const task = async (n: number) => {
    started.push(n);
    inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
    await sleep(n % 3 === 0 ? 5 : 1);              // разная длительность — задачи завершаются вперемешку
    inFlight--;
    return n * 10;
  };
  const result = await mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 3, task);
  assert.deepEqual(result, [10, 20, 30, 40, 50, 60, 70, 80]); // порядок результатов — исходный
  assert.equal(maxInFlight, 3);                      // одновременно ровно limit
  assert.deepEqual(started.slice(0, 3), [1, 2, 3]);  // первыми стартовали три
  assert.deepEqual(await mapLimit([], 3, task), []);
}

// --- очередь: задачи строго по одной ---
class AsyncQueue {
  private queue: Array<() => Promise<void>> = [];
  private running = false;
  errors: unknown[] = [];
  add(task: () => Promise<void>) {
    this.queue.push(task);
    void this.run();
  }
  private async run() {
    if (this.running) return;                        // уже крутится — второй цикл не запускаем
    this.running = true;
    try {
      while (this.queue.length) {
        const task = this.queue.shift()!;
        try { await task(); } catch (e) { this.errors.push(e); } // упавшая задача не останавливает очередь
      }
    } finally {
      this.running = false;
    }
  }
}
{
  const q = new AsyncQueue();
  const log: string[] = [];
  q.add(async () => { log.push('A start'); await sleep(5); log.push('A end'); });
  q.add(async () => { throw new Error('B упала'); });
  q.add(async () => { log.push('C start'); await sleep(1); log.push('C end'); });
  await sleep(30);
  assert.deepEqual(log, ['A start', 'A end', 'C start', 'C end']); // строго по очереди, и C выполнилась после ошибки B
  assert.equal(q.errors.length, 1);
}

  console.log('async ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
