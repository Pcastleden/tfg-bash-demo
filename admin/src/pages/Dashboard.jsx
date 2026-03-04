import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getStats, getHandoffs } from '../lib/api';

const CATEGORY_COLORS = {
  order: 'bg-blue-500',
  delivery: 'bg-purple-500',
  return: 'bg-amber-500',
  payment: 'bg-emerald-500',
  device: 'bg-rose-500',
  promo: 'bg-cyan-500',
  account: 'bg-indigo-500',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentHandoffs, setRecentHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      getStats(),
      getHandoffs({ limit: 10 }),
    ])
      .then(([statsData, handoffData]) => {
        setStats(statsData);
        setRecentHandoffs(handoffData.handoffs || []);
      })
      .catch(err => { console.error(err); setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  const sessionsByCategory = stats?.sessionsByCategory || [];
  const topScenarios = stats?.topScenarios || [];
  const maxCount = topScenarios.length > 0 ? Math.max(...topScenarios.map(s => s.count)) : 1;
  const maxCatCount = sessionsByCategory.length > 0 ? Math.max(...sessionsByCategory.map(c => c.count)) : 1;

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of NOX activity" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Sessions" value={stats?.activeSessions ?? 0} icon={<ActiveIcon />} color="nox-success" />
        <StatCard label="Total Sessions" value={stats?.totalSessions ?? 0} icon={<SessionsIcon />} color="nox-accent" />
        <StatCard label="Handoffs Today" value={stats?.todayHandoffs ?? 0} icon={<TodayIcon />} color="nox-warning" />
        <StatCard label="Total Handoffs" value={stats?.totalHandoffs ?? 0} icon={<HandoffIcon />} color="nox-danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Most triggered scenarios (bar chart) */}
        {topScenarios.length > 0 && (
          <div className="bg-nox-surface border border-nox-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-nox-text mb-4">Sessions by Scenario</h2>
            <div className="space-y-3">
              {topScenarios.map((s, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-nox-text-muted">{s.scenario_name}</span>
                    <span className="text-nox-text font-medium">{s.count}</span>
                  </div>
                  <div className="h-2 bg-nox-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nox-accent rounded-full transition-all"
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions by category */}
        {sessionsByCategory.length > 0 && (
          <div className="bg-nox-surface border border-nox-border rounded-xl p-5">
            <h2 className="text-sm font-medium text-nox-text mb-4">Sessions by Category</h2>
            <div className="space-y-3">
              {sessionsByCategory.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded ${CATEGORY_COLORS[c.category] || 'bg-nox-text-muted'}`} />
                      <span className="text-nox-text-muted capitalize">{c.category}</span>
                    </div>
                    <span className="text-nox-text font-medium">{c.count}</span>
                  </div>
                  <div className="h-2 bg-nox-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${CATEGORY_COLORS[c.category]?.replace('bg-', 'bg-') || 'bg-nox-text-muted'}`}
                      style={{ width: `${(c.count / maxCatCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Agent Routing Stats */}
      {(stats?.agentRoutingStats || []).length > 0 && (
        <div className="bg-nox-surface border border-nox-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-medium text-nox-text mb-4">Agent Activity (Swarm)</h2>
          <div className="flex flex-wrap gap-3">
            {(stats?.agentRoutingStats || []).map((a, i) => (
              <div key={i} className="bg-nox-bg rounded-lg px-4 py-3 min-w-[140px]">
                <div className="text-[11px] font-mono text-nox-text-muted mb-1">
                  {a.agent === 'orchestrator' ? 'Orchestrator' : a.agent}
                </div>
                <div className="text-lg font-semibold text-nox-text">{a.count}</div>
                <div className="text-[10px] text-nox-text-muted">messages</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions table */}
      {(stats?.recentSessions || []).length > 0 && (
        <div className="bg-nox-surface border border-nox-border rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-nox-border flex items-center justify-between">
            <h2 className="text-sm font-medium text-nox-text">Recent Sessions</h2>
            <button
              onClick={() => navigate('/sessions')}
              className="text-xs text-nox-accent hover:text-nox-accent-hover transition-colors"
            >
              View all sessions
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nox-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Time</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Status</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Agent</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Scenario</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Store</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Messages</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentSessions || []).map(s => (
                  <tr key={s.id} onClick={() => navigate('/sessions')} className="border-b border-nox-border/50 cursor-pointer hover:bg-nox-surface-2/50 transition-colors">
                    <td className="px-4 py-2 text-nox-text-muted text-xs whitespace-nowrap">{formatTime(s.created_at)}</td>
                    <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-2 text-xs font-mono text-indigo-400">{s.active_agent === 'orchestrator' ? 'Orch' : s.active_agent || '—'}</td>
                    <td className="px-4 py-2 text-nox-text text-xs">{s.detected_scenario || '—'}</td>
                    <td className="px-4 py-2 text-nox-text text-xs">{s.store_name || '—'}</td>
                    <td className="px-4 py-2 text-nox-text-muted text-xs">{s.message_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent handoffs table */}
      {recentHandoffs.length > 0 && (
        <div className="bg-nox-surface border border-nox-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-nox-border">
            <h2 className="text-sm font-medium text-nox-text">Recent Handoffs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nox-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Time</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">SOP</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Store</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Priority</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-nox-text-muted">Summary</th>
                </tr>
              </thead>
              <tbody>
                {recentHandoffs.map(h => (
                  <tr key={h.id} className="border-b border-nox-border/50 hover:bg-nox-surface-2/50 transition-colors">
                    <td className="px-4 py-2 text-nox-text-muted text-xs whitespace-nowrap">{formatTime(h.created_at)}</td>
                    <td className="px-4 py-2 text-nox-text font-mono text-xs">{h.sop_number}</td>
                    <td className="px-4 py-2 text-nox-text">{h.store_name || '—'}</td>
                    <td className="px-4 py-2">
                      <PriorityBadge priority={h.priority} />
                    </td>
                    <td className="px-4 py-2 text-nox-text-muted text-xs max-w-xs truncate">{h.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {topScenarios.length === 0 && recentHandoffs.length === 0 && (stats?.recentSessions || []).length === 0 && (
        <div className="bg-nox-surface border border-nox-border border-dashed rounded-xl p-12 text-center">
          <p className="text-sm text-nox-text-muted">No activity yet. Start a conversation using the chat widget to see data here.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-nox-surface border border-nox-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-nox-text-muted">{label}</div>
        <div className={`text-${color}`}>{icon}</div>
      </div>
      <div className="text-2xl font-semibold text-nox-text">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: 'bg-nox-success/15 text-nox-success',
    handed_off: 'bg-nox-warning/15 text-nox-warning',
    completed: 'bg-nox-accent/15 text-nox-accent',
    abandoned: 'bg-nox-surface-2 text-nox-text-muted',
  };
  const labels = { active: 'Active', handed_off: 'Handed Off', completed: 'Completed', abandoned: 'Abandoned' };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    urgent: 'bg-nox-danger/15 text-nox-danger',
    high: 'bg-nox-warning/15 text-nox-warning',
    normal: 'bg-nox-accent/15 text-nox-accent',
    low: 'bg-nox-surface-2 text-nox-text-muted',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[priority] || styles.normal}`}>
      {priority}
    </span>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' });
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load dashboard</div>
      <div className="text-nox-text-muted text-xs">{message}</div>
    </div>
  );
}

function ActiveIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TodayIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function HandoffIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
    </svg>
  );
}
