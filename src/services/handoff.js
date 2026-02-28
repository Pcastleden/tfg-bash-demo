const { getDb } = require('../db');
const { setSessionStatus } = require('./session');

/**
 * Log a handoff to the handoffs table and mark the session as handed off.
 *
 * @param {string} sessionId
 * @param {object} payload - The handoff_to_agent tool input from Claude
 * @returns {{ handoff_id: number, reference: string }}
 */
function createHandoff(sessionId, payload) {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO handoffs (
      session_id, scenario_name, sop_number, store_name, branch_code, staff_name,
      device_type, device_serial, order_number, collected_data,
      steps_tried, current_error, handover_reason, what_needed_next,
      summary, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    payload.scenario_name,
    payload.sop_number,
    payload.store_name || null,
    payload.branch_code || null,
    payload.staff_name || null,
    payload.device_type || null,
    payload.device_serial || null,
    payload.order_number || null,
    JSON.stringify(payload),
    payload.steps_tried ? JSON.stringify(payload.steps_tried) : null,
    payload.current_error || null,
    payload.handover_reason,
    payload.what_needed_next || null,
    payload.summary,
    payload.priority || 'normal'
  );

  // Mark session as handed off
  setSessionStatus(sessionId, 'handed_off');

  const reference = `NOX-${payload.sop_number}-${result.lastInsertRowid}`;

  return {
    handoff_id: result.lastInsertRowid,
    reference,
    status: 'handed_off',
    message: `Conversation handed over to Bashstore Support team. Reference: ${reference}`,
  };
}

/**
 * Get a handoff by ID.
 */
function getHandoff(handoffId) {
  const db = getDb();
  return db.prepare('SELECT * FROM handoffs WHERE id = ?').get(handoffId);
}

/**
 * Get all handoffs for a session.
 */
function getHandoffsBySession(sessionId) {
  const db = getDb();
  return db.prepare('SELECT * FROM handoffs WHERE session_id = ? ORDER BY created_at').all(sessionId);
}

module.exports = {
  createHandoff,
  getHandoff,
  getHandoffsBySession,
};
