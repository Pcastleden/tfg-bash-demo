-- NOX Chatbot — SQLite Schema

-- Core configuration
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);

-- Tone and language rules (from Communication Guidance doc)
CREATE TABLE IF NOT EXISTS tone_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type TEXT NOT NULL CHECK(rule_type IN (
    'voice_tone',
    'vocabulary_use',
    'vocabulary_avoid',
    'structure_rule',
    'reusable_phrase',
    'forbidden_phrase',
    'identifier_rule',
    'step_delivery_rule',
    'uncertainty_rule',
    'escalation_phrase'
  )),
  content TEXT NOT NULL,
  context TEXT,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);

-- Hard guardrails (non-negotiable, view-only in admin)
CREATE TABLE IF NOT EXISTS guardrails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule TEXT NOT NULL,
  description TEXT,
  active INTEGER DEFAULT 1
);

-- SOP / Scenario definitions
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sop_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  build_status TEXT NOT NULL DEFAULT 'handover_only'
    CHECK(build_status IN ('full', 'handover_only')),
  device_type TEXT CHECK(device_type IN ('sunmi', 'feitian', 'any', NULL)),
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  troubleshooting_steps TEXT,
  handover_trigger TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);

-- Required fields per scenario
CREATE TABLE IF NOT EXISTS scenario_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  description TEXT,
  validation_hint TEXT,
  required INTEGER DEFAULT 1,
  is_baseline INTEGER DEFAULT 0,
  select_options TEXT,
  sort_order INTEGER DEFAULT 0
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'handed_off', 'completed', 'abandoned')),
  detected_scenario TEXT,
  scenario_history TEXT,
  store_name TEXT,
  branch_code TEXT,
  staff_name TEXT,
  collected_data TEXT,
  operating_mode TEXT DEFAULT 'stage_a' CHECK(operating_mode IN ('stage_a', 'stage_b')),
  created_at DATETIME DEFAULT (datetime('now', '+2 hours')),
  updated_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);

-- Chat messages
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_use TEXT,
  created_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);

-- Handoff log
CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  scenario_name TEXT NOT NULL,
  sop_number TEXT NOT NULL,
  store_name TEXT,
  branch_code TEXT,
  staff_name TEXT,
  device_type TEXT,
  device_serial TEXT,
  order_number TEXT,
  collected_data TEXT NOT NULL,
  steps_tried TEXT,
  current_error TEXT,
  handover_reason TEXT NOT NULL,
  what_needed_next TEXT,
  summary TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  created_at DATETIME DEFAULT (datetime('now', '+2 hours'))
);
