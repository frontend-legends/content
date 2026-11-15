// types-only
// Глава 8.03 — функции: перегрузки (реализация не видна снаружи), void в колбэках,
// бивариантность методов против свойств-функций, параметр this.

// перегрузки: снаружи видны только сигнатуры, порядок важен
function parsePrice(input: string): number;
function parsePrice(input: number, currency: 'RUB' | 'USD'): string;
function parsePrice(input: string | number, currency?: 'RUB' | 'USD'): number | string {
  return typeof input === 'string' ? Number(input) : `${input} ${currency}`;
}
const n: number = parsePrice('490');
const s: string = parsePrice(490, 'RUB');
// @ts-expect-error — сигнатура реализации снаружи не видна: string + валюта не описаны
parsePrice('490', 'RUB');

// void в типе колбэка разрешает вернуть значение; void в объявлении функции — нет
const log: string[] = [];
const cb: () => void = () => log.push('x');          // push возвращает number — ок
[1, 2].forEach((x) => log.push(String(x)));
function done(): void {
  // @ts-expect-error — функция, объявленная с void, не может вернуть число
  return 42;
}

// бивариантность: метод принимает обработчик с более узким параметром, свойство-функция — нет
type Base = { type: string };
type Click = { type: string; x: number };
interface WithMethod { handle(e: Base): void }
interface WithProperty { handle: (e: Base) => void }
const m: WithMethod = { handle(e: Click) { void e.x; } };
// @ts-expect-error — свойство-функция проверяется строго (strictFunctionTypes)
const p: WithProperty = { handle: (e: Click) => { void e.x; } };

// параметр this
function onClick(this: { label: string }, e: Base) { return `${this.label}: ${e.type}`; }
const button = { label: 'Купить', onClick };
button.onClick({ type: 'click' });
// @ts-expect-error — вызов без нужного this
onClick({ type: 'click' });

export { n, s, cb, done, m, p };
