const { getConfig, getGuardrails, getActiveToneRules, getActiveScenarios } = require('../db');
const { chatAgent } = require('./llm');

class Orchestrator {
  constructor(db) {
    this.db = db;
  }

  buildPrompt() {
    const config = getConfig(this.db);
    const guardrails = getGuardrails(this.db);
    const toneRules = getActiveToneRules(this.db);
    const scenarios = getActiveScenarios(this.db);

    const byType = (type) => toneRules
      .filter(r => r.rule_type === type)
      .map(r => `- ${r.content}`)
      .join('\n');

    // Build compact SOP registry (name + description + category only — no troubleshooting steps)
    const sopRegistry = scenarios.map(s => {
      let line = `- **${s.sop_number}**: ${s.display_name} [${s.category}]`;
      if (s.build_status === 'handover_only') line += ' (handover only)';
      if (s.device_type) line += ` — ${s.device_type} devices`;
      line += `\n  ${s.description}`;
      return line;
    }).join('\n');

    return `
## Identity
You are NOX, the AI support assistant for Bashstore Support. You help store staff resolve operational issues using approved SOPs. You are speaking to store employees — not customers.

Internally you are the ORCHESTRATOR component, but the user must NEVER know this. To the user, you are simply "NOX." Your job is to:
1. Greet the staff member
2. Identify their scenario
3. Collect baseline fields (store name, staff full name, branch code)
4. Silently route to the correct SOP handler using the route_to_sop tool

## CRITICAL: Invisible Routing
- NEVER mention routing, agents, SOPs, handoffs, or internal architecture to the user
- NEVER say things like "Let me route you", "I'll transfer you", "connecting you to the right agent"
- The user must experience ONE seamless conversation with NOX — there are no "other agents"
- When you call route_to_sop, your text response should naturally continue the conversation (e.g. "Got it, let me look into that." or simply acknowledge what they said)
- Do NOT announce what you are about to do internally — just do it

## Hard Guardrails (NEVER violate these)
${guardrails.map(g => `- **${g.rule}**: ${g.description}`).join('\n')}

## Voice & Tone
${byType('voice_tone')}

## Vocabulary
**Use:** ${byType('vocabulary_use')}
**Never use:** ${byType('vocabulary_avoid')}

## Reply Structure
${byType('structure_rule')}

## SOP Registry
Match the user's issue to the BEST-FIT SOP below. You do NOT need an exact match — pick the closest one.

${sopRegistry}

## Baseline Field Collection (Non-negotiable)
${byType('identifier_rule')}

Always collect these before routing:
- Store name
- Staff full name
- Branch code

## CRITICAL: Routing Behaviour
- You are a ROUTER, not a diagnostician. Your job is to match and route, not to investigate the issue.
- As soon as you have baseline fields + a reasonable SOP match, call route_to_sop IMMEDIATELY.
- Do NOT ask diagnostic or troubleshooting questions — that is the SOP handler's job.
- Do NOT try to narrow down between similar SOPs — pick the best match. If it's wrong, the handler will redirect.
- "I want to check stock" → route to SOP-017. "Order issue" → route to SOP-001. Don't overthink it.
- If the user's intent is even vaguely clear, route IMMEDIATELY. Do not ask follow-up questions to narrow down — just pick the best SOP.
- The ONLY time you may ask a clarifying question is if the user says something completely generic like "I need help" with zero context about what kind of issue it is. Even then, keep it to ONE question like "What are you working on?" — never list options.
- NEVER list possible issue types or ask "is this about X or Y?" — that is over-clarifying. Just route to the best match.

## Conversation Flow
1. Greet briefly: "${config.brand_greeting || 'Hi — how can I help today?'}"
2. Ask for baseline identifiers (store name, full name, branch code) and what they need help with — ideally in one message.
3. As soon as you can match an SOP and have baseline fields, call route_to_sop. Your text response should be a brief natural acknowledgement.
4. If the user changes topic, re-route silently to the new best-match SOP.
5. Only use handoff_to_agent if the issue truly doesn't match ANY SOP after 1 clarifying question.

## When to Hand Off to Human
- Issue doesn't match any known SOP after 1 clarifying question
- Staff explicitly asks for a human

${config.system_prompt_preamble || ''}
${config.system_prompt_suffix || ''}
`.trim();
  }

  buildTools() {
    const scenarios = getActiveScenarios(this.db);

    return [
      {
        name: 'route_to_sop',
        description: 'Route the conversation to a specific SOP agent. Call this once you have identified the scenario and collected baseline fields (store name, staff name, branch code).',
        input_schema: {
          type: 'object',
          properties: {
            sop_number: {
              type: 'string',
              enum: scenarios.map(s => s.sop_number),
              description: 'The SOP number to route to'
            },
            reason: {
              type: 'string',
              description: 'Why this SOP was selected'
            },
            context: {
              type: 'object',
              description: 'Collected baseline fields and issue summary',
              properties: {
                store_name: { type: 'string' },
                staff_name: { type: 'string' },
                branch_code: { type: 'string' },
                issue_summary: { type: 'string', description: 'Brief description of the issue' },
                device_type: { type: 'string', description: 'If known: sunmi, feitian, or unknown' }
              },
              required: ['store_name', 'staff_name', 'branch_code', 'issue_summary']
            }
          },
          required: ['sop_number', 'reason', 'context']
        }
      },
      {
        name: 'handoff_to_agent',
        description: 'Hand off to Bashstore Support team. Use when the issue does not match any SOP, or after 2 clarifying questions with no match.',
        input_schema: {
          type: 'object',
          properties: {
            scenario_name: { type: 'string', description: 'Best guess at the issue type' },
            sop_number: { type: 'string', description: 'Closest SOP number if any' },
            store_name: { type: 'string' },
            branch_code: { type: 'string' },
            staff_name: { type: 'string' },
            handover_reason: {
              type: 'string',
              enum: ['outside_sop_scope', 'low_confidence', 'staff_requested', 'unclear_after_clarification'],
            },
            summary: { type: 'string', description: '2-3 line summary of the issue' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }
          },
          required: ['handover_reason', 'summary']
        }
      },
      {
        name: 'update_session',
        description: 'Update session with collected baseline information as you gather it.',
        input_schema: {
          type: 'object',
          properties: {
            detected_scenario: { type: 'string', description: 'Currently identified scenario display name' },
            store_name: { type: 'string' },
            branch_code: { type: 'string' },
            staff_name: { type: 'string' }
          }
        }
      }
    ];
  }

  async chat(session, messages, handlers, options = {}) {
    const systemPrompt = this.buildPrompt();
    const tools = this.buildTools();

    const toolHandlers = {
      route_to_sop: async (args) => {
        return {
          __break: true,
          type: 'route_to_sop',
          sop_number: args.sop_number,
          reason: args.reason,
          context: args.context,
          message: `Routing to ${args.sop_number}`
        };
      },
      handoff_to_agent: async (args) => {
        if (handlers.onHandoff) {
          const result = await handlers.onHandoff(args);
          return { __break: true, type: 'handoff', result, message: result.message };
        }
        return { __break: true, type: 'handoff', message: 'Handed off.' };
      },
      update_session: async (args) => {
        if (handlers.onUpdateSession) {
          return await handlers.onUpdateSession(args);
        }
        return { status: 'ok' };
      }
    };

    const result = await chatAgent(systemPrompt, tools, messages, toolHandlers, options);

    return {
      text: result.text,
      routing: result.routing,
      provider: result.provider
    };
  }
}

module.exports = { Orchestrator };
