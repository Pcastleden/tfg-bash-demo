const express = require('express');
const router = express.Router();
const { chat } = require('../services/claude');
const {
  createSession,
  getSession,
  getConversationHistory,
  appendMessage,
  appendSystemEvent,
  updateSession,
} = require('../services/session');
const { createHandoff } = require('../services/handoff');

/**
 * POST /api/chat
 * Body: { session_id?: string, message: string }
 * Returns: { session_id, reply, handoff?: object }
 */
router.post('/', async (req, res) => {
  try {
    const { session_id, message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    // Get or create session
    let sessionId = session_id;
    if (!sessionId) {
      const session = createSession();
      sessionId = session.id;
    } else {
      const existing = getSession(sessionId);
      if (!existing) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (existing.status === 'handed_off') {
        return res.status(400).json({
          error: 'Session has been handed off. Start a new session.',
          session_id: sessionId,
          status: 'handed_off',
        });
      }
    }

    // Store user message
    appendMessage(sessionId, 'user', message.trim());

    // Build conversation history for Claude
    const history = getConversationHistory(sessionId);

    // Tool handlers
    let handoffResult = null;

    // Track previous scenario so we can detect changes
    const currentSession = getSession(sessionId);
    const prevScenario = currentSession?.detected_scenario || null;

    const handlers = {
      onHandoff: async (input) => {
        appendSystemEvent(sessionId, 'handoff_initiated',
          `Handing off to support — ${input.scenario_name} (${input.sop_number}), reason: ${input.handover_reason}`,
          { scenario_name: input.scenario_name, sop_number: input.sop_number, reason: input.handover_reason, priority: input.priority }
        );
        handoffResult = createHandoff(sessionId, input);
        return handoffResult;
      },
      onUpdateSession: async (input) => {
        // Log scenario detection / change
        if (input.detected_scenario) {
          const latest = getSession(sessionId);
          const current = latest?.detected_scenario || prevScenario;
          if (!current || current !== input.detected_scenario) {
            const eventType = current ? 'scenario_changed' : 'scenario_detected';
            const desc = current
              ? `Scenario changed: ${current} → ${input.detected_scenario}`
              : `Scenario detected: ${input.detected_scenario}`;
            appendSystemEvent(sessionId, eventType, desc,
              { previous: current || null, new: input.detected_scenario }
            );
          }
        }

        // Log data collection
        const fields = [];
        if (input.store_name) fields.push(`store_name: ${input.store_name}`);
        if (input.branch_code) fields.push(`branch_code: ${input.branch_code}`);
        if (input.staff_name) fields.push(`staff_name: ${input.staff_name}`);
        if (input.additional_fields) {
          for (const [k, v] of Object.entries(input.additional_fields)) {
            fields.push(`${k}: ${v}`);
          }
        }
        if (fields.length > 0) {
          appendSystemEvent(sessionId, 'data_collected',
            `Collected: ${fields.join(', ')}`,
            { fields: input.additional_fields || {}, store_name: input.store_name, branch_code: input.branch_code, staff_name: input.staff_name }
          );
        }

        return updateSession(sessionId, input);
      },
    };

    // Call Claude
    const options = {
      onSystemEvent: (eventType, desc, data) => {
        appendSystemEvent(sessionId, eventType, desc, data);
      },
    };
    const { assistantMessage, toolResults } = await chat(history, handlers, options);

    // Store assistant reply
    if (assistantMessage) {
      appendMessage(sessionId, 'assistant', assistantMessage);
    }

    // Build response
    const response = {
      session_id: sessionId,
      reply: assistantMessage,
    };

    if (handoffResult) {
      response.handoff = handoffResult;
    }

    res.json(response);
  } catch (err) {
    console.error('[Chat Error]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

/**
 * POST /api/chat/:session_id/close
 * Marks a session as completed (used when user clicks "New chat").
 */
router.post('/:session_id/close', (req, res) => {
  try {
    const { setSessionStatus } = require('../services/session');
    const session = getSession(req.params.session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'active') {
      setSessionStatus(req.params.session_id, 'completed');
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[Chat Close Error]', err);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

/**
 * GET /api/chat/:session_id
 * Returns session details + messages.
 */
router.get('/:session_id', (req, res) => {
  try {
    const session = getSession(req.params.session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (err) {
    console.error('[Chat GET Error]', err);
    res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

module.exports = router;
