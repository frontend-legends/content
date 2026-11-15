exports.a = 'a (до require b)';
const b = require('./b.cjs');
exports.a = 'a (готов)';
exports.seen = b.seenA;
