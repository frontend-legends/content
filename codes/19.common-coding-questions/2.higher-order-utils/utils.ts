// Проверки к 19.02: реализации из текста (TypeScript, те же сигнатуры) на фейковых таймерах node:test —
// debounce (this, аргументы последнего вызова, leading, cancel), стрелка теряет this, throttle (ведущий и
// хвостовой вызов), curry и ловушка fn.length, memoize и коллизии ключа JSON.stringify, WeakMap-вариант,
// compose/pipe, once.
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createRequire } from 'node:module';
const lodashThrottle: (fn: (...a: any[]) => any, ms: number) => any = createRequire(import.meta.url)('lodash/throttle.js'); // у lodash нет типов в зависимостях

mock.timers.enable({ apis: ['setTimeout', 'Date'] });
const tick = (ms: number) => mock.timers.tick(ms);

// --- debounce ---
function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
{
  const calls: string[] = [];
  const search = debounce((q: string) => calls.push(q), 300);
  search('ч'); tick(100); search('ча'); tick(100); search('чай');
  tick(299);
  assert.deepEqual(calls, []);           // пока идут вызовы чаще 300 мс — тишина
  tick(1);
  assert.deepEqual(calls, ['чай']);      // один вызов, с аргументами последнего
  tick(1000);
  assert.deepEqual(calls, ['чай']);      // и больше ничего
}
// this сохраняется у обычной функции-обёртки…
{
  const obj = { name: 'форма', saved: [] as string[], save: debounce(function (this: any, v: string) { this.saved.push(`${this.name}:${v}`); }, 100) };
  obj.save('черновик');
  tick(100);
  assert.deepEqual(obj.saved, ['форма:черновик']);
}
// …а стрелка берёт this из места объявления — для методов он теряется
function debounceArrow(this: unknown, fn: Function, delay: number) { // без аннотации this TypeScript сам указывает на проблему (TS2683)
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: unknown[]) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
}
{
  let seen: unknown = 'не вызывалась';
  const obj = { save: debounceArrow(function (this: unknown) { seen = this; }, 100) };
  obj.save();
  tick(100);
  assert.equal(seen, undefined);         // this — не obj: стрелка взяла this вызова debounceArrow
}

// расширенная версия: leading и cancel
function debounceEx<T extends (...args: any[]) => any>(fn: T, delay = 300, { leading = false } = {}) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  function debounced(this: unknown, ...args: Parameters<T>) {
    const callNow = leading && !timer;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!leading) fn.apply(this, args);
    }, delay);
    if (callNow) fn.apply(this, args);
  }
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
{
  const calls: number[] = [];
  const click = debounceEx((n: number) => calls.push(n), 300, { leading: true });
  click(1); click(2); click(3);
  assert.deepEqual(calls, [1]);          // leading: первый вызов сразу, остальные в серии гасятся
  tick(300);
  assert.deepEqual(calls, [1]);
  click(4);
  assert.deepEqual(calls, [1, 4]);       // после паузы — снова сразу
}
{
  const calls: number[] = [];
  const save = debounceEx((n: number) => calls.push(n), 300);
  save(1);
  save.cancel();                         // например, при размонтировании компонента
  tick(1000);
  assert.deepEqual(calls, []);           // отложенный вызов отменён
}

// --- throttle ---
// наивный вариант: хвостовой вызов запоминает аргументы того вызова, который его запланировал
function throttleNaive<T extends (...args: any[]) => any>(fn: T, limit = 300) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = limit - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
// исправленный: хвостовой вызов берёт самые свежие аргументы и this
function throttle<T extends (...args: any[]) => any>(fn: T, limit = 300) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = limit - (now - last);
    lastArgs = args;
    lastThis = this;
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
      lastArgs = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        if (lastArgs) { fn.apply(lastThis, lastArgs); lastArgs = null; }
      }, remaining);
    }
  };
}
const scrollRun = (make: typeof throttle) => {
  tick(10_000);                          // чтобы первый вызов не попал в «окно» от нуля часов
  const start = Date.now();
  const calls: { y: number; at: number }[] = [];
  const onScroll = make((y: number) => calls.push({ y, at: Date.now() - start }), 100);
  for (let y = 0; y <= 250; y += 25) { onScroll(y); tick(25); } // 11 событий прокрутки за 275 мс
  for (let i = 0; i < 8; i++) tick(25);  // мелкими шагами: фейковые часы отдают колбэку время конца шага
  return calls;
};
{
  const naive = scrollRun(throttleNaive);
  assert.deepEqual(naive.map((c) => c.at), [0, 100, 200, 300]);
  assert.deepEqual(naive.map((c) => c.y), [0, 25, 100, 200]); // последнее положение 250 потеряно
  const fixed = scrollRun(throttle);
  assert.deepEqual(fixed.map((c) => c.at), [0, 100, 200, 300]); // ведущий сразу, дальше не чаще раза в 100 мс
  assert.deepEqual(fixed.map((c) => c.y), [0, 75, 175, 250]);    // хвост несёт самое свежее значение
  const lodash = scrollRun((fn, ms = 300) => lodashThrottle(fn, ms));
  assert.equal(lodash.at(-1)!.y, 250);                            // lodash тоже доставляет последнее значение
}

// --- curry ---
function curry(fn: (...args: any[]) => any) {
  return function curried(this: unknown, ...args: any[]): any {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...next: any[]) => curried.apply(this, [...args, ...next]);
  };
}
const sum3 = (a: number, b: number, c: number) => a + b + c;
const cs = curry(sum3);
assert.equal(cs(1)(2)(3), 6);
assert.equal(cs(1, 2)(3), 6);
assert.equal(cs(1)(2, 3), 6);
assert.equal(cs(1, 2, 3), 6);
// ловушка: fn.length не считает параметры со значением по умолчанию и rest
const withDefault = (a: number, b = 10) => a + b;
assert.equal(withDefault.length, 1);
assert.equal(curry(withDefault)(1), 11); // каррирование «закончилось» после первого аргумента
const withRest = (...xs: number[]) => xs.length;
assert.equal(withRest.length, 0);        // для rest каррировать по fn.length нельзя — нужна явная арность

// --- memoize ---
function memoize<T extends (...args: any[]) => any>(fn: T, resolver: (...args: Parameters<T>) => string = (...a) => JSON.stringify(a)) {
  const cache = new Map<string, ReturnType<T>>();
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const key = resolver(...args);
    if (cache.has(key)) return cache.get(key)!;
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
{
  let runs = 0;
  const square = memoize((n: number) => { runs++; return n * n; });
  assert.equal(square(4), 16); assert.equal(square(4), 16);
  assert.equal(runs, 1);                 // второй раз — из кеша
}
// JSON.stringify как ключ: разные аргументы дают один ключ
{
  const describe = memoize((x: unknown) => typeof x);
  assert.equal(describe(null), 'object');
  assert.equal(describe(undefined), 'object'); // неверно: [undefined] и [null] сериализуются одинаково — "[null]"
  assert.equal(describe(() => 1), 'object');   // функция тоже превращается в null
  assert.equal(JSON.stringify([undefined]), JSON.stringify([null]));
  // а одинаковые по смыслу объекты с другим порядком ключей — разные ключи, лишний промах
  assert.notEqual(JSON.stringify([{ a: 1, b: 2 }]), JSON.stringify([{ b: 2, a: 1 }]));
}
// для одного аргумента-объекта — WeakMap по ссылке: нет сериализации и нет утечки памяти
function memoizeByObject<A extends object, R>(fn: (a: A) => R) {
  const cache = new WeakMap<A, R>();
  return (a: A): R => { if (!cache.has(a)) cache.set(a, fn(a)); return cache.get(a)!; };
}
{
  let runs = 0;
  const total = memoizeByObject((cart: { items: number[] }) => { runs++; return cart.items.reduce((s, x) => s + x, 0); });
  const cart = { items: [1, 2, 3] };
  assert.equal(total(cart), 6); assert.equal(total(cart), 6);
  assert.equal(runs, 1);
  assert.equal(total({ items: [1, 2, 3] }), 6);
  assert.equal(runs, 2);                 // другой объект — другой ключ, даже если содержимое то же
}

// --- compose и pipe ---
const compose = (...fns: Function[]) => (x: unknown) => fns.reduceRight((acc, fn) => fn(acc), x);
const pipe = (...fns: Function[]) => (x: unknown) => fns.reduce((acc, fn) => fn(acc), x);
const inc = (n: number) => n + 1;
const double = (n: number) => n * 2;
assert.equal(compose(inc, double)(5), 11); // inc(double(5))
assert.equal(pipe(inc, double)(5), 12);    // double(inc(5))
assert.equal(pipe()(7), 7);                // без функций — тождество

// --- once ---
function once<T extends (...args: any[]) => any>(fn: T) {
  let called = false;
  let result: ReturnType<T>;
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (!called) { called = true; result = fn.apply(this, args); }
    return result;
  };
}
{
  let runs = 0;
  const init = once((v: string) => { runs++; return `готово:${v}`; });
  assert.equal(init('a'), 'готово:a');
  assert.equal(init('b'), 'готово:a');   // повторный вызов — прежний результат, аргументы игнорируются
  assert.equal(runs, 1);
}
// флаг ставится до вызова fn: рекурсивный вызов обёртки изнутри fn не выполнит её второй раз
{
  let runs = 0;
  let inner: unknown = 'не вызывалась';
  const init: () => string = once(() => { runs++; inner = init(); return 'готово'; });
  assert.equal(init(), 'готово');
  assert.equal(runs, 1);
  assert.equal(inner, undefined);        // внутренний вызов вернул ещё не сохранённый результат
}

mock.timers.reset();
console.log('utils ok');
