// Проверки к 14.06 без настоящей модели: свой прокси с ключом на сервере и потоковым ответом,
// разрыв UTF-8 между фрагментами, разбор SSE, отмена генерации, структурированный ответ по схеме,
// цикл вызова инструментов, поиск по векторам и AI SDK 7 с тестовой моделью.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { z } from 'zod';
import { streamText, generateText, Output, simulateReadableStream, NoObjectGeneratedError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

const listen = (handler) => new Promise((resolve) => { const s = createServer(handler).listen(0, () => resolve(s)); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- сервер-прокси: ключ живёт здесь, клиент ходит на /api/chat ---
const SECRET = 'sk-server-only';
let aborted = false;
let tokensSent = 0;
const reply = 'Пуэр — выдержанный китайский чай.';
const server = await listen(async (req, res) => {
  if (req.url !== '/api/chat') { res.statusCode = 404; return res.end(); }
  assert.equal(req.headers.authorization, undefined); // клиент ключ не присылает и не знает
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
  req.on('close', () => { if (!res.writableEnded) aborted = true; });
  for (const word of reply.split(' ')) {
    if (res.destroyed) return;
    res.write(`data: ${JSON.stringify({ delta: `${word} ` })}\n\n`);
    tokensSent++;
    await wait(60);
  }
  res.end('data: [DONE]\n\n');
});
const url = `http://localhost:${server.address().port}/api/chat`;

// разбор SSE: события разделены пустой строкой, фрагмент сети может оборваться где угодно
function sseParser(onEvent) {
  let buffer = '';
  return (text) => {
    buffer += text;
    let i;
    while ((i = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, i); buffer = buffer.slice(i + 2);
      const data = raw.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('\n');
      if (data) onEvent(data);
    }
  };
}

// --- потоковый ответ: первый фрагмент приходит задолго до конца ---
{
  const started = performance.now();
  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: 'Что такое пуэр?' }] }) });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let text = '', first;
  const feed = sseParser((data) => { if (data !== '[DONE]') { first ??= performance.now() - started; text += JSON.parse(data).delta; } });
  for (;;) { const { value, done } = await reader.read(); if (done) break; feed(value); }
  const total = performance.now() - started;
  assert.equal(text.trim(), reply);
  assert.ok(first < total / 3, `первый ${first.toFixed(0)} мс из ${total.toFixed(0)}`);
  console.log(`  первый фрагмент через ${first.toFixed(0)} мс, весь ответ через ${total.toFixed(0)} мс`);
}

// --- многобайтовые символы, разорванные между фрагментами ---
{
  const bytes = new TextEncoder().encode('Пуэр');      // 8 байт: по 2 на букву
  const parts = [bytes.slice(0, 3), bytes.slice(3)];    // разрыв посреди «у»
  const naive = parts.map((p) => new TextDecoder().decode(p)).join('');
  const decoder = new TextDecoder();
  const streamed = parts.map((p) => decoder.decode(p, { stream: true })).join('') + decoder.decode();
  assert.equal(naive, 'П��эр');   // «кракозябры» на месте разрыва
  assert.equal(streamed, 'Пуэр');
}

// --- разбор SSE при разрыве посреди события ---
{
  const events = [];
  const feed = sseParser((d) => events.push(JSON.parse(d)));
  feed('data: {"delta":"Пу'); feed('эр"}\n'); feed('\ndata: {"delta":" чай"}\n\n');
  assert.deepEqual(events, [{ delta: 'Пуэр' }, { delta: ' чай' }]);
}

// --- кнопка «Стоп»: отмена запроса останавливает генерацию на сервере ---
{
  tokensSent = 0; aborted = false;
  const controller = new AbortController();
  const res = await fetch(url, { method: 'POST', body: '{}', signal: controller.signal });
  const reader = res.body.getReader();
  await reader.read();
  controller.abort();
  await reader.read().catch(() => {});
  await wait(200);
  assert.equal(aborted, true);
  assert.ok(tokensSent < reply.split(' ').length, String(tokensSent)); // сервер перестал отправлять — и тратить токены
}
server.close();

// --- структурированный ответ: проверяют схемой, а не верят ---
const Product = z.object({ title: z.string(), price: z.number().positive(), tags: z.array(z.string()).max(5) });
assert.equal(Product.safeParse(JSON.parse('{"title":"Пуэр","price":1200,"tags":["чай"]}')).success, true);
assert.throws(() => JSON.parse('```json\n{"title":"Пуэр"}\n```'), SyntaxError);              // обёртка из markdown
assert.equal(Product.safeParse({ title: 'Пуэр', price: '1200 ₽', tags: [] }).success, false); // строка вместо числа

// --- цикл инструментов: модель просит вызвать функцию, код выполняет только разрешённое ---
{
  const tools = { getStock: async ({ id }) => ({ id, count: 3 }) };
  const script = [
    { tool: 'getStock', args: { id: 7 } },
    { tool: 'deleteAllOrders', args: {} },
    { text: 'На складе 3 упаковки.' },
  ];
  const fakeModel = async (history) => script[history.filter((m) => m.role === 'assistant').length];
  const history = [{ role: 'user', content: 'Есть ли пуэр?' }];
  const executed = [];
  for (let step = 0; step < 5; step++) {
    const answer = await fakeModel(history);
    history.push({ role: 'assistant', ...answer });
    if (answer.text) break;
    const fn = tools[answer.tool];
    const result = fn ? await fn(answer.args) : { error: `инструмент ${answer.tool} не разрешён` };
    if (fn) executed.push(answer.tool);
    history.push({ role: 'tool', name: answer.tool, result });
  }
  assert.deepEqual(executed, ['getStock']);
  assert.equal(history.at(-1).text, 'На складе 3 упаковки.');
  assert.deepEqual(history.find((m) => m.name === 'deleteAllOrders').result, { error: 'инструмент deleteAllOrders не разрешён' });
}

// --- поиск по смыслу: косинусная близость векторов ---
{
  const cosine = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return d / Math.sqrt(na * nb); };
  // игрушечные «эмбеддинги»: [чай, доставка, возврат]
  const docs = [
    { text: 'Как заварить пуэр', v: [0.9, 0.1, 0] },
    { text: 'Сроки доставки по России', v: [0.1, 0.9, 0.1] },
    { text: 'Как вернуть товар', v: [0, 0.2, 0.9] },
  ];
  const query = [0.2, 0.85, 0.1]; // «когда привезут заказ»
  const top = docs.map((d) => ({ ...d, score: cosine(query, d.v) })).sort((a, b) => b.score - a.score);
  assert.equal(top[0].text, 'Сроки доставки по России');
  assert.ok(top[0].score > 0.95);
}

// --- AI SDK 7: тот же поток и схема, но с тестовой моделью ---
const usage = { inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: undefined } };
const finish = { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, logprobs: undefined, usage };
{
  const result = streamText({
    model: new MockLanguageModelV4({
      doStream: async () => ({ stream: simulateReadableStream({ chunks: [
        { type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Пуэр — ' }, { type: 'text-delta', id: 't', delta: 'чай' }, { type: 'text-end', id: 't' }, finish,
      ] }) }),
    }),
    prompt: 'Что такое пуэр?',
  });
  const response = result.toUIMessageStreamResponse();
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const body = await response.text();
  const events = body.split('\n\n').filter(Boolean).map((e) => e.replace(/^data: /, '')).filter((d) => d !== '[DONE]').map((d) => JSON.parse(d));
  assert.deepEqual(events.filter((e) => e.type === 'text-delta').map((e) => e.delta), ['Пуэр — ', 'чай']);
  assert.ok(events.some((e) => e.type === 'finish'));
}
{
  const model = (text) => new MockLanguageModelV4({ doGenerate: async () => ({ content: [{ type: 'text', text }], finishReason: { unified: 'stop', raw: undefined }, usage, warnings: [] }) });
  const ok = await generateText({ model: model('{"title":"Пуэр","price":1200,"tags":["чай"]}'), output: Output.object({ schema: Product }), prompt: 'карточка' });
  assert.deepEqual(ok.output, { title: 'Пуэр', price: 1200, tags: ['чай'] });
  const bad = await generateText({ model: model('{"title":"Пуэр","price":"дорого","tags":[]}'), output: Output.object({ schema: Product }), prompt: 'карточка' }).then(
    (r) => { try { return r.output; } catch (e) { return e; } },
    (e) => e,
  );
  assert.ok(NoObjectGeneratedError.isInstance(bad), String(bad));
}

console.log('ai ok');
