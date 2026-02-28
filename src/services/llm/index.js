const { getConfig, getDb } = require('../../db');
const { buildSystemPrompt, buildTools } = require('../../prompts/builder');
const { normalizeToolDefs } = require('./format');

const TIMEOUT_MS = 10_000;
const MAX_TOOL_ROUNDS = 5;

const providers = {
  anthropic: () => require('./anthropic'),
  openai: () => require('./openai'),
};

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
};

function getAlternateProvider(provider) {
  return provider === 'anthropic' ? 'openai' : 'anthropic';
}

/**
 * Check if an error should trigger automatic fallback.
 */
function isFallbackEligible(err) {
  if (err.name === 'AbortError') return true;
  if (err.status && err.status >= 500) return true;
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') return true;
  return false;
}

/**
 * Run the tool-use conversation loop with a specific provider.
 */
async function runWithProvider(providerName, { model, maxTokens, temperature, systemPrompt, tools, messages, handlers, onSystemEvent }) {
  const provider = providers[providerName]();
  const formattedMessages = provider.formatMessages([...messages]);

  let currentMessages = formattedMessages;
  const toolResults = [];
  let finalText = '';

  for (let turn = 0; turn < MAX_TOOL_ROUNDS; turn++) {
    const result = await provider.callModel({
      model,
      maxTokens,
      temperature,
      systemPrompt,
      tools,
      messages: currentMessages,
      timeout: TIMEOUT_MS,
    });

    if (result.text) {
      finalText = result.text;
    }

    if (result.done) break;

    // Log tool calls
    if (onSystemEvent) {
      const toolNames = result.toolCalls.map(t => t.name).join(', ');
      onSystemEvent('tool_call', `Tool call: ${toolNames}`, {
        tools: result.toolCalls.map(t => ({ name: t.name, input_keys: Object.keys(t.arguments || {}) })),
      });
    }

    // Process each tool call
    const processedResults = [];

    for (const toolCall of result.toolCalls) {
      let toolResult;

      if (toolCall.name === 'handoff_to_agent' && handlers.onHandoff) {
        toolResult = await handlers.onHandoff(toolCall.arguments);
        toolResults.push({ tool: 'handoff_to_agent', input: toolCall.arguments, result: toolResult });
      } else if (toolCall.name === 'update_session' && handlers.onUpdateSession) {
        toolResult = await handlers.onUpdateSession(toolCall.arguments);
        toolResults.push({ tool: 'update_session', input: toolCall.arguments, result: toolResult });
      } else {
        toolResult = { status: 'ok', message: `Tool ${toolCall.name} executed.` };
      }

      processedResults.push({
        toolCallId: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }

    // Append tool round to conversation
    const newMessages = provider.buildToolResultMessages(result.raw, processedResults);
    currentMessages = [...currentMessages, ...newMessages];
  }

  return { assistantMessage: finalText, toolResults, provider: providerName };
}

/**
 * Main chat function — drop-in replacement for the old claude.chat().
 *
 * Selects provider from config, runs the tool-use loop, and automatically
 * falls back to the alternate provider on 5xx errors or timeouts.
 */
async function chat(messages, handlers = {}, options = {}) {
  const db = getDb();
  const config = getConfig(db);
  const systemPrompt = buildSystemPrompt(db);
  const rawTools = buildTools(db);
  const tools = normalizeToolDefs(rawTools);

  const primaryProvider = config.llm_provider || process.env.LLM_PROVIDER || 'anthropic';
  const temperature = parseFloat(config.temperature) || 0.3;
  const maxTokens = parseInt(config.max_tokens, 10) || 1024;

  // Validate model belongs to the selected provider; fall back to default if mismatched
  const configModel = config.model_name;
  const modelMatchesProvider =
    (primaryProvider === 'anthropic' && configModel && configModel.startsWith('claude')) ||
    (primaryProvider === 'openai' && configModel && (configModel.startsWith('gpt') || configModel.startsWith('o')));
  const model = modelMatchesProvider ? configModel : DEFAULT_MODELS[primaryProvider];

  const params = { model, maxTokens, temperature, systemPrompt, tools, messages, handlers, onSystemEvent: options.onSystemEvent };

  try {
    return await runWithProvider(primaryProvider, params);
  } catch (err) {
    if (!isFallbackEligible(err)) throw err;

    const fallbackProvider = getAlternateProvider(primaryProvider);
    const fallbackModel = DEFAULT_MODELS[fallbackProvider];

    console.warn(`[NOX] ${primaryProvider} failed (${err.message}), falling back to ${fallbackProvider}`);

    if (options.onSystemEvent) {
      options.onSystemEvent('provider_fallback', `Provider fallback: ${primaryProvider} → ${fallbackProvider}`, {
        primary: primaryProvider,
        fallback: fallbackProvider,
        error: err.message,
      });
    }

    return await runWithProvider(fallbackProvider, { ...params, model: fallbackModel });
  }
}

module.exports = { chat };
