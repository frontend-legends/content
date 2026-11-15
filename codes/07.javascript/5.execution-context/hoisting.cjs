// Глава 7.05 — hoisting и TDZ, области видимости, глобальный объект в скрипте, лексическая цепочка областей.
// run: node hoisting.cjs
const assert = require('node:assert/strict');
const vm = require('node:vm');

// выполняем как классический скрипт в отдельном глобальном окружении
function script(code) { const ctx = vm.createContext({ log: [] }); vm.runInContext(code, ctx); return ctx; }

// var поднимается со значением undefined, объявление функции — целиком
{
  const ctx = script(`
    log.push(typeof price, price, typeof format, format(5));
    var price = 490;
    function format(v) { return v + ' ₽'; }
  `);
  assert.deepEqual(ctx.log, ['undefined', undefined, 'function', '5 ₽']);
}

// let, const, class — в TDZ до строки объявления; typeof в TDZ тоже бросает
assert.throws(() => { qty; let qty = 1; }, { name: 'ReferenceError', message: "Cannot access 'qty' before initialization" });
assert.throws(() => { typeof tax; const tax = 0.2; }, ReferenceError);
assert.equal(typeof neverDeclared, 'undefined');
assert.throws(() => { new Cart(); class Cart {} }, ReferenceError);
// TDZ — про время, а не про место: функция, вызванная после объявления, видит значение
{
  function read() { return limit; }
  let limit = 3;
  assert.equal(read(), 3);
}
// var не знает блоков, let знает
{
  if (true) { var a = 1; let b = 2; }
  assert.equal(a, 1);
  assert.equal(typeof b, 'undefined');
}

// глобальные var и function становятся свойствами глобального объекта, let и const — нет
{
  const ctx = script(`var v = 1; let l = 2; const c = 3; function fn() {}`);
  assert.equal(ctx.v, 1);
  assert.equal(typeof ctx.fn, 'function');
  assert.equal(ctx.l, undefined);
  assert.equal(ctx.c, undefined);
}

// лексическая цепочка: переменная ищется там, где функция объявлена, а не там, где вызвана
{
  const currency = '₽';
  function format(v) { return `${v} ${currency}`; }
  function invoice() { const currency = '$'; return format(10); }
  assert.equal(invoice(), '10 ₽');
}
// затенение: внутренняя переменная скрывает внешнюю
{
  const discount = 10;
  function calc() { const discount = 20; return discount; }
  assert.equal(calc(), 20);
  assert.equal(discount, 10);
}
console.log('ok');
