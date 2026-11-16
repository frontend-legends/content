// Проверки к 4.01 в Node: TCP — поток байтов без границ сообщений (две записи приходят одним куском,
// а одна большая — несколькими), поэтому нужен свой формат кадров; UDP сохраняет границы датаграмм;
// порты: свободный порт от ОС, EADDRINUSE, ECONNREFUSED на закрытом порту; localhost — это два адреса,
// ::1 и 127.0.0.1, и сервер на одном из них не виден по другому; задержка важнее ширины канала.
// Запуск: cd codes && node run.mjs 04.network-api/1.networking-fundamentals
import assert from 'node:assert/strict';
import net from 'node:net';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';

const listen = (server, ...args) => new Promise((r) => server.listen(...args, () => r(server.address().port)));

// --- TCP: границ сообщений нет ---
{
  const chunks = [];
  const server = net.createServer((s) => { s.on('error', () => {}); s.on('data', (d) => chunks.push(d.toString())); });
  const port = await listen(server, 0, '127.0.0.1');
  const client = net.connect(port, '127.0.0.1');
  await new Promise((r) => client.on('connect', r));
  client.cork();                                                                              // два write — один сегмент
  client.write('{"type":"price","value":450}');
  client.write('{"type":"price","value":480}');
  client.uncork();
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(chunks, ['{"type":"price","value":450}{"type":"price","value":480}']);  // пришло слитно
  assert.throws(() => JSON.parse(chunks[0]), SyntaxError);
  // большая запись приходит частями
  chunks.length = 0;
  client.write('x'.repeat(2_000_000));
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(chunks.length > 1, `кусков: ${chunks.length}`);
  assert.equal(chunks.join('').length, 2_000_000);
  client.destroy();
  server.close();
}

// --- практика: кадры через перевод строки ---
function lines(onMessage) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) !== -1) {
      onMessage(JSON.parse(buffer.slice(0, i)));
      buffer = buffer.slice(i + 1);
    }
  };
}
{
  const got = [];
  const feed = lines((m) => got.push(m.value));
  feed('{"value":450}\n{"val');                                                               // сообщение разрезано
  feed('ue":480}\n{"value":500}\n');                                                          // и склеено со следующим
  assert.deepEqual(got, [450, 480, 500]);
}

// --- UDP: каждая датаграмма — отдельное сообщение ---
{
  const server = dgram.createSocket('udp4');
  const got = [];
  const done = new Promise((r) => server.on('message', (m) => { got.push(m.toString()); if (got.length === 2) r(); }));
  await new Promise((r) => server.bind(0, '127.0.0.1', r));
  const client = dgram.createSocket('udp4');
  const { port } = server.address();
  client.send('первое', port, '127.0.0.1');
  client.send('второе', port, '127.0.0.1');
  await done;
  assert.deepEqual(got.sort(), ['второе', 'первое']);                                         // границы сохранены
  client.close();
  server.close();
}

// --- порты ---
{
  const a = net.createServer();
  const port = await listen(a, 0, '127.0.0.1');
  assert.ok(port > 1024);
  const b = net.createServer();
  await assert.rejects(new Promise((resolve, reject) => { b.once('error', reject); b.listen(port, '127.0.0.1', resolve); }), { code: 'EADDRINUSE' });
  a.close();
  await new Promise((r) => a.once('close', r));
  await assert.rejects(new Promise((resolve, reject) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', resolve);
    s.once('error', reject);
  }), { code: 'ECONNREFUSED' });
}

// --- localhost — два адреса ---
{
  const all = await dns.lookup('localhost', { all: true });
  const families = all.map((a) => a.family);
  assert.ok(all.some((a) => a.address === '127.0.0.1'));
  const server = net.createServer((s) => { s.on('error', () => {}); s.end('ok'); });
  const port = await listen(server, 0, '127.0.0.1');                                           // только IPv4
  const connect = (opts) => new Promise((resolve, reject) => {
    const s = net.connect({ port, host: 'localhost', ...opts });
    s.once('connect', () => { s.destroy(); resolve('ok'); });
    s.once('error', (e) => reject(e));
  });
  if (families[0] === 6) {
    // первым адресом ОС вернула ::1 — без перебора адресов соединение отказано
    await assert.rejects(connect({ autoSelectFamily: false }), { code: 'ECONNREFUSED' });
    assert.equal(await connect({ autoSelectFamily: true }), 'ok');                             // перебор адресов спасает
  }
  assert.equal(await connect({ host: '127.0.0.1' }), 'ok');
  server.close();
}

// --- практика: сервер на '::' принимает и IPv6, и IPv4; setEncoding не режет многобайтовые символы ---
{
  const got = [];
  const server = net.createServer((s) => { s.on('error', () => {}); s.setEncoding('utf8'); s.on('data', (d) => got.push(d)); });
  const port = await listen(server, 0, '::');
  let connected = 0;
  for (const host of ['127.0.0.1', '::1']) {
    const s = net.connect(port, host);
    try { await new Promise((r, j) => { s.once('connect', r); s.once('error', j); }); } catch { continue; }   // в системе без IPv6
    connected++;
    const bytes = Buffer.from('Ж');                                                           // два байта UTF-8
    s.write(bytes.subarray(0, 1));
    await new Promise((r) => setTimeout(r, 30));
    s.write(bytes.subarray(1));
    await new Promise((r) => setTimeout(r, 30));
    s.destroy();
  }
  assert.equal(got.join(''), 'Ж'.repeat(connected));                                         // ни одного «�»
  assert.ok(connected >= 1);
  server.close();
}

// --- задержка против ширины канала: 10 последовательных запросов по 150 мс RTT ---
const rtt = 150;
const sequential = 10 * rtt;
const parallel = rtt;
assert.equal(sequential, 1500);
assert.equal(parallel, 150);
// первое окно TCP — 10 сегментов по ~1460 байт: около 14 КБ за первый круг
assert.equal(10 * 1460, 14600);

console.log('sockets ok');
