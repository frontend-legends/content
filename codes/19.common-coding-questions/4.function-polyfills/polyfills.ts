// Проверки к 19.04: полифилы call, apply, bind, new, instanceof, Object.create и наследование на прототипах —
// и сравнение с нативным поведением на краевых случаях. Исходные версии из текста ломались: bind под new
// возвращал {} и писал в контекст, new терял функцию из конструктора, instanceof не узнавал функции,
// Object.create(null) оставлял прототип, call падал на примитиве.
import assert from 'node:assert/strict';

declare global {
  interface Function {
    myCall(context: unknown, ...args: unknown[]): unknown;
    myApply(context: unknown, args?: unknown[]): unknown;
    myBind(context: unknown, ...bound: unknown[]): any;
  }
}

// --- call и apply ---
Function.prototype.myCall = function (context: any, ...args: unknown[]) {
  context = context == null ? globalThis : Object(context); // примитив — в объект-обёртку
  const key = Symbol('fn');                                   // уникальный ключ — не затрёт свойство
  context[key] = this;                                        // this здесь — вызываемая функция
  try {
    return context[key](...args);                             // вызов как метода: this внутри = context
  } finally {
    delete context[key];                                      // убираем за собой даже при ошибке
  }
};
Function.prototype.myApply = function (context: unknown, args: unknown[] = []) {
  return this.myCall(context, ...args);
};

function greet(this: { name: string }, greeting: string, mark = '!') { return `${greeting}, ${this.name}${mark}`; }
const anna = { name: 'Анна' };
assert.equal(greet.myCall(anna, 'Привет'), 'Привет, Анна!');
assert.equal(greet.myApply(anna, ['Здравствуй', '.']), 'Здравствуй, Анна.');
assert.deepEqual(Object.getOwnPropertySymbols(anna), []);       // временное свойство удалено
function kind(this: unknown) { return typeof this; }
assert.equal(kind.myCall('строка'), 'object');                  // полифил оборачивает примитив…
assert.equal(kind.call('строка'), 'string');                    // …нативный call в strict-режиме передаёт его как есть
assert.throws(() => kind.myCall(Object.freeze({})), TypeError);  // в замороженный объект свойство не добавить
assert.equal(kind.call(Object.freeze({})), 'object');            // нативному это не нужно
assert.equal(Math.max.myApply(null, [1, 5, 3]), 5);

// --- bind ---
// исходная версия: проверка this instanceof fn не срабатывает, потому что прототип связанной функции не связан с fn
Function.prototype.myBind = function (context: unknown, ...bound: unknown[]) {
  const fn = this;
  return function (this: unknown, ...args: unknown[]) {
    const isNew = this instanceof fn;
    return fn.apply(isNew ? this : context, [...bound, ...args]);
  };
};
function Person(this: { name: string }, name: string) { this.name = name; }
{
  const ctx: any = { tag: 'ctx' };
  const Bound = Person.myBind(ctx, 'Анна');
  const made = new Bound();
  assert.deepEqual({ ...made }, {});                             // экземпляр пустой
  assert.equal(made instanceof Person, false);
  assert.equal(ctx.name, 'Анна');                                // имя записалось в привязанный контекст
}
// исправленная: new.target отличает вызов через new, а прототип ведёт к fn.prototype
Function.prototype.myBind = function (context: unknown, ...bound: unknown[]) {
  const fn = this;
  function boundFn(this: unknown, ...args: unknown[]) {
    const isNew = new.target !== undefined;
    return fn.apply(isNew ? this : context, [...bound, ...args]);
  }
  if (fn.prototype) boundFn.prototype = Object.create(fn.prototype);
  return boundFn;
};
{
  const ctx: any = { tag: 'ctx' };
  const Bound = Person.myBind(ctx, 'Анна');
  const made = new Bound();
  assert.equal(made.name, 'Анна');
  assert.equal(made instanceof Person, true);                    // как у нативного bind
  assert.equal(ctx.name, undefined);                             // контекст при new игнорируется
  const native = new (Person.bind(ctx, 'Анна') as any)();
  assert.equal(native instanceof Person, true);
  assert.equal(native.name, 'Анна');
  // обычный вызов и частичное применение
  const hi = greet.myBind(anna, 'Привет');
  assert.equal(hi('?'), 'Привет, Анна?');
  assert.equal(hi.call({ name: 'Борис' }, '?'), 'Привет, Анна?');  // привязанный this не перебить call
}

// --- new ---
function myNew(Constructor: Function, ...args: unknown[]) {
  const obj = Object.create(Constructor.prototype);              // 1–2: объект с нужным прототипом
  const result = Constructor.apply(obj, args);                   // 3: конструктор с this = obj
  const isObject = (result !== null && typeof result === 'object') || typeof result === 'function';
  return isObject ? result : obj;                                // 4: вернул объект — он, иначе наш obj
}
{
  const p = myNew(Person, 'Анна');
  assert.equal(p.name, 'Анна');
  assert.equal(p instanceof Person, true);
  function Factory() { return function inner() {}; }
  assert.equal(typeof myNew(Factory), 'function');               // функция — тоже объект, её возвращают
  assert.equal(typeof new (Factory as any)(), 'function');       // как и нативный new
  function ReturnsPrimitive(this: any) { this.ok = true; return 42; }
  assert.equal(myNew(ReturnsPrimitive).ok, true);                // примитив игнорируется
}

// --- instanceof ---
function myInstanceof(obj: unknown, Constructor: Function): boolean {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  let proto = Object.getPrototypeOf(obj);
  const target = Constructor.prototype;
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
assert.equal(myInstanceof(new (Person as any)('a'), Person), true);
assert.equal(myInstanceof(new (Person as any)('a'), Object), true);      // Object.prototype в конце любой цепочки
assert.equal(myInstanceof([], Array), true);
assert.equal(myInstanceof(() => {}, Function), true);            // исходная версия давала false для функций
assert.equal(myInstanceof('строка', String), false);             // как и нативный instanceof для примитива
assert.equal(myInstanceof(Object.create(null), Object), false);
class Even { static [Symbol.hasInstance](n: unknown) { return typeof n === 'number' && n % 2 === 0; } }
assert.equal((4 as unknown) instanceof Even, true);              // нативный instanceof сначала спрашивает Symbol.hasInstance
assert.equal(myInstanceof(4, Even), false);                      // полифил по цепочке прототипов этого не видит

// --- Object.create и наследование на прототипах ---
function myObjectCreate(proto: object | null) {
  function F() {}
  F.prototype = proto as object;
  return new (F as any)();
}
const base = { hello() { return 'привет'; } };
assert.equal(myObjectCreate(base).hello(), 'привет');
assert.notEqual(Object.getPrototypeOf(myObjectCreate(null)), null); // с null трюк не работает: new берёт Object.prototype
assert.equal(Object.getPrototypeOf(Object.create(null)), null);       // для null нужен нативный Object.create

function Animal(this: any, name: string) { this.name = name; }
Animal.prototype.speak = function () { return `${this.name} издаёт звук`; };
function Dog(this: any, name: string) { Animal.call(this, name); }  // свойства — вызовом родителя
Dog.prototype = Object.create(Animal.prototype);                     // методы — через прототип
Dog.prototype.constructor = Dog;                                     // чиним constructor
Dog.prototype.speak = function () { return `${Animal.prototype.speak.call(this)}: гав`; };
const rex = new (Dog as any)('Рекс');
assert.equal(rex.speak(), 'Рекс издаёт звук: гав');
assert.equal(rex instanceof Dog && rex instanceof Animal, true);
assert.equal(rex.constructor, Dog);
// то же на классах — сахар над той же цепочкой
class Animal2 { constructor(public name: string) {} speak() { return `${this.name} издаёт звук`; } }
class Dog2 extends Animal2 { speak() { return `${super.speak()}: гав`; } }
assert.equal(new Dog2('Рекс').speak(), rex.speak());
assert.equal(Object.getPrototypeOf(Dog2.prototype), Animal2.prototype);
assert.throws(() => (Dog2 as any)('Рекс'), TypeError);            // класс нельзя вызвать без new, в отличие от функции Dog

console.log('polyfills ok');
