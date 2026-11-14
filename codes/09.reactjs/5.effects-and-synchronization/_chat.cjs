// Общие заглушки темы 9.05: «внешняя система» — фейковое соединение с чатом и управляемые ответы сервера.
const log = [];
const connections = [];

function createConnection(serverUrl, roomId) {
  const handlers = {};
  const conn = {
    serverUrl, roomId, open: false,
    on(event, fn) { (handlers[event] ??= []).push(fn); },
    connect() { conn.open = true; log.push(`connect ${roomId}` + (serverUrl ? ` @ ${serverUrl}` : '')); (handlers.connected ?? []).forEach((f) => f()); },
    disconnect() { conn.open = false; log.push(`disconnect ${roomId}` + (serverUrl ? ` @ ${serverUrl}` : '')); },
    emit(event, payload) { if (conn.open) (handlers[event] ?? []).forEach((f) => f(payload)); },
  };
  connections.push(conn);
  return conn;
}
// последнее открытое соединение
const live = () => connections.filter((c) => c.open);

// управляемый «сервер»: каждый запрос ждёт, пока тест не ответит на него
function controlledServer() {
  const pending = new Map();
  function fetchHistory(roomId, { signal } = {}) {
    return new Promise((resolve, reject) => {
      pending.set(roomId, () => resolve([`${roomId}: привет`]));
      signal?.addEventListener('abort', () => {
        pending.delete(roomId);
        reject(new DOMException('This operation was aborted', 'AbortError'));
      });
    });
  }
  return { fetchHistory, respond: (roomId) => pending.get(roomId)?.(), pending };
}

module.exports = { log, connections, live, createConnection, controlledServer };
