globalThis.__order.push('slow: before await');
await new Promise((r) => setTimeout(r, 30));
globalThis.__order.push('slow: after await');
export const config = { api: '/v1' };
