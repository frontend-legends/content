// Проверки к 16.06: три сервиса с задержкой, клиент далеко. Водопад запросов из браузера против одного
// запроса к BFF; урезание ответа под экран; контрактный тест потребителя и совместимость изменений.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { z } from 'zod';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const listen = (handler) => new Promise((r) => { const s = createServer(handler).listen(0, () => r(s)); });
const SERVICE_MS = 60;        // время ответа сервиса внутри дата-центра
const CLIENT_RTT = 80;        // круг «браузер ↔ сервер» по мобильной сети

// сервисы: каталог отдаёт «толстую» запись на 40 полей
const fat = Object.fromEntries(Array.from({ length: 37 }, (_, i) => [`internalField${i}`, 'x'.repeat(40)]));
const services = await listen(async (req, res) => {
  await wait(SERVICE_MS);
  res.setHeader('content-type', 'application/json');
  if (req.url === '/catalog/7') return res.end(JSON.stringify({ id: 7, title: 'Пуэр', price: 1200, sellerId: 3, ...fat }));
  if (req.url === '/stock/7') return res.end(JSON.stringify({ productId: 7, count: 3 }));
  if (req.url === '/sellers/3') return res.end(JSON.stringify({ id: 3, name: 'Чайный дом' }));
  res.statusCode = 404; res.end();
});
const svc = `http://localhost:${services.address().port}`;
const getJson = (url) => fetch(url).then((r) => r.json());

// «браузер»: каждый свой запрос платит круг по мобильной сети
const fromBrowser = async (url) => { await wait(CLIENT_RTT / 2); const data = await getJson(url); await wait(CLIENT_RTT / 2); return data; };

// --- без BFF: экран товара собирает браузер, продавец зависит от товара ---
let t = performance.now();
const product = await fromBrowser(`${svc}/catalog/7`);
const [stock, seller] = await Promise.all([fromBrowser(`${svc}/stock/7`), fromBrowser(`${svc}/sellers/${product.sellerId}`)]);
const withoutBff = performance.now() - t;
const rawBytes = JSON.stringify(product).length + JSON.stringify(stock).length + JSON.stringify(seller).length;

// --- BFF: один запрос из браузера, сборка внутри дата-центра, ответ под экран ---
const bff = await listen(async (req, res) => {
  const p = await getJson(`${svc}/catalog/7`);
  const [s, sel] = await Promise.all([getJson(`${svc}/stock/7`), getJson(`${svc}/sellers/${p.sellerId}`)]);
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ id: p.id, title: p.title, price: p.price, inStock: s.count > 0, seller: sel.name }));
});
t = performance.now();
const screen = await fromBrowser(`http://localhost:${bff.address().port}/screens/product/7`);
const withBff = performance.now() - t;
const screenBytes = JSON.stringify(screen).length;

assert.deepEqual(screen, { id: 7, title: 'Пуэр', price: 1200, inStock: true, seller: 'Чайный дом' });
console.log(`  экран товара: без BFF ${withoutBff.toFixed(0)} мс и ${rawBytes} байт, с BFF ${withBff.toFixed(0)} мс и ${screenBytes} байт`);
assert.ok(withoutBff > withBff + CLIENT_RTT * 0.8, `${withoutBff} vs ${withBff}`); // на один круг по мобильной сети меньше
assert.ok(rawBytes > screenBytes * 15);
services.close(); bff.close();

// --- контракт потребителя: что именно фронтенд читает из ответа ---
const ProductScreenContract = z.object({ id: z.number(), title: z.string(), price: z.number(), inStock: z.boolean(), seller: z.string() });
assert.equal(ProductScreenContract.safeParse(screen).success, true);

// совместимое изменение: добавили поле — старый потребитель не замечает
const v11 = { ...screen, deliveryDays: 2 };
assert.equal(ProductScreenContract.safeParse(v11).success, true);
// несовместимое: переименовали поле — контрактный тест падает до выкладки
const renamed = { id: 7, title: 'Пуэр', amount: 1200, inStock: true, seller: 'Чайный дом' };
const broken = ProductScreenContract.safeParse(renamed);
assert.equal(broken.success, false);
assert.deepEqual(broken.error.issues.map((i) => i.path.join('.')), ['price']);
// смена типа — тоже
assert.equal(ProductScreenContract.safeParse({ ...screen, inStock: 3 }).success, false);

// --- слой защиты от чужой модели: внешний формат переводится в свой один раз ---
const fromLegacy = (raw) => ({ id: Number(raw.PRODUCT_ID), title: raw.NAME_RU.trim(), price: Math.round(Number(raw.PRICE_KOP) / 100) });
assert.deepEqual(fromLegacy({ PRODUCT_ID: '7', NAME_RU: ' Пуэр ', PRICE_KOP: '120000' }), { id: 7, title: 'Пуэр', price: 1200 });

console.log('bff ok');
