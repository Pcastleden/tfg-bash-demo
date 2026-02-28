/**
 * Tool definition format converters.
 *
 * Internal (normalized) tool format:
 *   { name, description, parameters: { type: 'object', properties, required } }
 *
 * Anthropic uses `input_schema`, OpenAI uses `{ type: 'function', function: { parameters } }`.
 */

/**
 * Convert Anthropic-format tool definitions (input_schema) to internal format.
 */
function normalizeToolDefs(anthropicTools) {
  return anthropicTools.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema,
  }));
}

/**
 * Convert internal tool defs to Anthropic format.
 */
function toAnthropicTools(internalTools) {
  return internalTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

/**
 * Convert internal tool defs to OpenAI function-calling format.
 */
function toOpenAITools(internalTools) {
  return internalTools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

module.exports = { normalizeToolDefs, toAnthropicTools, toOpenAITools };
