// types-only
// Глава 8.01 — структурная типизация, проверка лишних свойств только у свежих литералов, вывод типов,
// `as` не преобразует значение, где TypeScript намеренно нестрогий.
// Проверяется tsc в строгом режиме: каждая строка с @ts-expect-error обязана давать ошибку.

interface Product { id: number; title: string }

// совместимость по форме: имя типа неважно
class Teapot { id = 7; title = 'Чайник'; volume = 1.7 }
const p: Product = new Teapot();

// лишнее свойство в свежем литерале — ошибка, через переменную — нет
// @ts-expect-error — Object literal may only specify known properties
const fresh: Product = { id: 1, title: 'Чай', price: 490 };
const withPrice = { id: 1, title: 'Чай', price: 490 };
const viaVariable: Product = withPrice;

// вывод типов: литерал в const сужается, в let — расширяется
const status = 'paid';          // тип 'paid'
let state = 'paid';             // тип string
const s1: 'paid' = status;
// @ts-expect-error — string не присваивается 'paid'
const s2: 'paid' = state;

// as — только подсказка компилятору; несовместимые типы не пропустит без unknown
const raw: unknown = JSON.parse('{"id":1}');
const asserted = raw as Product;
// @ts-expect-error — Conversion of type 'number' to type 'string' may be a mistake
const wrong = 42 as string;
const forced = 42 as unknown as string;

// намеренная нестрогость: индекс массива — T, а не T | undefined (без noUncheckedIndexedAccess)
const prices: number[] = [];
const first: number = prices[0];

export { p, fresh, viaVariable, s1, s2, asserted, wrong, forced, first };
