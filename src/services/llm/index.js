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

/**
 * Lower-level agent chat — accepts explicit systemPrompt, tools, and toolHandlers.
 * Used by Orchestrator and SOPAgent in the swarm architecture.
 *
 * toolHandlers: { [toolName]: async (args) => result }
 *   - If a handler returns { __break: true, ...data }, the loop stops and data is returned.
 *   - Otherwise the handler result is fed back to Claude as a tool result.
 */
async function chatAgent(systemPrompt, tools, messages, toolHandlers = {}, options = {}) {
  const db = getDb();
  const config = getConfig(db);
  const { normalizeToolDefs } = require('./format');

  const normalizedTools = normalizeToolDefs(tools);

  const primaryProvider = config.llm_provider || process.env.LLM_PROVIDER || 'anthropic';
  const temperature = parseFloat(config.temperature) || 0.3;
  const maxTokens = parseInt(config.max_tokens, 10) || 1024;

  const configModel = config.model_name;
  const modelMatchesProvider =
    (primaryProvider === 'anthropic' && configModel && configModel.startsWith('claude')) ||
    (primaryProvider === 'openai' && configModel && (configModel.startsWith('gpt') || configModel.startsWith('o')));
  const model = modelMatchesProvider ? configModel : DEFAULT_MODELS[primaryProvider];

  const provider = providers[primaryProvider]();
  let formattedMessages = provider.formatMessages([...messages]);

  // Safety: Claude API requires messages to end with a user message.
  // Strip trailing assistant messages to prevent 400 errors.
  while (formattedMessages.length > 0 && formattedMessages[formattedMessages.length - 1].role === 'assistant') {
    formattedMessages.pop();
  }

  // Safety: ensure messages alternate properly (no consecutive same-role messages).
  // Merge consecutive same-role messages if found.
  const deduped = [];
  for (const msg of formattedMessages) {
    if (deduped.length > 0 && deduped[deduped.length - 1].role === msg.role) {
      const prev = deduped[deduped.length - 1];
      if (typeof prev.content === 'string' && typeof msg.content === 'string') {
        prev.content = prev.content + '\n\n' + msg.content;
      }
      continue;
    }
    deduped.push(msg);
  }
  formattedMessages = deduped;

  let currentMessages = formattedMessages;
  let finalText = '';
  let routingResult = null;

  for (let turn = 0; turn < MAX_TOOL_ROUNDS; turn++) {
    const result = await provider.callModel({
      model,
      maxTokens,
      temperature,
      systemPrompt,
      tools: normalizedTools,
      messages: currentMessages,
      timeout: TIMEOUT_MS,
    });

    if (result.text) {
      finalText = result.text;
    }

    if (result.done) break;

    // Log tool calls
    if (options.onSystemEvent) {
      const toolNames = result.toolCalls.map(t => t.name).join(', ');
      options.onSystemEvent('tool_call', `Tool call: ${toolNames}`, {
        tools: result.toolCalls.map(t => ({ name: t.name, input_keys: Object.keys(t.arguments || {}) })),
      });
    }

    const processedResults = [];
    let shouldBreak = false;

    for (const toolCall of result.toolCalls) {
      const handler = toolHandlers[toolCall.name];
      if (!handler) {
        processedResults.push({
          toolCallId: toolCall.id,
          content: JSON.stringify({ status: 'ok', message: `Tool ${toolCall.name} executed.` }),
        });
        continue;
      }

      const handlerResult = await handler(toolCall.arguments);

      if (handlerResult && handlerResult.__break) {
        routingResult = handlerResult;
        shouldBreak = true;
        // Still provide a tool result so the conversation is valid
        processedResults.push({
          toolCallId: toolCall.id,
          content: JSON.stringify({ status: 'ok', message: handlerResult.message || 'Routing.' }),
        });
        break;
      }

      processedResults.push({
        toolCallId: toolCall.id,
        content: JSON.stringify(handlerResult),
      });
    }

    if (shouldBreak) break;

    const newMessages = provider.buildToolResultMessages(result.raw, processedResults);
    currentMessages = [...currentMessages, ...newMessages];
  }

  return { text: finalText, routing: routingResult, provider: primaryProvider };
}

module.exports = { chat, chatAgent };
