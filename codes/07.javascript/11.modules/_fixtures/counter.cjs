let count = 0;
module.exports = { count, inc() { count++; module.exports.count = count; }, get live() { return count; } };
