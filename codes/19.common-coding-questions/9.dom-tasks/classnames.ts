// Проверка к 19.09: classNames из текста против настоящего clsx на одинаковых входах — строки, числа,
// объекты, вложенные массивы, falsy-значения. Отличие в одном: унаследованные ключи объекта.
import assert from 'node:assert/strict';
import { clsx } from 'clsx';

type ClassValue = string | number | null | undefined | false | ClassDict | ClassValue[];
interface ClassDict { [key: string]: unknown }

function classNames(...args: ClassValue[]): string {
  const classes: string[] = [];
  for (const arg of args) {
    if (!arg) continue;                                   // falsy пропускаем, включая 0
    if (typeof arg === 'string' || typeof arg === 'number') classes.push(String(arg));
    else if (Array.isArray(arg)) {
      const inner = classNames(...arg);                   // рекурсия для массивов
      if (inner) classes.push(inner);
    } else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) if (arg[key]) classes.push(key); // только собственные ключи
    }
  }
  return classes.join(' ');
}

const cases: ClassValue[][] = [
  ['btn', { active: true, disabled: false }, ['lg', null]],
  ['a', 0, 1, '', undefined, false, 'b'],
  [[['deep', ['deeper']]], { x: 1, y: 0, z: 'да' }],
  [],
  [{}, [], ''],
];
for (const c of cases) assert.equal(classNames(...c), clsx(...(c as any[])));
assert.equal(classNames('btn', { active: true, disabled: false }, ['lg', null]), 'btn active lg');
assert.equal(classNames('a', 0, 1), 'a 1');               // 0 — falsy и пропущен, 1 — класс '1'

// унаследованные ключи: clsx перебирает for...in, наш — Object.keys
const withProto = Object.create({ inherited: true });
withProto.own = true;
assert.equal(classNames(withProto), 'own');
assert.equal(clsx(withProto), 'own inherited');

console.log('classnames ok');
