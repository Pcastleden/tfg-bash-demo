const OpenAI = require('openai');
const { toOpenAITools } = require('./format');

const client = new OpenAI(); // reads OPENAI_API_KEY from env

/**
 * Call OpenAI Chat Completions API.
 *
 * @param {object} params
 * @param {string} params.model
 * @param {number} params.maxTokens
 * @param {number} params.temperature
 * @param {string} params.systemPrompt
 * @param {Array}  params.tools        - internal-format tool defs
 * @param {Array}  params.messages      - OpenAI-format messages
 * @param {number} params.timeout       - timeout in ms
 * @returns {Promise<{ text: string|null, toolCalls: Array, done: boolean, raw: object }>}
 */
async function callModel({ model, maxTokens, temperature, systemPrompt, tools, messages, timeout }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature,
      tools: toOpenAITools(tools),
      messages: openaiMessages,
    }, { signal: controller.signal });

    const choice = response.choices[0];
    const msg = choice.message;

    const text = msg.content || null;

    const toolCalls = (msg.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    const done = choice.finish_reason !== 'tool_calls' || toolCalls.length === 0;

    return { text, toolCalls, done, raw: response };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build messages to append after a tool-use round (OpenAI format).
 *
 * OpenAI requires:
 *   1. The assistant message (with tool_calls) echoed back
 *   2. One { role: 'tool', tool_call_id, content } per result
 */
function buildToolResultMessages(rawResponse, toolResults) {
  const assistantMsg = rawResponse.choices[0].message;

  const toolMsgs = toolResults.map(tr => ({
    role: 'tool',
    tool_call_id: tr.toolCallId,
    content: tr.content,
  }));

  return [assistantMsg, ...toolMsgs];
}

/**
 * Convert conversation history from Anthropic-native format to OpenAI format.
 *
 * Stored history uses Anthropic's content block arrays for tool-use turns.
 * Simple text messages (string content) are compatible with both providers.
 */
function formatMessages(messages) {
  return messages.map(msg => {
    // Simple string content — works for both providers
    if (typeof msg.content === 'string') {
      return msg;
    }

    // Assistant message with Anthropic tool_use blocks
    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text);
      const toolUses = msg.content.filter(b => b.type === 'tool_use');

      const result = {
        role: 'assistant',
        content: textParts.join('\n') || null,
      };

      if (toolUses.length > 0) {
        result.tool_calls = toolUses.map(tu => ({
          id: tu.id,
          type: 'function',
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input),
          },
        }));
      }

      return result;
    }

    // User message with Anthropic tool_result blocks
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const toolResults = msg.content.filter(b => b.type === 'tool_result');
      if (toolResults.length > 0) {
        return toolResults.map(tr => ({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        }));
      }
    }

    return msg;
  }).flat();
}

module.exports = { callModel, buildToolResultMessages, formatMessages };
