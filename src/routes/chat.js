const express = require('express');
const router = express.Router();
const { ChatRouter } = require('../services/chat-router');
const {
  createSession,
  getSession,
  appendMessage,
} = require('../services/session');

// Singleton ChatRouter instance
let chatRouterInstance;
function getChatRouter() {
  if (!chatRouterInstance) {
    chatRouterInstance = new ChatRouter();
  }
  return chatRouterInstance;
}

/**
 * POST /api/chat
 * Body: { session_id?: string, message: string }
 * Returns: { session_id, reply, active_agent, handoff?: object }
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

    // Route through swarm architecture
    const swarmRouter = getChatRouter();
    const result = await swarmRouter.chat(sessionId, message.trim());

    // Build response
    const response = {
      session_id: sessionId,
      reply: result.message,
      active_agent: result.active_agent,
    };

    if (result.handoff) {
      response.handoff = result.handoff;
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
