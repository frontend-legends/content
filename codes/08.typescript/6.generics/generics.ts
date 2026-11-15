// Глава 8.06 — дженерики: вывод, ограничения, значения по умолчанию, const-параметры, NoInfer,
// частичный вывод, ошибка «could be instantiated with a different subtype», вариантность.
import assert from 'node:assert/strict';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
function expectType<T>(_v: T) { return <U>(ok: Equal<T, U>) => ok; }

// --- зачем: связь входа и выхода
function firstAny(arr: any[]) { return arr[0]; }
expectType(firstAny([1]))<any>(true);
function first<T>(arr: T[]): T | undefined { return arr[0]; }
expectType(first([1, 2]))<number | undefined>(true);
expectType(first(['a']))<string | undefined>(true);

// --- вывод из нескольких мест: кандидаты объединяются в лучший общий тип или ошибка
function pair<T>(a: T, b: T): [T, T] { return [a, b]; }
// @ts-expect-error — Argument of type 'string' is not assignable to parameter of type 'number'
pair(1, 'a');
expectType(pair<number | string>(1, 'a'))<[string | number, string | number]>(true);

// --- ограничение и keyof
function getLength<T extends { length: number }>(v: T) { return v.length; }
assert.equal(getLength('abc'), 3);
// @ts-expect-error — number не имеет length
getLength(42);

function prop<T, K extends keyof T>(obj: T, key: K): T[K] { return obj[key]; }
const user = { name: 'Аня', age: 30 };
expectType(prop(user, 'age'))<number>(true);
// @ts-expect-error — 'email' нет среди ключей
prop(user, 'email');

// --- значение по умолчанию: работает, когда вывести не из чего
type ApiResponse<T = unknown> = { data: T; status: number };
const r: ApiResponse = { data: 1, status: 200 };
expectType(r.data)<unknown>(true);
function makeStore<T = string>(initial?: T) { return { value: initial as T }; }
expectType(makeStore().value)<string>(true);
expectType(makeStore(5).value)<number>(true);

// --- частичного вывода нет: указал один параметр — указывай все (или есть default)
function request<TBody, TResult>(body: TBody): TResult { return body as unknown as TResult; }
// @ts-expect-error — Expected 2 type arguments, but got 1
request<{ id: number }>({ id: 1 });
// обход — каррирование
const requestFor = <TResult,>() => <TBody,>(body: TBody): TResult => body as unknown as TResult;
const res = requestFor<{ ok: boolean }>()({ id: 1 });
expectType(res)<{ ok: boolean }>(true);

// --- const-параметры (TS 5.0)
function routes<T extends string[]>(paths: T) { return paths; }
expectType(routes(['/', '/about']))<string[]>(true);
function routesConst<const T extends readonly string[]>(paths: T) { return paths; }
expectType(routesConst(['/', '/about']))<readonly ['/', '/about']>(true);
// с изменяемым ограничением выводится изменяемый кортеж (TS 5.3+)
function routesMutable<const T extends string[]>(paths: T) { return paths; }
expectType(routesMutable(['/', '/about']))<['/', '/about']>(true);
// const действует только на литерал в месте вызова: переменная уже расширена
const paths = ['/', '/about'];
expectType(routesConst(paths))<string[]>(true);
function defineConfig<const T>(c: T) { return c; }
expectType(defineConfig({ mode: 'production' }))<{ readonly mode: 'production' }>(true);

// --- NoInfer (TS 5.4)
function createLight<C extends string>(colors: C[], initial: C) { return { colors, initial }; }
expectType(createLight(['red', 'green'], 'blue').initial)<'red' | 'green' | 'blue'>(true);   // blue расширил C
function createLightSafe<C extends string>(colors: C[], initial: NoInfer<C>) { return { colors, initial }; }
// @ts-expect-error — Argument of type '"blue"' is not assignable to parameter of type '"red" | "green"'
createLightSafe(['red', 'green'], 'blue');
assert.equal(createLightSafe(['red', 'green'], 'red').initial, 'red');

// --- вернуть «какой-то» объект вместо T нельзя
function withDefaults<T extends { retries: number }>(opts: T): T {
  // @ts-expect-error — '{ retries: number; }' is assignable to the constraint of type 'T', but 'T' could be instantiated with a different subtype
  return { retries: 3 };
}
void withDefaults;
function withDefaultsOk<T extends { retries: number }>(opts: T): T {
  return { ...opts, retries: opts.retries || 3 };
}
const o = withDefaultsOk({ retries: 0, url: '/api' });
expectType(o)<{ retries: number; url: string }>(true);
assert.deepEqual(o, { retries: 3, url: '/api' });

// --- типобезопасный emitter
type Events = { add: { id: number; qty: number }; clear: void };
function createEmitter<E extends Record<string, unknown>>() {
  const handlers: { [K in keyof E]?: Array<(p: E[K]) => void> } = {};
  return {
    on<K extends keyof E>(event: K, fn: (payload: E[K]) => void) {
      (handlers[event] ??= []).push(fn);
    },
    emit<K extends keyof E>(event: K, payload: E[K]) {
      handlers[event]?.forEach((fn) => fn(payload));
    },
  };
}
const bus = createEmitter<Events>();
const log: number[] = [];
bus.on('add', (p) => log.push(p.qty));
bus.emit('add', { id: 1, qty: 2 });
assert.deepEqual(log, [2]);
// @ts-expect-error — неверный payload
bus.emit('add', { id: 1 });
// @ts-expect-error — нет такого события
bus.on('remove', () => {});

// --- вариантность
type Animal = { name: string };
type Dog = Animal & { bark(): void };
// ковариантность возвращаемого значения
const getDog: () => Dog = () => ({ name: 'Рекс', bark() {} });
const getAnimal: () => Animal = getDog;   // ок
void getAnimal;
// контравариантность параметров (strictFunctionTypes)
const handleAnimal = (a: Animal) => a.name;
const handleDog: (d: Dog) => string = handleAnimal;   // ок: умеет больше
void handleDog;
const onlyDog = (d: Dog) => { d.bark(); };
// @ts-expect-error — функция для Dog не подходит туда, где придёт любой Animal
const forAnimal: (a: Animal) => void = onlyDog;
void forAnimal;
// методы бивариантны даже под strict — дыра
type WithMethod = { handle(a: Animal): void };
const m: WithMethod = { handle: onlyDog };   // компилируется
assert.throws(() => m.handle({ name: 'кот' }), TypeError);
// массивы ковариантны — тоже дыра
const dogs: Dog[] = [];
const animals: Animal[] = dogs;
animals.push({ name: 'кот' });
assert.throws(() => dogs[0].bark(), TypeError);

// явные аннотации вариантности (TS 4.7)
interface Producer<out T> { get(): T }
interface Consumer<in T> { put(v: T): void }
const pd = {} as Producer<Dog>;
const pa: Producer<Animal> = pd;
const ca = {} as Consumer<Animal>;
const cd: Consumer<Dog> = ca;
// @ts-expect-error — Consumer контравариантен
const bad: Consumer<Animal> = {} as Consumer<Dog>;
void pa; void cd; void bad;
