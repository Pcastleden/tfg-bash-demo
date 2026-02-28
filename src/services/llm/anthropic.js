const Anthropic = require('@anthropic-ai/sdk');
const { toAnthropicTools } = require('./format');

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

/**
 * Call Anthropic Messages API.
 *
 * @param {object} params
 * @param {string} params.model
 * @param {number} params.maxTokens
 * @param {number} params.temperature
 * @param {string} params.systemPrompt
 * @param {Array}  params.tools        - internal-format tool defs
 * @param {Array}  params.messages      - Anthropic-format messages
 * @param {number} params.timeout       - timeout in ms
 * @returns {Promise<{ text: string|null, toolCalls: Array, done: boolean, raw: object }>}
 */
async function callModel({ model, maxTokens, temperature, systemPrompt, tools, messages, timeout }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      tools: toAnthropicTools(tools),
      messages,
    }, { signal: controller.signal });

    const textBlocks = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text);

    const toolCalls = response.content
      .filter(b => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: b.name, arguments: b.input }));

    const done = response.stop_reason !== 'tool_use' || toolCalls.length === 0;

    return {
      text: textBlocks.length > 0 ? textBlocks.join('\n') : null,
      toolCalls,
      done,
      raw: response,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build messages to append after a tool-use round (Anthropic format).
 */
function buildToolResultMessages(rawResponse, toolResults) {
  return [
    { role: 'assistant', content: rawResponse.content },
    {
      role: 'user',
      content: toolResults.map(tr => ({
        type: 'tool_result',
        tool_use_id: tr.toolCallId,
        content: tr.content,
      })),
    },
  ];
}

/**
 * Convert conversation history to Anthropic format.
 * History is already stored in Anthropic-native format, so pass through.
 */
function formatMessages(messages) {
  return messages;
}

module.exports = { callModel, buildToolResultMessages, formatMessages };
