const { getGuardrails, getActiveToneRules, getSOPTools, getSOPTool } = require('../db');
const { chatAgent } = require('./llm');
const { renderTroubleshootingSteps, formatFullScenario } = require('../prompts/builder');

class SOPAgent {
  constructor(db, scenario) {
    this.db = db;
    this.scenario = scenario;
  }

  /**
   * Build the shared agent preamble — compact tone + guardrails injected into every SOP agent.
   */
  buildPreamble() {
    const guardrails = getGuardrails(this.db);
    const toneRules = getActiveToneRules(this.db);

    const coreTone = toneRules
      .filter(r => r.rule_type === 'voice_tone')
      .map(r => `- ${r.content}`)
      .join('\n');

    const escalationPhrases = toneRules
      .filter(r => r.rule_type === 'escalation_phrase')
      .map(r => `- ${r.content}`)
      .join('\n');

    return `
## Context
You are NOX, the Bashstore Support assistant. You are speaking to store staff (not customers).
You must NEVER mention agents, routing, SOPs, orchestrators, or any internal architecture. The user sees one assistant: NOX.

## Tone (always apply)
${coreTone}

## Hard Guardrails (NEVER violate)
${guardrails.map(g => `- ${g.rule}: ${g.description}`).join('\n')}

## Escalation Language
${escalationPhrases}

## Conversation Continuity (CRITICAL)
You are picking up a conversation already in progress. The full conversation history is provided to you.
- NEVER re-introduce yourself or re-greet the user
- NEVER re-ask for information already provided in the conversation (e.g. order number, store name, staff name)
- Continue the conversation naturally as if you are the same assistant — the user must NOT notice any agent switch
- Reference information already given: "Let me look into order B12345678-01 for you" not "Do you have the order number?"
- Your first response should flow naturally from the last thing the user said

## Your responsibilities
- Collect any remaining SOP-specific fields that haven't been provided yet
- Guide through troubleshooting steps
- Check results after each step batch
- Call handoff_to_agent when handover triggers are met
- Call return_to_orchestrator if the user raises a different issue
- NEVER answer questions outside your SOP scope — return to orchestrator instead
`.trim();
  }

  /**
   * Build the SOP-specific prompt section.
   */
  buildSOPPrompt(routingContext) {
    const s = this.scenario;

    const nonBaselineFields = s.fields
      .filter(f => !f.is_baseline)
      .map(f => {
        let line = `- **${f.display_name}** (${f.field_name})`;
        if (f.required) line += ' [REQUIRED]';
        if (f.validation_hint) line += ` — ${f.validation_hint}`;
        if (f.description) line += ` — ${f.description}`;
        if (f.field_type === 'select' && f.select_options) {
          line += ` [Options: ${f.select_options}]`;
        }
        return line;
      })
      .join('\n');

    const steps = s.troubleshooting_steps
      ? renderTroubleshootingSteps(s.troubleshooting_steps)
      : '';

    let handoverSection = '';
    if (s.handover_trigger) {
      handoverSection = `\n## When to Hand Over\n${s.handover_trigger}`;
    }

    const contextLines = [];
    if (routingContext.store_name) contextLines.push(`- Store: ${routingContext.store_name}`);
    if (routingContext.staff_name) contextLines.push(`- Staff: ${routingContext.staff_name}`);
    if (routingContext.branch_code) contextLines.push(`- Branch: ${routingContext.branch_code}`);
    if (routingContext.issue_summary) contextLines.push(`- Issue: ${routingContext.issue_summary}`);
    if (routingContext.device_type) contextLines.push(`- Device: ${routingContext.device_type}`);

    return `
## Your SOP: ${s.sop_number} — ${s.display_name}
**Category:** ${s.category}
**Build status:** ${s.build_status}
${s.device_type ? `**Device:** ${s.device_type} only` : ''}

**Description:** ${s.description}

## Already Collected (from orchestrator)
${contextLines.join('\n') || '(none)'}

IMPORTANT: The conversation history may contain additional information beyond what is listed above. Read the full history carefully — the user may have already provided order numbers, customer names, or other details. Do NOT ask for anything already mentioned in the conversation.

## SOP-Specific Fields Still Needed
Only ask for fields below that have NOT already been provided in the conversation:
${nonBaselineFields || '(no additional fields needed)'}

${s.build_status === 'full' ? `## Troubleshooting Steps\n${steps}` : '## Action\nFor this issue type, collect the remaining fields, confirm you understand the issue, then escalate to the Bashstore Support team using handoff_to_agent. Do NOT mention "handing over" or "escalating" — just say you are getting the right team to help.'}
${handoverSection}

${s.notes ? `## Notes\n${s.notes}` : ''}
`.trim();
  }

  /**
   * Build the full system prompt for this SOP agent.
   */
  buildPrompt(routingContext) {
    return `${this.buildPreamble()}\n\n${this.buildSOPPrompt(routingContext)}`;
  }

  /**
   * Build tools for this SOP agent (built-in + SOP-specific from database).
   */
  buildTools() {
    const s = this.scenario;
    const scenarios = require('../db').getActiveScenarios(this.db);

    const tools = [
      {
        name: 'return_to_orchestrator',
        description: 'Return control to the orchestrator. Use when: the user raises a new/different issue, the current SOP is resolved, or the issue does not match this SOP.',
        input_schema: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              enum: ['new_issue', 'resolved', 'wrong_sop', 'user_requested'],
              description: 'Why returning to orchestrator'
            },
            summary: {
              type: 'string',
              description: 'Summary of what was done/discussed in this SOP'
            },
            new_issue_hint: {
              type: 'string',
              description: 'If reason is new_issue, describe what the user is now asking about'
            }
          },
          required: ['reason', 'summary']
        }
      },
      {
        name: 'handoff_to_agent',
        description: 'Hand off to Bashstore Support team. Use when troubleshooting is exhausted, device is Feitian, or handover triggers are met.',
        input_schema: {
          type: 'object',
          properties: {
            scenario_name: { type: 'string', description: 'The SOP scenario name' },
            sop_number: {
              type: 'string',
              enum: scenarios.map(sc => sc.sop_number),
              description: 'The SOP number'
            },
            store_name: { type: 'string' },
            branch_code: { type: 'string' },
            staff_name: { type: 'string' },
            device_type: { type: 'string', enum: ['sunmi', 'feitian', 'n/a'] },
            device_serial: { type: 'string' },
            order_number: { type: 'string' },
            steps_tried: {
              type: 'array',
              items: { type: 'string' },
              description: 'Troubleshooting steps already attempted'
            },
            current_error: { type: 'string', description: 'What the store currently sees' },
            handover_reason: {
              type: 'string',
              enum: [
                'troubleshooting_exhausted', 'feitian_device', 'handover_only_scenario',
                'low_confidence', 'staff_requested', 'unclear_after_clarification', 'outside_sop_scope'
              ]
            },
            what_needed_next: { type: 'string' },
            summary: { type: 'string', description: '2-3 line summary' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }
          },
          required: ['scenario_name', 'sop_number', 'handover_reason', 'summary', 'store_name', 'branch_code']
        }
      }
    ];

    // Add SOP-specific tools from database
    const sopTools = getSOPTools(s.id, this.db);
    for (const tool of sopTools) {
      tools.push({
        name: tool.tool_name,
        description: tool.description,
        input_schema: JSON.parse(tool.input_schema)
      });
    }

    return tools;
  }

  /**
   * Execute a mock tool — evaluate conditions against input and return matching response.
   */
  handleMockTool(tool, input) {
    const config = JSON.parse(tool.configuration);
    const responses = config.responses || [];

    for (const resp of responses) {
      if (resp.condition === 'default') continue;

      // Parse condition: "field_name contains 'value'" or "field_name starts with 'value'"
      const match = resp.condition.match(/^(\w+)\s+(contains|starts with|equals)\s+'([^']+)'$/i);
      if (!match) continue;

      const [, field, op, value] = match;
      const inputValue = String(input[field] || '');

      let passes = false;
      switch (op.toLowerCase()) {
        case 'contains': passes = inputValue.includes(value); break;
        case 'starts with': passes = inputValue.startsWith(value); break;
        case 'equals': passes = inputValue === value; break;
      }

      if (passes) return resp.data;
    }

    // Fall back to default
    const defaultResp = responses.find(r => r.condition === 'default');
    return defaultResp ? defaultResp.data : { status: 'error', message: 'No matching response' };
  }

  /**
   * Execute an API tool — make HTTP request (future).
   */
  async handleAPITool(tool, input) {
    const config = JSON.parse(tool.configuration);
    // Build URL with parameter substitution
    let url = config.endpoint;
    for (const [key, value] of Object.entries(input)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }

    const response = await fetch(url, {
      method: config.method || 'GET',
      headers: config.headers || {},
      signal: AbortSignal.timeout(config.timeout_ms || 5000),
    });

    const data = await response.json();

    // Apply response mapping if configured
    if (config.response_mapping) {
      const mapped = {};
      for (const [key, path] of Object.entries(config.response_mapping)) {
        mapped[key] = resolvePath(data, path);
      }
      return mapped;
    }

    return data;
  }

  async chat(session, messages, routingContext, handlers, options = {}) {
    const systemPrompt = this.buildPrompt(routingContext);
    const tools = this.buildTools();

    const toolHandlers = {
      return_to_orchestrator: async (args) => {
        return {
          __break: true,
          type: 'return_to_orchestrator',
          reason: args.reason,
          summary: args.summary,
          new_issue_hint: args.new_issue_hint,
          message: `Returning to orchestrator: ${args.reason}`
        };
      },
      handoff_to_agent: async (args) => {
        if (handlers.onHandoff) {
          const result = await handlers.onHandoff(args);
          return { __break: true, type: 'handoff', result, message: result.message };
        }
        return { __break: true, type: 'handoff', message: 'Handed off.' };
      }
    };

    // Add SOP-specific tool handlers
    const sopTools = getSOPTools(this.scenario.id, this.db);
    for (const tool of sopTools) {
      toolHandlers[tool.tool_name] = async (input) => {
        switch (tool.tool_type) {
          case 'mock':
            return this.handleMockTool(tool, input);
          case 'api_call':
            return await this.handleAPITool(tool, input);
          default:
            return { status: 'error', message: `Unsupported tool type: ${tool.tool_type}` };
        }
      };
    }

    const result = await chatAgent(systemPrompt, tools, messages, toolHandlers, options);

    return {
      text: result.text,
      routing: result.routing,
      provider: result.provider
    };
  }
}

/**
 * Resolve a JSONPath-like expression ($.data.status) against an object.
 */
function resolvePath(obj, pathStr) {
  const parts = pathStr.replace(/^\$\.?/, '').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return null;
    current = current[part];
  }
  return current;
}

module.exports = { SOPAgent };
