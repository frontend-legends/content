import { count, inc } from './counter.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const legacy = require('./counter.cjs');
inc(); inc();
legacy.inc(); legacy.inc();
globalThis.__p1 = [count, legacy.count];
try { count = 5; } catch (e) { globalThis.__p1.push(e.constructor.name); }
