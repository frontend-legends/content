// Проверки к 1.08: алгебраические типы в TypeScript. Тип-произведение — объект, тип-сумма — размеченное
// объединение; проверка полноты через never ломает сборку, если забыть вариант.
// Запуск: cd codes && node run.mjs 01.computer-science/8.fp
import assert from 'node:assert/strict';

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type Payment =
  | { kind: 'card'; last4: string }
  | { kind: 'sbp'; phone: string }
  | { kind: 'cash' };

function describe(p: Payment): string {
  switch (p.kind) {
    case 'card': return `карта •${p.last4}`;
    case 'sbp': return `СБП ${p.phone}`;
    case 'cash': return 'наличные';
    default: {
      const unreachable: never = p;
      return unreachable;
    }
  }
}

function describeForgot(p: Payment): string {
  switch (p.kind) {
    case 'card': return 'карта';
    case 'sbp': return 'СБП';
    default: {
      // @ts-expect-error — вариант 'cash' не обработан: { kind: 'cash' } нельзя присвоить never
      const unreachable: never = p;
      return unreachable;
    }
  }
}

function parseQty(s: string): Result<number, string> {
  return /^\d+$/.test(s) ? { ok: true, value: Number(s) } : { ok: false, error: 'не число' };
}

const r = parseQty('3');
// @ts-expect-error — до проверки ok поля value может не быть
r.value;
if (r.ok) assert.equal(r.value, 3);

assert.equal(describe({ kind: 'card', last4: '4242' }), 'карта •4242');
assert.equal(describe({ kind: 'cash' }), 'наличные');
assert.deepEqual(describeForgot({ kind: 'cash' }) as unknown, { kind: 'cash' });                         // во время выполнения пролетело бы
console.log('adt ok');
