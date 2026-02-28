const { getConfig, getGuardrails, getActiveToneRules, getActiveScenarios } = require('../db');

/**
 * Render structured troubleshooting_steps JSON into natural language for the system prompt.
 */
function renderTroubleshootingSteps(stepsJson) {
  const data = typeof stepsJson === 'string' ? JSON.parse(stepsJson) : stepsJson;
  let output = '';

  // Hard split (Sunmi vs Feitian)
  if (data.hard_split) {
    output += `\n  **Device split:**\n`;
    output += `  - If ${data.hard_split.field} is Feitian: ${data.hard_split.feitian}\n`;
    output += `  - If ${data.hard_split.field} is Sunmi: ${data.hard_split.sunmi}\n`;
  }

  // Early escalation condition
  if (data.early_escalation) {
    output += `\n  **Early escalation:** If ${data.early_escalation.condition} → ${data.early_escalation.action}\n`;
  }

  // Important notes
  if (data.important_note) {
    output += `\n  **Important:** ${data.important_note}\n`;
  }

  // Scenario-specific guardrails
  if (data.scenario_guardrails) {
    output += `\n  **Scenario guardrails:**\n`;
    data.scenario_guardrails.forEach(g => { output += `  - ${g}\n`; });
  }

  // Step groups
  if (data.step_groups) {
    data.step_groups.forEach((group) => {
      output += `\n  **${group.label}:**\n`;
      if (group.condition) output += `  _Condition: ${group.condition}_\n`;
      group.steps.forEach((step, j) => {
        output += `  ${j + 1}. ${step}\n`;
      });
      if (group.check) {
        output += `  → Ask: "${group.check}"\n`;
      }
    });
  }

  // Support notes
  if (data.support_note) {
    output += `\n  **Support note:** ${data.support_note}\n`;
  }

  // Handover triggers
  if (data.handover_triggers) {
    output += `\n  **Hand over if:**\n`;
    data.handover_triggers.forEach(t => { output += `  - ${t}\n`; });
  }

  // Handover payload
  if (data.handover_payload) {
    output += `\n  **Include in handover:**\n`;
    data.handover_payload.forEach(p => { output += `  - ${p}\n`; });
  }

  return output;
}

/**
 * Format a full-build scenario (SOPs with complete troubleshooting flows).
 */
function formatFullScenario(scenario) {
  const fields = scenario.fields
    .filter(f => !f.is_baseline)
    .map(f => {
      let line = `  - **${f.display_name}** (${f.field_name})`;
      if (f.required) line += ' [REQUIRED]';
      else line += ' [OPTIONAL]';
      if (f.validation_hint) line += ` — ${f.validation_hint}`;
      if (f.description) line += ` — ${f.description}`;
      if (f.field_type === 'select' && f.select_options) {
        line += ` [Options: ${f.select_options}]`;
      }
      return line;
    })
    .join('\n');

  const steps = scenario.troubleshooting_steps
    ? renderTroubleshootingSteps(scenario.troubleshooting_steps)
    : '';

  return `### ${scenario.sop_number}: ${scenario.display_name}
  **Category:** ${scenario.category}
  **Description:** ${scenario.description}
  ${scenario.device_type ? `**Device:** ${scenario.device_type} only` : ''}
  **Required fields (beyond baseline):**
${fields}
${steps}`;
}

/**
 * Format a handover-only scenario.
 */
function formatHandoverScenario(scenario) {
  const fields = scenario.fields
    .filter(f => !f.is_baseline)
    .map(f => `  - **${f.display_name}** (${f.field_name})${f.required ? ' [REQUIRED]' : ''}`)
    .join('\n');

  return `### ${scenario.sop_number}: ${scenario.display_name}
  **Category:** ${scenario.category} | **Status:** Handover only
  **Description:** ${scenario.description}
  **Additional fields to collect:**
${fields || '  - (baseline fields only)'}`;
}

/**
 * Build the full system prompt dynamically from the database.
 */
function buildSystemPrompt(db) {
  const config = getConfig(db);
  const guardrails = getGuardrails(db);
  const toneRules = getActiveToneRules(db);
  const scenarios = getActiveScenarios(db);

  const byType = (type) => toneRules
    .filter(r => r.rule_type === type)
    .map(r => `- ${r.content}`)
    .join('\n');

  const fullScenarios = scenarios.filter(s => s.build_status === 'full');
  const handoverOnlyScenarios = scenarios.filter(s => s.build_status === 'handover_only');

  return `
## Identity
You are NOX, the AI support assistant for Bashstore Support. You help store staff resolve operational issues using approved SOPs. You are speaking to store employees — not customers.

## Hard Guardrails (NEVER violate these)
${guardrails.map(g => `- **${g.rule}**: ${g.description}`).join('\n')}

## Voice & Tone
${byType('voice_tone')}

## Vocabulary
**Use these words and phrases:**
${byType('vocabulary_use')}

**NEVER use these words or phrases:**
${byType('vocabulary_avoid')}
${byType('forbidden_phrase')}

## Reply Structure
${byType('structure_rule')}

## Identifier Collection (Non-negotiable)
${byType('identifier_rule')}

**Baseline fields (collect on EVERY conversation):**
- Store name
- Staff full name
- Branch code

## Step Delivery
${byType('step_delivery_rule')}

## Handling Uncertainty
${byType('uncertainty_rule')}

## Scenarios — Full Troubleshooting (SOPs with complete flows)
These scenarios have complete troubleshooting paths. Guide the staff member through the steps, checking results at each stage. Hand over only if troubleshooting fails or the SOP instructs handover.

${fullScenarios.map(s => formatFullScenario(s)).join('\n\n')}

## Scenarios — Recognised, Handover Only
These scenarios are recognised but do not yet have troubleshooting flows. When detected:
1. Acknowledge the issue by name.
2. Collect all baseline identifiers + any scenario-specific fields.
3. Confirm understanding of the problem.
4. Hand over with a structured summary.
5. Tell the staff member: "This scenario is best handled directly by the support team. I've collected your details and will hand over now."

${handoverOnlyScenarios.map(s => formatHandoverScenario(s)).join('\n\n')}

## Conversation Flow
1. Greet briefly: "${config.brand_greeting}"
2. Identify the scenario through natural conversation. If unclear, ask: "${config.routing_question}"
3. Collect baseline identifiers (store name, full name, branch code) first.
4. Collect scenario-specific identifiers.
5. For full scenarios: guide through troubleshooting steps. Check results after each batch.
6. For handover-only scenarios: acknowledge, collect, confirm, hand over.
7. If the staff member shifts to a different issue mid-conversation, acknowledge the shift and start collecting for the new scenario. You can handle multiple scenarios in one conversation.

## When to Hand Over
- The SOP path is exhausted and the issue is unresolved.
- The scenario is handover-only (SOPs 011–026 in POC).
- Device type is Feitian (always handover, no troubleshooting).
- Confidence is low / issue doesn't match any known SOP.
- Staff explicitly asks for a human.
- After 2 clarifying questions, the issue is still unclear.

## Handover Message Format
When handing over, use the handoff_to_agent tool with ALL collected information. The tool generates the structured handover message.

## Approved Reusable Phrases
${byType('reusable_phrase')}

## Escalation Language
${byType('escalation_phrase')}

${config.system_prompt_preamble || ''}
${config.system_prompt_suffix || ''}
`.trim();
}

/**
 * Build the dynamic tool definitions from the database.
 */
function buildTools(db) {
  const scenarios = getActiveScenarios(db);

  // Collect all unique fields across scenarios for the handoff schema
  const allFields = {};
  scenarios.forEach(s => {
    s.fields.forEach(f => {
      if (!allFields[f.field_name]) {
        allFields[f.field_name] = {
          type: 'string',
          description: f.display_name + (f.description ? `: ${f.description}` : '')
        };
      }
    });
  });

  return [
    {
      name: 'handoff_to_agent',
      description: `Hand the conversation over to the Bashstore Support team. Call this when:
        - Troubleshooting is exhausted and unresolved
        - Scenario is handover-only
        - Device is Feitian
        - Confidence is low
        - Staff requests a human
        You MUST include all collected identifiers and a structured summary.`,
      input_schema: {
        type: 'object',
        properties: {
          scenario_name: {
            type: 'string',
            description: 'The identified SOP scenario name'
          },
          sop_number: {
            type: 'string',
            enum: scenarios.map(s => s.sop_number),
            description: 'The SOP number (e.g. SOP-001)'
          },
          store_name: { type: 'string', description: 'Store name' },
          branch_code: { type: 'string', description: 'Branch code' },
          staff_name: { type: 'string', description: 'Staff member full name' },
          device_type: {
            type: 'string',
            enum: ['sunmi', 'feitian', 'n/a'],
            description: 'Device type if relevant'
          },
          device_serial: { type: 'string', description: 'Device serial number if relevant' },
          order_number: { type: 'string', description: 'Order number if relevant' },
          steps_tried: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of troubleshooting steps already attempted'
          },
          current_error: {
            type: 'string',
            description: 'Exact error message or what the store currently sees'
          },
          handover_reason: {
            type: 'string',
            enum: [
              'troubleshooting_exhausted',
              'feitian_device',
              'handover_only_scenario',
              'low_confidence',
              'staff_requested',
              'unclear_after_clarification',
              'outside_sop_scope'
            ],
            description: 'Why this is being handed over'
          },
          what_needed_next: {
            type: 'string',
            description: 'What the human agent needs to do next'
          },
          summary: {
            type: 'string',
            description: 'Structured 2-3 line summary of the issue'
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Priority based on issue severity and staff sentiment'
          },
          ...allFields
        },
        required: ['scenario_name', 'sop_number', 'handover_reason', 'summary', 'store_name', 'branch_code']
      }
    },
    {
      name: 'update_session',
      description: 'Update the session with collected information as you gather it. Call this each time you learn new identifying information.',
      input_schema: {
        type: 'object',
        properties: {
          detected_scenario: { type: 'string', description: 'Currently active SOP scenario' },
          store_name: { type: 'string' },
          branch_code: { type: 'string' },
          staff_name: { type: 'string' },
          additional_fields: {
            type: 'object',
            description: 'Any scenario-specific fields collected (key-value pairs)'
          }
        }
      }
    }
  ];
}

module.exports = {
  buildSystemPrompt,
  buildTools,
  renderTroubleshootingSteps,
  formatFullScenario,
  formatHandoverScenario,
};
