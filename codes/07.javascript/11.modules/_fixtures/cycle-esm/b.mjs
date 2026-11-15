import { a, aFn } from './a.mjs';
export const b = 'b';
export function bFn() { return 'bFn'; }
globalThis.__cycle = { fnWorks: aFn(), constError: (() => { try { return a; } catch (e) { return e.name; } })() };
