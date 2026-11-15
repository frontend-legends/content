import { format, DEFAULT_CURRENCY } from './price.js';
export const emptyLabel = `0 ${DEFAULT_CURRENCY}`;
export function cartTotal(items) { return format(items.reduce((s, i) => s + i.price, 0)); }
