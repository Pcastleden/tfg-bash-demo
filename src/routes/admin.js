const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  getDb,
  getConfig,
  setConfig,
  getGuardrails,
  getActiveToneRules,
  getActiveScenarios,
} = require('../db');
const { buildSystemPrompt } = require('../prompts/builder');
const defaults = require('../config/defaults');

/** Wrap an async/sync route handler with try/catch so DB errors return 500. */
function safe(fn) {
  return (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          console.error('[Admin Error]', err);
          res.status(500).json({ error: 'Internal server error' });
        });
      }
    } catch (err) {
      console.error('[Admin Error]', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * POST /api/admin/login
 * Body: { token: string }
 * Validates the admin token without requiring the auth header.
 */
router.post('/login', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  if (token !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  res.json({ ok: true });
});

// ── All routes below require auth ──
router.use(requireAuth);

// ────────────────────────────────────
// Config
// ────────────────────────────────────

/** GET /api/admin/config — all config key-value pairs */
router.get('/config', safe((req, res) => {
  res.json(getConfig());
}));

/** PUT /api/admin/config — update one config key */
router.put('/config', safe((req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  setConfig(key, value);
  res.json({ ok: true, key, value });
}));

// ────────────────────────────────────
// Guardrails (read-only)
// ────────────────────────────────────

/** GET /api/admin/guardrails */
router.get('/guardrails', safe((req, res) => {
  res.json(getGuardrails());
}));

// ────────────────────────────────────
// Tone Rules
// ────────────────────────────────────

/** GET /api/admin/tone-rules — all rules (including inactive) for admin */
router.get('/tone-rules', safe((req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM tone_rules ORDER BY rule_type, sort_order, id').all());
}));

/** POST /api/admin/tone-rules — create a new tone rule */
router.post('/tone-rules', safe((req, res) => {
  const { rule_type, content, context } = req.body;
  if (!rule_type || !content) {
    return res.status(400).json({ error: 'rule_type and content are required' });
  }
  const db = getDb();
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tone_rules').get();
  const sortOrder = (maxOrder?.m || 0) + 1;
  const result = db.prepare(
    'INSERT INTO tone_rules (rule_type, content, context, sort_order) VALUES (?, ?, ?, ?)'
  ).run(rule_type, content, context || null, sortOrder);
  res.status(201).json({ id: result.lastInsertRowid, rule_type, content, context, sort_order: sortOrder });
}));

/** PUT /api/admin/tone-rules/:id — update a tone rule */
router.put('/tone-rules/:id', safe((req, res) => {
  const { content, context, active } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tone_rules WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tone rule not found' });

  db.prepare(
    'UPDATE tone_rules SET content = ?, context = ?, active = ? WHERE id = ?'
  ).run(
    content !== undefined ? content : existing.content,
    context !== undefined ? context : existing.context,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    req.params.id
  );
  res.json({ ok: true });
}));

/** DELETE /api/admin/tone-rules/:id */
router.delete('/tone-rules/:id', safe((req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM tone_rules WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tone rule not found' });
  res.json({ ok: true });
}));

// ────────────────────────────────────
// Scenarios
// ────────────────────────────────────

/** GET /api/admin/scenarios — all scenarios with fields */
router.get('/scenarios', safe((req, res) => {
  const db = getDb();
  const scenarios = db.prepare('SELECT * FROM scenarios ORDER BY sop_number').all();
  for (const s of scenarios) {
    s.fields = db.prepare(
      'SELECT * FROM scenario_fields WHERE scenario_id = ? ORDER BY sort_order, id'
    ).all(s.id);
  }
  res.json(scenarios);
}));

/** POST /api/admin/scenarios — create a new scenario */
router.post('/scenarios', safe((req, res) => {
  const db = getDb();
  const {
    sop_number, name, display_name, description, category,
    build_status, device_type, enabled, handover_trigger,
    troubleshooting_steps, notes,
  } = req.body;

  if (!sop_number || !display_name || !description || !category) {
    return res.status(400).json({ error: 'sop_number, display_name, description, and category are required' });
  }

  const validCategories = ['order', 'delivery', 'return', 'payment', 'device', 'promo', 'account'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
  }

  // Check for duplicate SOP number
  const existing = db.prepare('SELECT id FROM scenarios WHERE sop_number = ?').get(sop_number);
  if (existing) {
    return res.status(409).json({ error: `SOP number ${sop_number} already exists` });
  }

  const autoName = name || display_name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const ts = troubleshooting_steps
    ? (typeof troubleshooting_steps === 'string' ? troubleshooting_steps : JSON.stringify(troubleshooting_steps))
    : null;

  const result = db.prepare(`
    INSERT INTO scenarios (sop_number, name, display_name, description, category, build_status, device_type, enabled, priority, troubleshooting_steps, handover_trigger, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(
    sop_number,
    autoName,
    display_name,
    description,
    category,
    build_status || 'handover_only',
    device_type || null,
    enabled !== undefined ? (enabled ? 1 : 0) : 1,
    ts,
    handover_trigger || 'always',
    notes || null
  );

  const scenarioId = result.lastInsertRowid;

  // Auto-insert baseline fields
  const insertField = db.prepare(`
    INSERT INTO scenario_fields (scenario_id, field_name, display_name, field_type, required, is_baseline, sort_order)
    VALUES (?, ?, ?, 'text', 1, 1, ?)
  `);
  insertField.run(scenarioId, 'store_name', 'Store Name', 0);
  insertField.run(scenarioId, 'staff_name', 'Staff Full Name', 1);
  insertField.run(scenarioId, 'branch_code', 'Branch Code', 2);

  res.status(201).json({ id: scenarioId, ok: true });
}));

/** GET /api/admin/scenarios/:id */
router.get('/scenarios/:id', safe((req, res) => {
  const db = getDb();
  const scenario = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  scenario.fields = db.prepare(
    'SELECT * FROM scenario_fields WHERE scenario_id = ? ORDER BY sort_order, id'
  ).all(scenario.id);
  res.json(scenario);
}));

/** PUT /api/admin/scenarios/:id — update scenario */
router.put('/scenarios/:id', safe((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM scenarios WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Scenario not found' });

  const {
    display_name, description, build_status, device_type,
    enabled, priority, troubleshooting_steps, handover_trigger, notes,
  } = req.body;

  db.prepare(`
    UPDATE scenarios SET
      display_name = ?, description = ?, build_status = ?, device_type = ?,
      enabled = ?, priority = ?, troubleshooting_steps = ?, handover_trigger = ?, notes = ?
    WHERE id = ?
  `).run(
    display_name !== undefined ? display_name : existing.display_name,
    description !== undefined ? description : existing.description,
    build_status !== undefined ? build_status : existing.build_status,
    device_type !== undefined ? device_type : existing.device_type,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    priority !== undefined ? priority : existing.priority,
    troubleshooting_steps !== undefined ? (typeof troubleshooting_steps === 'string' ? troubleshooting_steps : JSON.stringify(troubleshooting_steps)) : existing.troubleshooting_steps,
    handover_trigger !== undefined ? handover_trigger : existing.handover_trigger,
    notes !== undefined ? notes : existing.notes,
    req.params.id
  );
  res.json({ ok: true });
}));

// ────────────────────────────────────
// Scenario Fields
// ────────────────────────────────────

/** POST /api/admin/scenarios/:id/fields — add a field to scenario */
router.post('/scenarios/:id/fields', safe((req, res) => {
  const db = getDb();
  const scenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  const { field_name, display_name, field_type, description, validation_hint, required, is_baseline, select_options, sort_order } = req.body;
  if (!field_name || !display_name) return res.status(400).json({ error: 'field_name and display_name are required' });

  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM scenario_fields WHERE scenario_id = ?').get(req.params.id);
  const result = db.prepare(`
    INSERT INTO scenario_fields (scenario_id, field_name, display_name, field_type, description, validation_hint, required, is_baseline, select_options, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    field_name,
    display_name,
    field_type || 'text',
    description || null,
    validation_hint || null,
    required !== undefined ? (required ? 1 : 0) : 1,
    is_baseline !== undefined ? (is_baseline ? 1 : 0) : 0,
    select_options || null,
    sort_order !== undefined ? sort_order : (maxOrder?.m || 0) + 1
  );
  res.status(201).json({ id: result.lastInsertRowid, ok: true });
}));

/** PUT /api/admin/scenarios/fields/:fieldId — update a scenario field */
router.put('/scenarios/fields/:fieldId', safe((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM scenario_fields WHERE id = ?').get(req.params.fieldId);
  if (!existing) return res.status(404).json({ error: 'Field not found' });
  if (existing.is_baseline) return res.status(403).json({ error: 'Baseline fields cannot be edited' });

  const { display_name, field_type, description, validation_hint, required, select_options, sort_order } = req.body;
  db.prepare(`
    UPDATE scenario_fields SET display_name = ?, field_type = ?, description = ?, validation_hint = ?, required = ?, select_options = ?, sort_order = ?
    WHERE id = ?
  `).run(
    display_name !== undefined ? display_name : existing.display_name,
    field_type !== undefined ? field_type : existing.field_type,
    description !== undefined ? description : existing.description,
    validation_hint !== undefined ? validation_hint : existing.validation_hint,
    required !== undefined ? (required ? 1 : 0) : existing.required,
    select_options !== undefined ? select_options : existing.select_options,
    sort_order !== undefined ? sort_order : existing.sort_order,
    req.params.fieldId
  );
  res.json({ ok: true });
}));

/** DELETE /api/admin/scenarios/fields/:fieldId */
router.delete('/scenarios/fields/:fieldId', safe((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM scenario_fields WHERE id = ?').get(req.params.fieldId);
  if (!existing) return res.status(404).json({ error: 'Field not found' });
  if (existing.is_baseline) return res.status(403).json({ error: 'Baseline fields cannot be deleted' });

  db.prepare('DELETE FROM scenario_fields WHERE id = ?').run(req.params.fieldId);
  res.json({ ok: true });
}));

// ────────────────────────────────────
// Prompt Preview
// ────────────────────────────────────

/** GET /api/admin/prompt-preview — assembled system prompt */
router.get('/prompt-preview', safe((req, res) => {
  const db = getDb();
  const prompt = buildSystemPrompt(db);

  // Also provide orchestrator and sample SOP agent prompts
  const { Orchestrator } = require('../services/orchestrator');
  const orchestrator = new Orchestrator(db);
  const orchestratorPrompt = orchestrator.buildPrompt();

  res.json({ prompt, orchestratorPrompt });
}));

// ────────────────────────────────────
// Config Reset
// ────────────────────────────────────

/** POST /api/admin/config/reset — reset config to defaults */
router.post('/config/reset', safe((req, res) => {
  const db = getDb();
  const configDefaults = defaults.config;
  for (const [key, value] of Object.entries(configDefaults)) {
    db.prepare(`
      INSERT INTO config (key, value, updated_at) VALUES (?, ?, datetime('now', '+2 hours'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now', '+2 hours')
    `).run(key, value);
  }
  res.json({ ok: true, message: 'Config reset to defaults' });
}));

// ────────────────────────────────────
// Sessions
// ────────────────────────────────────

/** GET /api/admin/sessions — list sessions */
router.get('/sessions', safe((req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const status = req.query.status;

  let query = 'SELECT * FROM sessions';
  const params = [];
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const sessions = db.prepare(query).all(...params);
  const total = db.prepare(
    status ? 'SELECT COUNT(*) as c FROM sessions WHERE status = ?' : 'SELECT COUNT(*) as c FROM sessions'
  ).get(...(status ? [status] : []));

  res.json({ sessions, total: total.c });
}));

/** DELETE /api/admin/sessions/:id — delete session and associated data */
router.delete('/sessions/:id', safe((req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  db.prepare('DELETE FROM messages WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM handoffs WHERE session_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

/** GET /api/admin/sessions/:id — session with messages */
router.get('/sessions/:id', safe((req, res) => {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.messages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at'
  ).all(session.id);
  session.handoffs = db.prepare(
    'SELECT * FROM handoffs WHERE session_id = ? ORDER BY created_at'
  ).all(session.id);
  res.json(session);
}));

// ────────────────────────────────────
// Handoffs
// ────────────────────────────────────

/** GET /api/admin/handoffs */
router.get('/handoffs', safe((req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  const handoffs = db.prepare(
    'SELECT * FROM handoffs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
  const total = db.prepare('SELECT COUNT(*) as c FROM handoffs').get();
  res.json({ handoffs, total: total.c });
}));

// ────────────────────────────────────
// SOP Tools (Swarm Architecture)
// ────────────────────────────────────

/** GET /api/admin/scenarios/:id/tools — list tools for a scenario */
router.get('/scenarios/:id/tools', safe((req, res) => {
  const db = getDb();
  const scenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
  const tools = db.prepare('SELECT * FROM sop_tools WHERE scenario_id = ? ORDER BY id').all(req.params.id);
  res.json(tools);
}));

/** POST /api/admin/scenarios/:id/tools — create a tool */
router.post('/scenarios/:id/tools', safe((req, res) => {
  const db = getDb();
  const scenario = db.prepare('SELECT id FROM scenarios WHERE id = ?').get(req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  const { tool_name, display_name, description, tool_type, configuration, input_schema } = req.body;
  if (!tool_name || !display_name || !description || !tool_type || !configuration || !input_schema) {
    return res.status(400).json({ error: 'tool_name, display_name, description, tool_type, configuration, and input_schema are required' });
  }

  const configStr = typeof configuration === 'string' ? configuration : JSON.stringify(configuration);
  const schemaStr = typeof input_schema === 'string' ? input_schema : JSON.stringify(input_schema);

  const result = db.prepare(`
    INSERT INTO sop_tools (scenario_id, tool_name, display_name, description, tool_type, configuration, input_schema)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, tool_name, display_name, description, tool_type, configStr, schemaStr);

  res.status(201).json({ id: result.lastInsertRowid, ok: true });
}));

/** PUT /api/admin/tools/:id — update a tool */
router.put('/tools/:id', safe((req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM sop_tools WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Tool not found' });

  const { display_name, description, tool_type, configuration, input_schema, enabled } = req.body;

  const configStr = configuration !== undefined
    ? (typeof configuration === 'string' ? configuration : JSON.stringify(configuration))
    : existing.configuration;
  const schemaStr = input_schema !== undefined
    ? (typeof input_schema === 'string' ? input_schema : JSON.stringify(input_schema))
    : existing.input_schema;

  db.prepare(`
    UPDATE sop_tools SET display_name = ?, description = ?, tool_type = ?, configuration = ?, input_schema = ?, enabled = ?
    WHERE id = ?
  `).run(
    display_name !== undefined ? display_name : existing.display_name,
    description !== undefined ? description : existing.description,
    tool_type !== undefined ? tool_type : existing.tool_type,
    configStr,
    schemaStr,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    req.params.id
  );
  res.json({ ok: true });
}));

/** DELETE /api/admin/tools/:id */
router.delete('/tools/:id', safe((req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM sop_tools WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Tool not found' });
  res.json({ ok: true });
}));

/** POST /api/admin/tools/:id/test — test a mock tool with sample input */
router.post('/tools/:id/test', safe((req, res) => {
  const db = getDb();
  const tool = db.prepare('SELECT * FROM sop_tools WHERE id = ?').get(req.params.id);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });

  const input = req.body.input || {};

  if (tool.tool_type === 'mock') {
    const config = JSON.parse(tool.configuration);
    const responses = config.responses || [];

    for (const resp of responses) {
      if (resp.condition === 'default') continue;
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
      if (passes) return res.json({ matched_condition: resp.condition, data: resp.data });
    }

    const defaultResp = responses.find(r => r.condition === 'default');
    return res.json({ matched_condition: 'default', data: defaultResp ? defaultResp.data : null });
  }

  res.json({ error: 'Only mock tools can be tested in the admin panel' });
}));

// ────────────────────────────────────
// Dashboard stats
// ────────────────────────────────────

/** GET /api/admin/stats */
router.get('/stats', safe((req, res) => {
  const db = getDb();
  const activeSessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'active'").get().c;
  const totalSessions = db.prepare('SELECT COUNT(*) as c FROM sessions').get().c;
  const totalHandoffs = db.prepare('SELECT COUNT(*) as c FROM handoffs').get().c;
  const todayHandoffs = db.prepare(
    "SELECT COUNT(*) as c FROM handoffs WHERE date(created_at) = date('now', '+2 hours')"
  ).get().c;
  const sessionsByCategory = db.prepare(`
    SELECT COALESCE(sc.category, 'unclassified') as category, COUNT(*) as count
    FROM sessions s
    LEFT JOIN scenarios sc ON sc.display_name = s.detected_scenario
    GROUP BY COALESCE(sc.category, 'unclassified')
    ORDER BY count DESC
  `).all();
  const topScenarios = db.prepare(`
    SELECT scenario_name, COUNT(*) as count FROM (
      SELECT COALESCE(detected_scenario, 'Unclassified') AS scenario_name FROM sessions
    ) GROUP BY scenario_name ORDER BY count DESC LIMIT 10
  `).all();

  const recentSessions = db.prepare(`
    SELECT s.id, s.status, s.detected_scenario, s.store_name, s.branch_code, s.created_at,
      s.active_agent,
      (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as message_count
    FROM sessions s ORDER BY s.created_at DESC LIMIT 10
  `).all();

  // Swarm architecture stats
  const agentRoutingStats = db.prepare(`
    SELECT agent, COUNT(*) as count FROM messages
    WHERE role = 'assistant' AND agent IS NOT NULL
    GROUP BY agent ORDER BY count DESC
  `).all();

  const toolUsageStats = db.prepare(`
    SELECT st.tool_name, st.display_name, sc.sop_number, COUNT(m.id) as usage_count
    FROM sop_tools st
    LEFT JOIN scenarios sc ON sc.id = st.scenario_id
    LEFT JOIN messages m ON m.tool_use LIKE '%' || st.tool_name || '%' AND m.role = 'system'
    GROUP BY st.id
    ORDER BY usage_count DESC
  `).all();

  res.json({
    activeSessions,
    totalSessions,
    totalHandoffs,
    todayHandoffs,
    sessionsByCategory,
    topScenarios,
    recentSessions,
    agentRoutingStats,
    toolUsageStats,
  });
}));

module.exports = router;
