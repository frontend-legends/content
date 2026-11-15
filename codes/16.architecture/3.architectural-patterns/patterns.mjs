// Проверки к 16.03: двусторонняя связь моделей зацикливается; редьюсер детерминирован и воспроизводим
// по журналу; гексагональный сценарий с фейковыми и HTTP-адаптерами; шина событий и отписка.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// --- двусторонние связи в стиле MVC: модели обновляют друг друга ---
function observable(value) { const subs = []; return { get: () => value, set(v) { if (v === value) return; value = v; subs.forEach((f) => f(v)); }, on: (f) => subs.push(f) }; }
{
  const qty = observable(1), total = observable(1200);
  let updates = 0;
  qty.on((q) => { updates++; if (updates < 50) total.set(q * 1200); });          // количество меняет сумму
  total.on((t) => { updates++; if (updates < 50) qty.set(Math.ceil(t / 1100)); }); // а «пересчёт по скидке» меняет количество
  qty.set(5);
  assert.equal(updates, 50);   // 50 обновлений до искусственного стопа — пинг-понг между моделями
}

// --- однонаправленный поток: действие → редьюсер → новое состояние ---
const reducer = (state, action) => {
  switch (action.type) {
    case 'add': return { ...state, items: [...state.items, action.item] };
    case 'remove': return { ...state, items: state.items.filter((i) => i.id !== action.id) };
    case 'promo': return { ...state, promo: action.code };
    default: return state;
  }
};
const total = (s) => s.items.reduce((sum, i) => sum + i.price, 0) * (s.promo === 'TEA10' ? 0.9 : 1);
const log = [
  { type: 'add', item: { id: 7, price: 1200 } },
  { type: 'add', item: { id: 8, price: 800 } },
  { type: 'promo', code: 'TEA10' },
  { type: 'remove', id: 8 },
];
const initial = { items: [], promo: null };
const final = log.reduce(reducer, initial);
assert.equal(total(final), 1080);
assert.deepEqual(log.reduce(reducer, initial), final);      // те же действия — то же состояние
const atStep = (k) => log.slice(0, k).reduce(reducer, initial); // «путешествие во времени»
assert.equal(total(atStep(3)), 1800);
assert.equal(initial.items.length, 0);                       // старое состояние не изменено

// --- гексагональная архитектура: сценарий в центре, мир — через порты ---
// домен: чистая функция без импортов
async function placeOrder({ cart, payments, orders, clock }) {
  if (cart.items.length === 0) throw new Error('Корзина пуста');
  const amount = cart.items.reduce((s, i) => s + i.price * i.qty, 0);
  const payment = await payments.charge(amount);
  if (!payment.ok) return { status: 'declined' };
  const order = await orders.save({ items: cart.items, amount, paidAt: clock() });
  return { status: 'paid', orderId: order.id, amount };
}
const cart = { items: [{ id: 7, price: 1200, qty: 2 }] };
const clock = () => '2026-11-15T10:00:00Z';

// адаптеры в памяти — для тестов
{
  const saved = [];
  const res = await placeOrder({ cart, clock, payments: { charge: async (a) => ({ ok: a < 5000 }) }, orders: { save: async (o) => { saved.push(o); return { id: saved.length }; } } });
  assert.deepEqual(res, { status: 'paid', orderId: 1, amount: 2400 });
  const declined = await placeOrder({ cart: { items: [{ price: 9000, qty: 1 }] }, clock, payments: { charge: async (a) => ({ ok: a < 5000 }) }, orders: { save: async () => assert.fail('не должен сохранять') } });
  assert.deepEqual(declined, { status: 'declined' });
}
// HTTP-адаптеры — для продакшена; сценарий тот же
{
  const server = await new Promise((r) => {
    let id = 100;
    const s = createServer(async (req, res) => {
      let body = ''; for await (const c of req) body += c;
      res.setHeader('content-type', 'application/json');
      if (req.url === '/payments') return res.end(JSON.stringify({ ok: JSON.parse(body).amount < 5000 }));
      if (req.url === '/orders') return res.end(JSON.stringify({ id: ++id }));
    }).listen(0, () => r(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const post = (path, data) => fetch(base + path, { method: 'POST', body: JSON.stringify(data) }).then((r) => r.json());
  const res = await placeOrder({ cart, clock, payments: { charge: (amount) => post('/payments', { amount }) }, orders: { save: (o) => post('/orders', o) } });
  assert.deepEqual(res, { status: 'paid', orderId: 101, amount: 2400 });
  server.close();
}
assert.doesNotMatch(placeOrder.toString(), /fetch|React|localStorage|document/); // домен не знает о мире

// --- шина событий: подписчик без отписки продолжает работать после «размонтирования» ---
{
  const bus = new EventTarget();
  const calls = [];
  const mountWidget = (name, signal) => bus.addEventListener('cart:changed', (e) => calls.push(`${name}:${e.detail}`), { signal });
  mountWidget('leaky');                      // забыли отписку
  const controller = new AbortController();
  mountWidget('clean', controller.signal);
  bus.dispatchEvent(new CustomEvent('cart:changed', { detail: 1 }));
  controller.abort();                        // «размонтировали» оба, отписался только clean
  bus.dispatchEvent(new CustomEvent('cart:changed', { detail: 2 }));
  assert.deepEqual(calls, ['leaky:1', 'clean:1', 'leaky:2']);
}

console.log('patterns ok');
