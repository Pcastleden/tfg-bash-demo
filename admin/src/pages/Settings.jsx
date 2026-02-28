import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { getConfig, updateConfig, resetConfig } from '../lib/api';

export default function Settings() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(err => { console.error(err); setError(err.message); }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (key, value) => {
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateConfig(key, value);
      setConfig(prev => ({ ...prev, [key]: value }));
    } catch (e) { console.error(e); }
    finally { setSaving(prev => ({ ...prev, [key]: false })); }
  };

  const handleReset = async () => {
    if (!confirm('This will reset all configuration values to their defaults. Continue?')) return;
    setResetting(true);
    try {
      await resetConfig();
      const fresh = await getConfig();
      setConfig(fresh);
    } catch (e) { console.error(e); }
    finally { setResetting(false); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Settings" description="Model configuration, operating mode, and admin management." />

      <div className="space-y-6">
        {/* Model Configuration */}
        <Section title="Model Configuration">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nox-text-muted mb-1.5">Provider</label>
              <select
                value={config.llm_provider || 'anthropic'}
                onChange={e => {
                  const provider = e.target.value;
                  handleSave('llm_provider', provider);
                  const defaultModel = provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-6';
                  handleSave('model_name', defaultModel);
                }}
                className="w-full bg-nox-bg border border-nox-border rounded-lg px-3 py-2.5 text-sm text-nox-text"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-nox-text-muted mb-1.5">Model</label>
              <select
                value={config.model_name || ((config.llm_provider || 'anthropic') === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-6')}
                onChange={e => handleSave('model_name', e.target.value)}
                className="w-full bg-nox-bg border border-nox-border rounded-lg px-3 py-2.5 text-sm text-nox-text"
              >
                {(config.llm_provider || 'anthropic') === 'anthropic' ? (
                  <>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-sonnet-4-5-20250514">Claude Sonnet 4.5</option>
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                  </>
                ) : (
                  <>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-nox-text-muted">Temperature</label>
              <span className="text-xs font-mono text-nox-text">{config.temperature || '0.3'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.temperature || '0.3'}
              onChange={e => handleSave('temperature', e.target.value)}
              className="w-full accent-nox-accent"
            />
            <div className="flex justify-between text-[10px] text-nox-text-muted mt-1">
              <span>Precise (0.0)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-nox-text-muted">Max Tokens</label>
              <span className="text-xs font-mono text-nox-text">{config.max_tokens || '1024'}</span>
            </div>
            <input
              type="range"
              min="256"
              max="4096"
              step="256"
              value={config.max_tokens || '1024'}
              onChange={e => handleSave('max_tokens', e.target.value)}
              className="w-full accent-nox-accent"
            />
            <div className="flex justify-between text-[10px] text-nox-text-muted mt-1">
              <span>256</span>
              <span>4096</span>
            </div>
          </div>
        </Section>

        {/* Operating Mode */}
        <Section title="Operating Mode">
          <div className="space-y-3">
            <ModeOption
              label="Stage A — Vet-first"
              description="NOX drafts responses, human agent reviews before sending to store staff."
              active={config.operating_mode !== 'stage_b'}
              onClick={() => handleSave('operating_mode', 'stage_a')}
            />
            <ModeOption
              label="Stage B — Direct-to-store"
              description="NOX responds autonomously for approved low-risk scenarios."
              active={config.operating_mode === 'stage_b'}
              onClick={() => handleSave('operating_mode', 'stage_b')}
            />
          </div>
        </Section>

        {/* Danger Zone */}
        <Section title="Danger Zone" variant="danger">
          <p className="text-sm text-nox-text-muted mb-4">
            Reset all configuration values (model, temperature, max tokens, greeting, routing question, etc.) back to their defaults.
            This does not affect scenarios, tone rules, or session data.
          </p>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-nox-danger/10 text-nox-danger border border-nox-danger/30 hover:bg-nox-danger/20 transition-colors disabled:opacity-50"
          >
            {resetting ? 'Resetting...' : 'Reset Configuration to Defaults'}
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, variant }) {
  const borderStyle = variant === 'danger' ? 'border-nox-danger/30' : 'border-nox-border';
  return (
    <div className={`bg-nox-surface border ${borderStyle} rounded-xl p-5`}>
      <h2 className={`text-sm font-medium mb-4 ${variant === 'danger' ? 'text-nox-danger' : 'text-nox-text'}`}>{title}</h2>
      {children}
    </div>
  );
}

function ModeOption({ label, description, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
        active
          ? 'border-nox-accent bg-nox-accent/5'
          : 'border-nox-border bg-nox-bg hover:border-nox-text-muted'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
          active ? 'border-nox-accent' : 'border-nox-border'
        }`}>
          {active && <div className="w-2 h-2 rounded-full bg-nox-accent" />}
        </div>
        <div>
          <div className="text-sm font-medium text-nox-text">{label}</div>
          <div className="text-xs text-nox-text-muted mt-0.5">{description}</div>
        </div>
      </div>
    </button>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load settings</div>
      <div className="text-nox-text-muted text-xs">{message}</div>
    </div>
  );
}
