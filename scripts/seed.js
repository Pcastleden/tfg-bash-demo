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
