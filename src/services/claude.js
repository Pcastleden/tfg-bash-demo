// Backward-compatible re-export.
// All LLM logic has moved to ./llm/index.js
const { chat } = require('./llm');

module.exports = { chat };
