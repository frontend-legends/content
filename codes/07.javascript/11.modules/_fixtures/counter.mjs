export let count = 0;
export function inc() { count++; }
export const loadedAt = (globalThis.__loads = (globalThis.__loads ?? 0) + 1);
