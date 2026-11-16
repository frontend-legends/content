// Проверки к 1.04: статическая типизация. TypeScript находит ошибку до запуска; после стирания типов
// тот же код выполнился бы. Ожидаемые ошибки — строки с @ts-expect-error.
// types-only
// Запуск: cd codes && node run.mjs 01.computer-science/4.languages-and-compilers

let count = 5;
// @ts-expect-error — тип выведен из значения: number
count = 'пять';

function total(price: number, qty: number): number {
  return price * qty;
}
// @ts-expect-error — строка вместо числа
total('5', 2);

export { count, total };
