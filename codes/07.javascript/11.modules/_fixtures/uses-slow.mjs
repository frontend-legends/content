import { config } from './slow.mjs';
globalThis.__order.push(`uses-slow: body sees ${config.api}`);
