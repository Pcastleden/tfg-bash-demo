import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { getGuardrails } from '../lib/api';

const WHY_IT_MATTERS = {
  'Guide-only truthfulness': 'Prevents NOX from inventing information that could lead to incorrect actions by store staff, protecting both customer experience and operational integrity.',
  'No system-claiming': 'Staff must understand NOX cannot access internal systems. False claims erode trust and may cause staff to skip verification steps.',
  'Feitian = handover only': 'Feitian devices require specialised support that NOX cannot provide. Attempting troubleshooting wastes time and risks making issues worse.',
  'Sunmi = troubleshoot then handover': 'Sunmi issues often have known fixes. Guiding staff through steps first reduces support team load and resolves issues faster.',
  'Clear cache only, never clear data': 'Clearing data causes loss of app settings, login state, and local information. Cache clearing is safe and often resolves issues without side effects.',
  'Restart after Finmo PIN': 'Finmo PIN changes do not take effect until the device restarts. Skipping this step leads to repeated "PIN incorrect" errors and unnecessary escalations.',
  'Identifiers before troubleshooting': 'Collecting identifiers first ensures the support team has context if a handover is needed, and prevents staff from having to repeat information.',
  'SOP scope boundary': 'Staying within SOP boundaries prevents NOX from giving incorrect advice. Unclear issues should be escalated rather than guessed at.',
};

export default function Guardrails() {
  const [guardrails, setGuardrails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getGuardrails().then(setGuardrails).catch(err => { console.error(err); setError(err.message); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Guardrails"
        description="Non-negotiable rules that NOX must always follow. These are locked and cannot be edited from the dashboard."
      />

      <div className="grid gap-4">
        {guardrails.map(g => (
          <div key={g.id} className="bg-nox-surface border border-nox-border rounded-xl p-5 relative">
            <div className="absolute top-4 right-4">
              <LockBadge />
            </div>
            <div className="flex items-start gap-3 pr-16">
              <div className="w-8 h-8 rounded-lg bg-nox-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldIcon className="w-4 h-4 text-nox-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-nox-text mb-1">{g.rule}</h3>
                <p className="text-sm text-nox-text-muted mb-3">{g.description}</p>
                {WHY_IT_MATTERS[g.rule] && (
                  <div className="bg-nox-bg rounded-lg px-3 py-2">
                    <span className="text-[11px] font-medium text-nox-text-muted uppercase tracking-wider">Why this matters</span>
                    <p className="text-xs text-nox-text-muted mt-1">{WHY_IT_MATTERS[g.rule]}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-nox-surface-2 text-nox-text-muted text-[11px]">
      <LockIcon className="w-3 h-3" />
      Locked
    </span>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load guardrails</div>
      <div className="text-nox-text-muted text-xs">{message}</div>
    </div>
  );
}

function ShieldIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
