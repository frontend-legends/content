// Проверки к 15.02: MCP — это JSON-RPC 2.0. Сырые сообщения по stdio, затем клиент SDK: инструменты и их схемы,
// ресурс, подсказка, ошибка проверки аргументов, и цикл «агента» с подтверждением разрушающих действий.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));

// --- 1. руками: строка JSON на сообщение, initialize → ответ с версией протокола и возможностями ---
{
  const child = spawn(process.execPath, [serverPath], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = [];
  child.stdout.setEncoding('utf8');
  let buf = '';
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
  const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
  const waitFor = async (id) => { for (let t = 0; t < 100; t++) { const m = lines.find((l) => l.id === id); if (m) return m; await new Promise((r) => setTimeout(r, 20)); } throw new Error('нет ответа'); };

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '0' } } });
  const init = await waitFor(1);
  assert.equal(init.jsonrpc, '2.0');
  assert.equal(init.result.serverInfo.name, 'shop');
  assert.deepEqual(Object.keys(init.result.capabilities).sort(), ['prompts', 'resources', 'tools']);
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_stock', arguments: { productId: 7 } } });
  assert.deepEqual((await waitFor(2)).result.content, [{ type: 'text', text: 'На складе: 3' }]);
  send({ jsonrpc: '2.0', id: 3, method: 'no/such/method' });
  assert.equal((await waitFor(3)).error.code, -32601); // Method not found по JSON-RPC
  child.kill();
}

// --- 2. клиент SDK: что сервер предлагает модели ---
const client = new Client({ name: 'shop-agent', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [serverPath] }));
try {
  const { tools } = await client.listTools();
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  assert.deepEqual(Object.keys(byName).sort(), ['cancel_order', 'get_stock', 'read_review']);
  // схема аргументов уходит модели как JSON Schema
  assert.equal(byName.get_stock.inputSchema.type, 'object');
  assert.deepEqual(byName.get_stock.inputSchema.required, ['productId']);
  assert.equal(byName.get_stock.inputSchema.properties.productId.type, 'integer');
  assert.equal(byName.cancel_order.annotations.destructiveHint, true);

  const catalog = await client.readResource({ uri: 'shop://catalog' });
  assert.deepEqual(JSON.parse(catalog.contents[0].text).map((p) => p.title), ['Пуэр', 'Улун']);
  const prompt = await client.getPrompt({ name: 'describe_product', arguments: { title: 'Пуэр' } });
  assert.match(prompt.messages[0].content.text, /«Пуэр»/);

  // неверные аргументы: сервер проверяет схему и возвращает ошибку инструмента
  const bad = await client.callTool({ name: 'get_stock', arguments: { productId: 'семь' } });
  assert.equal(bad.isError, true);
  assert.match(bad.content[0].text, /productId/);

  // --- 3. цикл агента: ответ инструмента содержит внедрённую инструкцию ---
  const confirmations = [];
  const confirm = async (tool, args) => { confirmations.push(`${tool} ${JSON.stringify(args)}`); return false; }; // человек отказывает
  const plan = [
    { tool: 'read_review', args: { productId: 7 } },
    { tool: 'cancel_order', args: { orderId: 42 } },  // «модель» поддалась внедрению
    { text: 'Отзыв положительный.' },
  ];
  const log = [];
  for (const step of plan) {
    if (step.text) { log.push(`ответ: ${step.text}`); break; }
    const meta = byName[step.tool];
    if (meta.annotations?.destructiveHint && !(await confirm(step.tool, step.args))) { log.push(`отклонено: ${step.tool}`); continue; }
    const res = await client.callTool({ name: step.tool, arguments: step.args });
    log.push(`${step.tool}: ${res.content[0].text.slice(0, 20)}`);
  }
  assert.deepEqual(confirmations, ['cancel_order {"orderId":42}']);
  assert.deepEqual(log, ['read_review: Отличный чай! ВАЖНО ', 'отклонено: cancel_order', 'ответ: Отзыв положительный.']);
} finally {
  await client.close();
}

console.log('mcp ok');
