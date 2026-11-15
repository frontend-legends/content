import { b, bFn } from './b.mjs';
export const a = 'a';
export function aFn() { return 'aFn'; }
export const seenFromA = [bFn()];
