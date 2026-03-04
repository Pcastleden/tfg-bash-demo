const { getDb, getScenarioBySOP } = require('../db');
const { Orchestrator } = require('./orchestrator');
const { SOPAgent } = require('./sop-agent');
const {
  getSession,
  getConversationHistory,
  appendMessage,
  appendSystemEvent,
  updateSession,
} = require('./session');
const { createHandoff } = require('./handoff');

class ChatRouter {
  constructor() {
    this.db = getDb();
    this.orchestrator = new Orchestrator(this.db);
    this.sopAgentCache = {};
  }

  getSOPAgent(sopNumber) {
    if (!this.sopAgentCache[sopNumber]) {
      const scenario = getScenarioBySOP(sopNumber, this.db);
      if (!scenario) return null;
      this.sopAgentCache[sopNumber] = new SOPAgent(this.db, scenario);
    }
    return this.sopAgentCache[sopNumber];
  }

  /**
   * Get conversation messages filtered for the orchestrator.
   * Orchestrator sees: all user messages + orchestrator assistant messages.
   */
  getOrchestratorMessages(sessionId) {
    const rows = this.db.prepare(`
      SELECT role, content, tool_use FROM messages
      WHERE session_id = ?
        AND (role = 'user' OR (role = 'assistant' AND (agent = 'orchestrator' OR agent IS NULL)))
      ORDER BY id
    `).all(sessionId);

    return rows.map(r => {
      if (r.tool_use) {
        return { role: r.role, content: JSON.parse(r.tool_use) };
      }
      return { role: r.role, content: r.content };
    });
  }

  /**
   * Get conversation messages filtered for a SOP agent.
   * SOP agent sees: messages from after it was routed to (its own conversation).
   */
  getSOPAgentMessages(sessionId, sopNumber, routedAtMessageId) {
    const rows = this.db.prepare(`
      SELECT role, content, tool_use FROM messages
      WHERE session_id = ?
        AND id >= ?
        AND (role = 'user' OR (role = 'assistant' AND agent = ?))
      ORDER BY id
    `).all(sessionId, routedAtMessageId || 0, sopNumber);

    return rows.map(r => {
      if (r.tool_use) {
        return { role: r.role, content: JSON.parse(r.tool_use) };
      }
      return { role: r.role, content: r.content };
    });
  }

  /**
   * Get the latest message ID for the session (used to track routing point).
   */
  getLatestMessageId(sessionId) {
    const row = this.db.prepare(
      'SELECT MAX(id) as max_id FROM messages WHERE session_id = ?'
    ).get(sessionId);
    return row?.max_id || 0;
  }

  /**
   * Record an agent transition in the session's agent_history.
   */
  recordAgentTransition(sessionId, agentName) {
    const session = this.db.prepare('SELECT agent_history FROM sessions WHERE id = ?').get(sessionId);
    const history = JSON.parse(session?.agent_history || '[]');
    history.push({ agent: agentName, timestamp: new Date().toISOString() });
    this.db.prepare('UPDATE sessions SET agent_history = ? WHERE id = ?')
      .run(JSON.stringify(history), sessionId);
  }

  /**
   * Main chat method — routes to orchestrator or active SOP agent.
   */
  async chat(sessionId, userMessage) {
    const session = getSession(sessionId);
    const activeAgent = session.active_agent || 'orchestrator';

    let handoffResult = null;
    const prevScenario = session.detected_scenario || null;

    // Build handlers shared between orchestrator and SOP agents
    const buildHandlers = (agentName) => ({
      onHandoff: async (input) => {
        appendSystemEvent(sessionId, 'handoff_initiated',
          `[${agentName}] Handing off — ${input.scenario_name || 'unknown'} (${input.sop_number || 'n/a'}), reason: ${input.handover_reason}`,
          { agent: agentName, scenario_name: input.scenario_name, sop_number: input.sop_number, reason: input.handover_reason }
        );
        handoffResult = createHandoff(sessionId, input);
        return handoffResult;
      },
      onUpdateSession: async (input) => {
        if (input.detected_scenario) {
          const current = this.db.prepare('SELECT detected_scenario FROM sessions WHERE id = ?').get(sessionId)?.detected_scenario || prevScenario;
          if (!current || current !== input.detected_scenario) {
            const eventType = current ? 'scenario_changed' : 'scenario_detected';
            const desc = current
              ? `Scenario changed: ${current} → ${input.detected_scenario}`
              : `Scenario detected: ${input.detected_scenario}`;
            appendSystemEvent(sessionId, eventType, desc, { previous: current || null, new: input.detected_scenario });
          }
        }
        const fields = [];
        if (input.store_name) fields.push(`store_name: ${input.store_name}`);
        if (input.branch_code) fields.push(`branch_code: ${input.branch_code}`);
        if (input.staff_name) fields.push(`staff_name: ${input.staff_name}`);
        if (fields.length > 0) {
          appendSystemEvent(sessionId, 'data_collected', `Collected: ${fields.join(', ')}`, input);
        }
        return updateSession(sessionId, input);
      }
    });

    const systemEventHandler = (eventType, desc, data) => {
      appendSystemEvent(sessionId, eventType, desc, data);
    };

    let result;
    let maxHops = 5; // safety limit for routing loops
    let currentAgent = activeAgent;
    let currentMessage = userMessage; // may change on re-routing

    while (maxHops-- > 0) {
      if (currentAgent === 'orchestrator') {
        // === ORCHESTRATOR ===
        const messages = this.getOrchestratorMessages(sessionId);
        const handlers = buildHandlers('orchestrator');
        const options = { onSystemEvent: systemEventHandler };

        result = await this.orchestrator.chat(session, messages, handlers, options);

        if (result.routing && result.routing.type === 'route_to_sop') {
          const routing = result.routing;
          const orchestratorText = result.text || '';

          // Don't save orchestrator's filler text (e.g. "Got it.") as an assistant message —
          // it's just routing noise. The SOP agent will respond naturally to the user.

          // Log routing event
          appendSystemEvent(sessionId, 'agent_routed',
            `Orchestrator → ${routing.sop_number}: ${routing.reason}`,
            { from: 'orchestrator', to: routing.sop_number, reason: routing.reason, context: routing.context }
          );

          // Update session
          const scenarioObj = getScenarioBySOP(routing.sop_number, this.db);
          const contextSnapshot = {
            ...routing.context,
            routed_at_message_id: this.getLatestMessageId(sessionId)
          };

          this.db.prepare(`
            UPDATE sessions SET
              active_agent = ?,
              context_snapshot = ?,
              detected_scenario = ?,
              updated_at = datetime('now', '+2 hours')
            WHERE id = ?
          `).run(
            routing.sop_number,
            JSON.stringify(contextSnapshot),
            scenarioObj?.display_name || routing.sop_number,
            sessionId
          );

          // Update baseline fields from routing context
          if (routing.context.store_name || routing.context.staff_name || routing.context.branch_code) {
            updateSession(sessionId, {
              store_name: routing.context.store_name,
              staff_name: routing.context.staff_name,
              branch_code: routing.context.branch_code,
              detected_scenario: scenarioObj?.display_name || routing.sop_number
            });
          }

          this.recordAgentTransition(sessionId, routing.sop_number);

          // Now call the SOP agent
          const sopAgent = this.getSOPAgent(routing.sop_number);
          if (!sopAgent) {
            result = { text: `I couldn't find the SOP agent for ${routing.sop_number}. Let me hand this over to the support team.` };
            break;
          }

          // SOP agent gets the FULL conversation history so it knows what's already been discussed
          // But we must ensure it ends with a user message (Claude API requirement)
          const allMessages = this.db.prepare(`
            SELECT role, content, tool_use FROM messages
            WHERE session_id = ? AND role IN ('user', 'assistant')
            ORDER BY id
          `).all(sessionId);

          let sopMessages = allMessages.map(r => {
            if (r.tool_use) return { role: r.role, content: JSON.parse(r.tool_use) };
            return { role: r.role, content: r.content };
          });

          // Strip trailing assistant messages — API requires last message to be from user
          while (sopMessages.length > 0 && sopMessages[sopMessages.length - 1].role === 'assistant') {
            sopMessages.pop();
          }

          const sopHandlers = buildHandlers(routing.sop_number);

          result = await sopAgent.chat(session, sopMessages, routing.context, sopHandlers, { onSystemEvent: systemEventHandler });

          if (result.routing && result.routing.type === 'return_to_orchestrator') {
            // SOP agent wants to return — update session and re-route
            appendSystemEvent(sessionId, 'agent_returned',
              `${routing.sop_number} → Orchestrator: ${result.routing.reason}`,
              { from: routing.sop_number, reason: result.routing.reason, summary: result.routing.summary }
            );

            // Don't save SOP agent's filler text during routing transitions

            this.db.prepare("UPDATE sessions SET active_agent = 'orchestrator' WHERE id = ?").run(sessionId);
            this.recordAgentTransition(sessionId, 'orchestrator');
            currentAgent = 'orchestrator';
            currentMessage = result.routing.new_issue_hint || currentMessage;
            continue;
          }

          // SOP agent responded normally — done
          currentAgent = routing.sop_number;
          break;

        } else if (result.routing && result.routing.type === 'handoff') {
          // Orchestrator triggered handoff directly
          break;
        }

        // Orchestrator responded without routing
        break;

      } else {
        // === ACTIVE SOP AGENT ===
        const contextSnapshot = JSON.parse(session.context_snapshot || '{}');
        const sopAgent = this.getSOPAgent(currentAgent);

        if (!sopAgent) {
          // SOP agent not found, fall back to orchestrator
          this.db.prepare("UPDATE sessions SET active_agent = 'orchestrator' WHERE id = ?").run(sessionId);
          currentAgent = 'orchestrator';
          continue;
        }

        // SOP agent gets full conversation history for natural continuity
        const allMsgs = this.db.prepare(`
          SELECT role, content, tool_use FROM messages
          WHERE session_id = ? AND role IN ('user', 'assistant')
          ORDER BY id
        `).all(sessionId);

        let sopMessages = allMsgs.map(r => {
          if (r.tool_use) return { role: r.role, content: JSON.parse(r.tool_use) };
          return { role: r.role, content: r.content };
        });

        // Strip trailing assistant messages — API requires last message to be from user
        while (sopMessages.length > 0 && sopMessages[sopMessages.length - 1].role === 'assistant') {
          sopMessages.pop();
        }

        const handlers = buildHandlers(currentAgent);
        result = await sopAgent.chat(session, sopMessages, contextSnapshot, handlers, { onSystemEvent: systemEventHandler });

        if (result.routing && result.routing.type === 'return_to_orchestrator') {
          appendSystemEvent(sessionId, 'agent_returned',
            `${currentAgent} → Orchestrator: ${result.routing.reason}`,
            { from: currentAgent, reason: result.routing.reason, summary: result.routing.summary }
          );

          // Don't save SOP agent's filler text during routing transitions

          this.db.prepare("UPDATE sessions SET active_agent = 'orchestrator' WHERE id = ?").run(sessionId);
          this.recordAgentTransition(sessionId, 'orchestrator');
          currentAgent = 'orchestrator';
          currentMessage = result.routing.new_issue_hint || currentMessage;
          continue;
        }

        // SOP agent responded normally
        break;
      }
    }

    // Save final assistant response
    if (result.text) {
      appendMessage(sessionId, 'assistant', result.text, null);
      const lastMsg = this.db.prepare(
        'SELECT id FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1'
      ).get(sessionId);
      if (lastMsg) {
        this.db.prepare('UPDATE messages SET agent = ? WHERE id = ?').run(currentAgent, lastMsg.id);
      }
    }

    return {
      message: result.text,
      sessionId,
      active_agent: currentAgent,
      handoff: handoffResult || null
    };
  }
}

module.exports = { ChatRouter };
