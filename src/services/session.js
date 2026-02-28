const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

/**
 * Create a new chat session.
 * @param {string} [operatingMode='stage_a']
 * @returns {{ id: string }}
 */
function createSession(operatingMode = 'stage_a') {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO sessions (id, status, operating_mode, collected_data, scenario_history)
    VALUES (?, 'active', ?, '{}', '[]')
  `).run(id, operatingMode);
  return { id };
}

/**
 * Get a session by ID (including messages).
 */
function getSession(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  session.messages = db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at, id'
  ).all(sessionId);

  return session;
}

/**
 * Get the message history for a session formatted for the Claude API.
 * Returns [{role, content}] — only user and assistant messages.
 */
function getConversationHistory(sessionId) {
  const db = getDb();
  const rows = db.prepare(
    "SELECT role, content, tool_use FROM messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at, id"
  ).all(sessionId);

  return rows.map(r => {
    // If tool_use is stored (assistant messages with tool calls), parse it
    if (r.tool_use) {
      return { role: r.role, content: JSON.parse(r.tool_use) };
    }
    return { role: r.role, content: r.content };
  });
}

/**
 * Append a message to a session.
 * @param {string} sessionId
 * @param {string} role - 'user' | 'assistant' | 'system'
 * @param {string} content - Text content
 * @param {*} [toolUse] - Raw tool_use content to store (for assistant messages with tool calls)
 */
function appendMessage(sessionId, role, content, toolUse = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO messages (session_id, role, content, tool_use) VALUES (?, ?, ?, ?)
  `).run(sessionId, role, content, toolUse ? JSON.stringify(toolUse) : null);

  db.prepare(`
    UPDATE sessions SET updated_at = datetime('now', '+2 hours') WHERE id = ?
  `).run(sessionId);
}

/**
 * Update session metadata (detected scenario, collected data, etc.)
 */
function updateSession(sessionId, updates) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  // Merge collected_data
  if (updates.additional_fields || updates.store_name || updates.branch_code || updates.staff_name) {
    const existing = JSON.parse(session.collected_data || '{}');

    if (updates.store_name) existing.store_name = updates.store_name;
    if (updates.branch_code) existing.branch_code = updates.branch_code;
    if (updates.staff_name) existing.staff_name = updates.staff_name;
    if (updates.additional_fields) {
      Object.assign(existing, updates.additional_fields);
    }

    db.prepare('UPDATE sessions SET collected_data = ? WHERE id = ?')
      .run(JSON.stringify(existing), sessionId);
  }

  // Update detected scenario
  if (updates.detected_scenario) {
    db.prepare('UPDATE sessions SET detected_scenario = ? WHERE id = ?')
      .run(updates.detected_scenario, sessionId);

    // Append to scenario history
    const history = JSON.parse(session.scenario_history || '[]');
    if (!history.includes(updates.detected_scenario)) {
      history.push(updates.detected_scenario);
      db.prepare('UPDATE sessions SET scenario_history = ? WHERE id = ?')
        .run(JSON.stringify(history), sessionId);
    }
  }

  // Update baseline fields on the session row
  if (updates.store_name) {
    db.prepare('UPDATE sessions SET store_name = ? WHERE id = ?').run(updates.store_name, sessionId);
  }
  if (updates.branch_code) {
    db.prepare('UPDATE sessions SET branch_code = ? WHERE id = ?').run(updates.branch_code, sessionId);
  }
  if (updates.staff_name) {
    db.prepare('UPDATE sessions SET staff_name = ? WHERE id = ?').run(updates.staff_name, sessionId);
  }

  db.prepare(`UPDATE sessions SET updated_at = datetime('now', '+2 hours') WHERE id = ?`).run(sessionId);

  return { status: 'ok', message: 'Session updated.' };
}

/**
 * Update session status.
 */
function setSessionStatus(sessionId, status) {
  const db = getDb();
  db.prepare(`UPDATE sessions SET status = ?, updated_at = datetime('now', '+2 hours') WHERE id = ?`)
    .run(status, sessionId);
}

/**
 * Append a system-thinking event to a session's transcript.
 * These are shown only in the admin panel for debugging, not sent to the user.
 * @param {string} sessionId
 * @param {string} eventType - e.g. 'scenario_detected', 'data_collected', 'handoff_initiated'
 * @param {string} description - Human-readable description
 * @param {object} [data] - Optional structured payload
 */
function appendSystemEvent(sessionId, eventType, description, data = null) {
  const meta = { event_type: eventType };
  if (data) meta.data = data;
  appendMessage(sessionId, 'system', description, meta);
}

module.exports = {
  createSession,
  getSession,
  getConversationHistory,
  appendMessage,
  appendSystemEvent,
  updateSession,
  setSessionStatus,
};
