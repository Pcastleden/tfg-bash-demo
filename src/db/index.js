const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'db', 'nox.db'));
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');

let db;

function getDb() {
  if (!db) {
    // Ensure database directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    // Migrations — add columns that may not exist in older databases
    const handoffCols = db.prepare("PRAGMA table_info(handoffs)").all().map(c => c.name);
    if (!handoffCols.includes('staff_name')) {
      db.exec('ALTER TABLE handoffs ADD COLUMN staff_name TEXT');
    }
  }
  return db;
}

// --- Config helpers ---

function getConfig(database) {
  const d = database || getDb();
  const rows = d.prepare('SELECT key, value FROM config').all();
  const config = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

function setConfig(key, value) {
  const d = getDb();
  d.prepare(`
    INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now', '+2 hours'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', '+2 hours')
  `).run(key, value);
}

// --- Guardrails helpers ---

function getGuardrails(database) {
  const d = database || getDb();
  return d.prepare('SELECT * FROM guardrails WHERE active = 1').all();
}

// --- Tone rules helpers ---

function getActiveToneRules(database) {
  const d = database || getDb();
  return d.prepare('SELECT * FROM tone_rules WHERE active = 1 ORDER BY sort_order, id').all();
}

// --- Scenario helpers ---

function getActiveScenarios(database) {
  const d = database || getDb();
  const scenarios = d.prepare('SELECT * FROM scenarios WHERE enabled = 1 ORDER BY sop_number').all();

  for (const scenario of scenarios) {
    scenario.fields = d.prepare(
      'SELECT * FROM scenario_fields WHERE scenario_id = ? ORDER BY sort_order, id'
    ).all(scenario.id);
  }

  return scenarios;
}

function getScenarioByName(name) {
  const d = getDb();
  const scenario = d.prepare('SELECT * FROM scenarios WHERE name = ? AND enabled = 1').get(name);
  if (scenario) {
    scenario.fields = d.prepare(
      'SELECT * FROM scenario_fields WHERE scenario_id = ? ORDER BY sort_order, id'
    ).all(scenario.id);
  }
  return scenario;
}

module.exports = {
  getDb,
  getConfig,
  setConfig,
  getGuardrails,
  getActiveToneRules,
  getActiveScenarios,
  getScenarioByName,
};
