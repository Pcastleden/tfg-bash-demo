import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { getSessions, getSession, deleteSession } from '../lib/api';

const STATUS_STYLES = {
  active: 'bg-nox-success/15 text-nox-success',
  handed_off: 'bg-nox-warning/15 text-nox-warning',
  completed: 'bg-nox-accent/15 text-nox-accent',
  abandoned: 'bg-nox-surface-2 text-nox-text-muted',
};

const STATUS_LABELS = {
  active: 'Active',
  handed_off: 'Handed Off',
  completed: 'Completed',
  abandoned: 'Abandoned',
};

const EVENT_STYLES = {
  scenario_detected: 'border-emerald-500/40 bg-emerald-500/5 text-emerald-400',
  scenario_changed: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
  data_collected: 'border-sky-500/40 bg-sky-500/5 text-sky-400',
  handoff_initiated: 'border-orange-500/40 bg-orange-500/5 text-orange-400',
  tool_call: 'border-violet-500/40 bg-violet-500/5 text-violet-400',
  agent_routed: 'border-indigo-500/40 bg-indigo-500/5 text-indigo-400',
  agent_returned: 'border-cyan-500/40 bg-cyan-500/5 text-cyan-400',
  provider_fallback: 'border-rose-500/40 bg-rose-500/5 text-rose-400',
  default: 'border-nox-border bg-nox-surface-2/50 text-nox-text-muted',
};

const EVENT_LABELS = {
  scenario_detected: 'SOP Detected',
  scenario_changed: 'SOP Changed',
  data_collected: 'Data Collected',
  handoff_initiated: 'Handoff',
  tool_call: 'Tool Call',
  agent_routed: 'Agent Routed',
  agent_returned: 'Agent Returned',
  provider_fallback: 'Provider Fallback',
};

const AGENT_COLORS = {
  orchestrator: 'text-indigo-400',
};

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const limit = 20;

  const load = () => {
    setLoading(true);
    const params = { limit, offset: page * limit };
    if (statusFilter) params.status = statusFilter;
    getSessions(params)
      .then(data => { setSessions(data.sessions); setTotal(data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, page]);

  const handleViewSession = async (session) => {
    setSelectedSession(session);
    setLoadingTranscript(true);
    try {
      const data = await getSession(session.id);
      setTranscript(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Delete this session and all associated messages and handoffs?')) return;
    try {
      await deleteSession(sessionId);
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setTranscript(null);
      }
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="View conversation history, transcripts, and handoff data."
      />

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['', 'active', 'handed_off', 'completed', 'abandoned'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-nox-accent text-white'
                : 'bg-nox-surface text-nox-text-muted hover:bg-nox-surface-2 hover:text-nox-text'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-nox-surface border border-nox-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nox-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Session ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Scenario</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Store</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Branch</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-nox-text-muted">Created</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-nox-text-muted">Loading...</td></tr>
              ) : sessions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-nox-text-muted">No sessions found</td></tr>
              ) : sessions.map(session => (
                <tr
                  key={session.id}
                  onClick={() => handleViewSession(session)}
                  className="border-b border-nox-border/50 cursor-pointer hover:bg-nox-surface-2/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-nox-text-muted">{session.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[session.status] || ''}`}>
                      {STATUS_LABELS[session.status] || session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-nox-text">{session.detected_scenario || '—'}</td>
                  <td className="px-4 py-3 text-nox-text">{session.store_name || '—'}</td>
                  <td className="px-4 py-3 text-nox-text">{session.branch_code || '—'}</td>
                  <td className="px-4 py-3 text-nox-text-muted text-xs">{formatTime(session.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => handleDelete(e, session.id)}
                      className="text-nox-text-muted hover:text-nox-danger transition-colors"
                      title="Delete session"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-nox-border">
            <span className="text-xs text-nox-text-muted">{total} sessions</span>
            <div className="flex gap-1">
              <PaginationBtn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</PaginationBtn>
              <span className="px-2 py-1 text-xs text-nox-text-muted">{page + 1} / {totalPages}</span>
              <PaginationBtn onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next</PaginationBtn>
            </div>
          </div>
        )}
      </div>

      {/* Transcript Slide-out */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedSession(null)}>
          <div
            className="w-full max-w-xl bg-nox-surface border-l border-nox-border h-full overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-nox-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-nox-text">Session Transcript</h2>
                <p className="text-[11px] text-nox-text-muted font-mono mt-0.5">{selectedSession.id}</p>
              </div>
              <button onClick={() => setSelectedSession(null)} className="text-nox-text-muted hover:text-nox-text">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Session info */}
            {transcript && !loadingTranscript && (
              <div className="px-5 py-3 border-b border-nox-border flex-shrink-0">
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-nox-text-muted">Status</span>
                    <div className="mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLES[transcript.status]}`}>
                        {STATUS_LABELS[transcript.status]}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-nox-text-muted">Active Agent</span>
                    <p className="text-nox-text mt-0.5 font-mono text-[11px]">{transcript.active_agent || 'orchestrator'}</p>
                  </div>
                  <div>
                    <span className="text-nox-text-muted">Scenario</span>
                    <p className="text-nox-text mt-0.5">{transcript.detected_scenario || '—'}</p>
                  </div>
                  <div>
                    <span className="text-nox-text-muted">Store</span>
                    <p className="text-nox-text mt-0.5">{transcript.store_name || '—'} {transcript.branch_code ? `(${transcript.branch_code})` : ''}</p>
                  </div>
                </div>

                {/* Collected data */}
                {transcript.collected_data && (
                  <div className="mt-3">
                    <span className="text-[11px] text-nox-text-muted uppercase tracking-wider">Collected Data</span>
                    <div className="mt-1 bg-nox-bg rounded-lg p-2">
                      <pre className="text-[11px] text-nox-text-muted font-mono whitespace-pre-wrap">{
                        typeof transcript.collected_data === 'string'
                          ? JSON.stringify(JSON.parse(transcript.collected_data || '{}'), null, 2)
                          : JSON.stringify(transcript.collected_data, null, 2)
                      }</pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {loadingTranscript ? (
                <div className="text-center text-nox-text-muted text-sm py-8">Loading...</div>
              ) : transcript?.messages?.map((msg, i) => {
                if (msg.role === 'system') {
                  const meta = msg.tool_use ? (typeof msg.tool_use === 'string' ? JSON.parse(msg.tool_use) : msg.tool_use) : {};
                  const eventType = meta.event_type || 'system';
                  return (
                    <div key={i} className="flex justify-center">
                      <div className={`max-w-[90%] w-full rounded-lg px-3 py-2 text-xs border border-dashed ${EVENT_STYLES[eventType] || EVENT_STYLES.default}`}>
                        <div className="flex items-center gap-1.5">
                          <SystemEventIcon eventType={eventType} />
                          <span className="font-medium uppercase tracking-wider text-[10px]">{EVENT_LABELS[eventType] || 'System'}</span>
                          <span className="ml-auto text-[10px] opacity-50">{formatTime(msg.created_at)}</span>
                        </div>
                        <p className="mt-1 opacity-80 font-mono">{msg.content}</p>
                      </div>
                    </div>
                  );
                }
                // Show agent transition divider when agent changes
                const prevMsg = transcript.messages[i - 1];
                const showAgentDivider = msg.role === 'assistant' && msg.agent &&
                  prevMsg && (prevMsg.agent !== msg.agent || prevMsg.role === 'user');
                const agentLabel = msg.agent && msg.agent !== 'orchestrator' ? msg.agent : msg.agent === 'orchestrator' ? 'Orchestrator' : null;

                return (
                  <div key={i}>
                    {showAgentDivider && msg.agent && (
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-indigo-500/20" />
                        <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">{msg.agent === 'orchestrator' ? 'Orchestrator' : msg.agent}</span>
                        <div className="flex-1 h-px bg-indigo-500/20" />
                      </div>
                    )}
                    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-nox-accent text-white'
                          : 'bg-nox-bg text-nox-text'
                      }`}>
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] opacity-50">{formatTime(msg.created_at)}</span>
                          {agentLabel && msg.role === 'assistant' && (
                            <span className={`text-[10px] font-mono opacity-60 ${AGENT_COLORS[msg.agent] || 'text-cyan-400'}`}>
                              {agentLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Handoff cards */}
              {transcript?.handoffs?.map((h, i) => (
                <div key={`h-${i}`} className="bg-nox-warning/10 border border-nox-warning/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <HandoffIcon className="w-4 h-4 text-nox-warning" />
                    <span className="text-sm font-medium text-nox-warning">Handoff to Support Team</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-nox-text-muted">Scenario:</span> <span className="text-nox-text">{h.scenario_name}</span></div>
                    <div><span className="text-nox-text-muted">SOP:</span> <span className="text-nox-text">{h.sop_number}</span></div>
                    <div><span className="text-nox-text-muted">Reason:</span> <span className="text-nox-text">{h.handover_reason}</span></div>
                    <div><span className="text-nox-text-muted">Priority:</span> <span className="text-nox-text">{h.priority}</span></div>
                  </div>
                  <p className="text-xs text-nox-text-muted">{h.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded text-xs text-nox-text-muted hover:text-nox-text hover:bg-nox-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      {children}
    </button>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
}

function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function HandoffIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

function SystemEventIcon({ eventType }) {
  const cls = "w-3 h-3 flex-shrink-0";
  switch (eventType) {
    case 'scenario_detected':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'scenario_changed':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><polyline points="23 20 23 14 17 14" /><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" /></svg>;
    case 'data_collected':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case 'handoff_initiated':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" /></svg>;
    case 'tool_call':
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
    default:
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
  }
}
