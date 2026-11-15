// types-only
// Глава 8.03 — классы: private только при проверке (обходится скобками), #private — в рантайме,
// implements не типизирует параметры, тип экземпляра и тип класса, abstract, override.

class Wallet {
  private balance = 0;
  #secret = 'pin';
  deposit(sum: number) { this.balance += sum; return this.#secret.length; }
}
const w = new Wallet();
// @ts-expect-error — private недоступен через точку
w.balance;
const viaBracket: number = w['balance'];    // а через скобки — доступен: проверка только по имени свойства
// @ts-expect-error — #secret недоступен никак
w['#secret'];

// implements проверяет класс, но не задаёт типы его параметрам
interface PriceRule { apply(price: number): number }
class Discount implements PriceRule {
  // @ts-expect-error — параметр без аннотации: implicit any, а не number из интерфейса
  apply(price) { return price * 0.9; }
}

// тип экземпляра и тип самого класса
class Product { constructor(public title: string) {} static create(t: string) { return new Product(t); } }
const instance: Product = new Product('Чай');
const ctor: typeof Product = Product;
ctor.create('Кофе');
// @ts-expect-error — у экземпляра нет статического create
instance.create('x');

// abstract и override
abstract class Payment {
  abstract pay(sum: number): Promise<void>;
  describe() { return 'оплата'; }
}
// @ts-expect-error — абстрактный класс нельзя создать
new Payment();
class CardPayment extends Payment {
  async pay(sum: number) { void sum; }
  override describe() { return 'картой'; }
}
new CardPayment();

export { viaBracket, Discount };
