import { cartTotal } from './cart.js';
export const DEFAULT_CURRENCY = '₽';
export function format(v) { return `${v} ${DEFAULT_CURRENCY}`; }
