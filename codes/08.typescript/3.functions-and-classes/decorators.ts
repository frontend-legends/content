// Глава 8.03 — стандартные декораторы (TS 5+): метод-декоратор получает (value, context) и может вернуть замену.
import assert from 'node:assert/strict';

const calls: string[] = [];

function logged<This, Args extends unknown[], Return>(
  method: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>,
) {
  return function (this: This, ...args: Args): Return {
    calls.push(`${String(context.name)}(${args.join(', ')})`);
    return method.apply(this, args);
  };
}

function bound<This, T extends (this: This, ...args: any[]) => any>(method: T, context: ClassMethodDecoratorContext<This, T>) {
  context.addInitializer(function (this: This) {
    (this as any)[context.name] = method.bind(this);
  });
}

class Cart {
  items: number[] = [];
  @logged
  add(price: number) { this.items.push(price); return this.items.length; }
  @bound
  total() { return this.items.reduce((s, p) => s + p, 0); }
}

const cart = new Cart();
assert.equal(cart.add(490), 1);
assert.equal(cart.add(2490), 2);
assert.deepEqual(calls, ['add(490)', 'add(2490)']);
const { total } = cart;                  // метод оторван от объекта
assert.equal(total(), 2980);             // но this привязан инициализатором
console.log('ok');
