#!/usr/bin/env node

/**
 * NOX Chatbot — Idempotent Seed Script
 * Inserts all default config, guardrails, tone rules, and scenarios.
 * Safe to run multiple times — uses INSERT OR REPLACE / INSERT OR IGNORE.
 *
 * Can be required and called via runSeed(db), or run standalone with `node scripts/seed.js`.
 */

const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const {
  config,
  guardrails,
  toneRules,
  baselineFields,
  allScenarios,
} = require('../src/config/defaults');

function runSeed(db) {
  // --- Seed Config ---
  const upsertConfig = db.prepare(`
    INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now', '+2 hours'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', '+2 hours')
  `);

  const seedConfig = db.transaction(() => {
    for (const [key, value] of Object.entries(config)) {
      upsertConfig.run(key, value);
    }
  });
  seedConfig();
  console.log(`[NOX] Seed — Config: ${Object.keys(config).length} keys`);

  // --- Seed Guardrails ---
  const seedGuardrails = db.transaction(() => {
    db.prepare('DELETE FROM guardrails').run();
    const insert = db.prepare('INSERT INTO guardrails (rule, description, active) VALUES (?, ?, 1)');
    for (const g of guardrails) {
      insert.run(g.rule, g.description);
    }
  });
  seedGuardrails();
  console.log(`[NOX] Seed — Guardrails: ${guardrails.length} rules`);

  // --- Seed Tone Rules ---
  const seedToneRules = db.transaction(() => {
    db.prepare('DELETE FROM tone_rules').run();
    const insert = db.prepare(`
      INSERT INTO tone_rules (rule_type, content, context, active, sort_order)
      VALUES (?, ?, ?, 1, ?)
    `);
    let order = 0;
    for (const rule of toneRules) {
      insert.run(rule.rule_type, rule.content, rule.context || null, order++);
    }
  });
  seedToneRules();
  console.log(`[NOX] Seed — Tone rules: ${toneRules.length} rules`);

  // --- Seed Scenarios + Fields ---
  const seedScenarios = db.transaction(() => {
    const upsertScenario = db.prepare(`
      INSERT INTO scenarios (sop_number, name, display_name, description, category, build_status, device_type, enabled, priority, troubleshooting_steps, handover_trigger, notes)
      VALUES (@sop_number, @name, @display_name, @description, @category, @build_status, @device_type, 1, @priority, @troubleshooting_steps, @handover_trigger, @notes)
      ON CONFLICT(sop_number) DO UPDATE SET
        name = excluded.name,
        display_name = excluded.display_name,
        description = excluded.description,
        category = excluded.category,
        build_status = excluded.build_status,
        device_type = excluded.device_type,
        troubleshooting_steps = excluded.troubleshooting_steps,
        handover_trigger = excluded.handover_trigger,
        notes = excluded.notes
    `);

    const deleteFields = db.prepare('DELETE FROM scenario_fields WHERE scenario_id = ?');

    const insertField = db.prepare(`
      INSERT INTO scenario_fields (scenario_id, field_name, display_name, field_type, description, validation_hint, required, is_baseline, select_options, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const getScenarioId = db.prepare('SELECT id FROM scenarios WHERE sop_number = ?');

    let scenarioCount = 0;
    let fieldCount = 0;

    for (const scenario of allScenarios) {
      upsertScenario.run({
        sop_number: scenario.sop_number,
        name: scenario.name,
        display_name: scenario.display_name,
        description: scenario.description,
        category: scenario.category,
        build_status: scenario.build_status,
        device_type: scenario.device_type || null,
        priority: scenario.priority || 0,
        troubleshooting_steps: scenario.troubleshooting_steps || null,
        handover_trigger: scenario.handover_trigger || null,
        notes: scenario.notes || null,
      });

      const row = getScenarioId.get(scenario.sop_number);
      const scenarioId = row.id;

      deleteFields.run(scenarioId);

      for (const bf of baselineFields) {
        insertField.run(
          scenarioId,
          bf.field_name,
          bf.display_name,
          bf.field_type || 'text',
          bf.description || null,
          bf.validation_hint || null,
          bf.required ? 1 : 0,
          1,
          bf.select_options || null,
          bf.sort_order || 0
        );
        fieldCount++;
      }

      if (scenario.fields) {
        for (const f of scenario.fields) {
          insertField.run(
            scenarioId,
            f.field_name,
            f.display_name,
            f.field_type || 'text',
            f.description || null,
            f.validation_hint || null,
            f.required ? 1 : 0,
            0,
            f.select_options || null,
            f.sort_order || 0
          );
          fieldCount++;
        }
      }

      scenarioCount++;
    }

    return { scenarioCount, fieldCount };
  });

  const { scenarioCount, fieldCount } = seedScenarios();
  console.log(`[NOX] Seed — Scenarios: ${scenarioCount} (${fieldCount} fields)`);

  // --- Seed SOP Mock Tools ---
  const sopMockTools = [
    {
      scenario_sop: 'SOP-001',
      tool_name: 'lookup_order',
      display_name: 'Order Lookup',
      description: 'Look up order status, tracking information, and courier details using the order number.',
      tool_type: 'mock',
      input_schema: JSON.stringify({
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'Order number (format: B########-01)' }
        },
        required: ['order_number']
      }),
      configuration: JSON.stringify({
        responses: [
          { condition: "order_number contains '001'", data: { status: 'With courier', tracking_number: 'TCG-887321', courier: 'The Courier Guy', expected_delivery: '2-3 business days', last_update: '2025-01-15 09:30' } },
          { condition: "order_number contains '002'", data: { status: 'Ready for collection', collection_point: 'Sandton City Bash Store', collection_deadline: '2025-01-20', last_update: '2025-01-14 14:00' } },
          { condition: "order_number contains '003'", data: { status: 'Processing', estimated_dispatch: '1-2 business days', last_update: '2025-01-15 11:00' } },
          { condition: 'default', data: { status: 'Not found', message: 'No order found with this number. Please verify the order number and try again.' } }
        ]
      })
    },
    {
      scenario_sop: 'SOP-002',
      tool_name: 'lookup_invoice',
      display_name: 'Invoice Lookup',
      description: 'Check if an invoice is available for an order and retrieve invoice details.',
      tool_type: 'mock',
      input_schema: JSON.stringify({
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'Order number' }
        },
        required: ['order_number']
      }),
      configuration: JSON.stringify({
        responses: [
          { condition: "order_number contains '001'", data: { invoice_available: true, invoice_number: 'INV-2025-04821', amount: 'R 1,299.00', date: '2025-01-10', can_email: true } },
          { condition: "order_number contains '002'", data: { invoice_available: false, reason: 'Split payment order — invoice generation requires manual processing', is_split_payment: true } },
          { condition: 'default', data: { invoice_available: false, reason: 'Invoice not found for this order' } }
        ]
      })
    },
    {
      scenario_sop: 'SOP-009',
      tool_name: 'check_refund_status',
      display_name: 'Refund Status Check',
      description: 'Check the current status of a refund using the order number.',
      tool_type: 'mock',
      input_schema: JSON.stringify({
        type: 'object',
        properties: {
          order_number: { type: 'string', description: 'Order number' }
        },
        required: ['order_number']
      }),
      configuration: JSON.stringify({
        responses: [
          { condition: "order_number contains '001'", data: { refund_status: 'Processed', amount: 'R 599.00', method: 'Credit card', processed_date: '2025-01-12', expected_in_account: '3-5 business days from processed date', reference: 'REF-2025-09921' } },
          { condition: "order_number contains '002'", data: { refund_status: 'Pending', amount: 'R 1,299.00', method: 'EFT', submitted_date: '2025-01-14', expected_processing: '5-7 business days', reference: 'REF-2025-10032' } },
          { condition: 'default', data: { refund_status: 'Not found', message: 'No refund record found for this order' } }
        ]
      })
    },
    {
      scenario_sop: 'SOP-010',
      tool_name: 'check_transaction',
      display_name: 'Transaction Lookup',
      description: 'Check whether an order was generated for a specific transaction.',
      tool_type: 'mock',
      input_schema: JSON.stringify({
        type: 'object',
        properties: {
          amount: { type: 'string', description: 'Transaction amount in ZAR' },
          payment_method: { type: 'string', description: 'Payment method used' },
          transaction_date: { type: 'string', description: 'Date of transaction' }
        },
        required: ['amount']
      }),
      configuration: JSON.stringify({
        responses: [
          { condition: "amount contains '599'", data: { order_found: true, order_number: 'B10048823-01', status: 'Confirmed', amount: 'R 599.00' } },
          { condition: 'default', data: { order_found: false, message: 'No matching order found. An auto-reversal may take 3-5 business days.', reversal_window: '3-5 business days' } }
        ]
      })
    }
  ];

  const seedTools = db.transaction(() => {
    const getScenarioId = db.prepare('SELECT id FROM scenarios WHERE sop_number = ?');
    const upsertTool = db.prepare(`
      INSERT INTO sop_tools (scenario_id, tool_name, display_name, description, tool_type, configuration, input_schema)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
    `);
    // Check if tool already exists before inserting
    const checkTool = db.prepare('SELECT id FROM sop_tools WHERE scenario_id = ? AND tool_name = ?');

    let toolCount = 0;
    for (const tool of sopMockTools) {
      const row = getScenarioId.get(tool.scenario_sop);
      if (!row) continue;
      const existing = checkTool.get(row.id, tool.tool_name);
      if (existing) continue;
      upsertTool.run(row.id, tool.tool_name, tool.display_name, tool.description, tool.tool_type, tool.configuration, tool.input_schema);
      toolCount++;
    }
    return toolCount;
  });

  const toolCount = seedTools();
  console.log(`[NOX] Seed — SOP Tools: ${toolCount} mock tools`);
}

// --- Standalone execution ---
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

  const DB_PATH = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'nox.db'));
  const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log('NOX Seed Script');
  console.log('================');
  console.log(`Database: ${DB_PATH}`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);
  console.log('[OK] Schema applied');

  runSeed(db);

  // Verification
  console.log('\n--- Verification ---');
  const configCount = db.prepare('SELECT COUNT(*) as count FROM config').get().count;
  const guardrailCount = db.prepare('SELECT COUNT(*) as count FROM guardrails').get().count;
  const toneRuleCount = db.prepare('SELECT COUNT(*) as count FROM tone_rules').get().count;
  const scCount = db.prepare('SELECT COUNT(*) as count FROM scenarios').get().count;
  const sfCount = db.prepare('SELECT COUNT(*) as count FROM scenario_fields').get().count;
  const fullCount = db.prepare("SELECT COUNT(*) as count FROM scenarios WHERE build_status = 'full'").get().count;
  const handoverCount = db.prepare("SELECT COUNT(*) as count FROM scenarios WHERE build_status = 'handover_only'").get().count;

  console.log(`  Config entries:      ${configCount}`);
  console.log(`  Guardrails:          ${guardrailCount}`);
  console.log(`  Tone rules:          ${toneRuleCount}`);
  console.log(`  Scenarios:           ${scCount} (${fullCount} full, ${handoverCount} handover-only)`);
  console.log(`  Scenario fields:     ${sfCount}`);
  console.log('\nSeed complete.');

  db.close();
}

module.exports = { runSeed };
