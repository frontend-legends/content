// Проверки к 1.11: система типов TypeScript вычисляет рекурсией, и у этой рекурсии есть предел —
// компилятор останавливает слишком глубокое вычисление ошибкой TS2589 вместо того, чтобы зависнуть.
// types-only
// Запуск: cd codes && node run.mjs 01.computer-science/11.theory-of-computation

// кортеж длины N — вычисление на уровне типов
type Tuple<N extends number, A extends unknown[] = []> = A['length'] extends N ? A : Tuple<N, [...A, unknown]>;
type Add<X extends number, Y extends number> = [...Tuple<X>, ...Tuple<Y>]['length'];

const five: Add<2, 3> = 5;
// @ts-expect-error — 2 + 3 не 6
const six: Add<2, 3> = 6;

// @ts-expect-error — TS2589: Type instantiation is excessively deep and possibly infinite
type Huge = Tuple<5000>;

export { five, six };
export type { Huge };
