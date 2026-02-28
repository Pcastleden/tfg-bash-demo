import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import { getToneRules, createToneRule, updateToneRule, deleteToneRule } from '../lib/api';

const TABS = [
  { key: 'voice_tone', label: 'Voice & Tone', color: 'nox-accent' },
  { key: 'vocabulary_use', label: 'Vocabulary (Use)', color: 'nox-success' },
  { key: 'vocabulary_avoid', label: 'Vocabulary (Avoid)', color: 'nox-danger' },
  { key: 'forbidden_phrase', label: 'Forbidden Phrases', color: 'nox-danger' },
  { key: 'structure_rule', label: 'Reply Structure', color: 'nox-accent' },
  { key: 'identifier_rule', label: 'Identifier Rules', color: 'nox-accent' },
  { key: 'step_delivery_rule', label: 'Step Delivery', color: 'nox-accent' },
  { key: 'uncertainty_rule', label: 'Uncertainty', color: 'nox-warning' },
  { key: 'reusable_phrase', label: 'Reusable Phrases', color: 'nox-success' },
  { key: 'escalation_phrase', label: 'Escalation Language', color: 'nox-warning' },
];

export default function ToneLanguage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('voice_tone');
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    getToneRules().then(setRules).catch(err => { console.error(err); setError(err.message); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = rules.filter(r => r.rule_type === activeTab);
  const currentTab = TABS.find(t => t.key === activeTab);
  const isChipStyle = ['vocabulary_use', 'vocabulary_avoid', 'forbidden_phrase'].includes(activeTab);

  const TAB_HINTS = {
    voice_tone: "Rules that define NOX's personality and communication style.",
    vocabulary_use: "Preferred words and phrases NOX should use in responses.",
    vocabulary_avoid: "Words and phrases NOX should avoid. Soft-avoided, not blocked.",
    forbidden_phrase: "Exact phrases that are strictly blocked from all NOX responses.",
    structure_rule: "Rules governing how NOX formats and structures its messages.",
    identifier_rule: "How NOX handles order numbers, tracking IDs, and other identifiers.",
    step_delivery_rule: "How NOX presents multi-step troubleshooting instructions.",
    uncertainty_rule: "How NOX responds when it doesn't know the answer or isn't confident.",
    reusable_phrase: "Pre-approved phrases NOX can use for common situations.",
    escalation_phrase: "The language NOX uses when handing over to a human agent.",
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      await createToneRule({ rule_type: activeTab, content: newContent.trim() });
      setNewContent('');
      setAdding(false);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id) => {
    if (!editContent.trim()) return;
    setSaving(true);
    try {
      await updateToneRule(id, { content: editContent.trim() });
      setEditingId(null);
      load();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try {
      await deleteToneRule(id);
      load();
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (rule) => {
    try {
      await updateToneRule(rule.id, { active: !rule.active });
      load();
    } catch (e) { console.error(e); }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Tone & Language"
        description="Manage voice, vocabulary, forbidden phrases, and reply structure rules from the Communication Guidance."
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {TABS.map(tab => {
          const count = rules.filter(r => r.rule_type === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setAdding(false); setEditingId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-nox-accent text-white'
                  : 'bg-nox-surface text-nox-text-muted hover:bg-nox-surface-2 hover:text-nox-text'
              }`}
            >
              {tab.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-nox-surface border border-nox-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium text-nox-text">{currentTab?.label}</h2>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-nox-accent text-white hover:bg-nox-accent-hover transition-colors"
            >
              + Add Rule
            </button>
          )}
        </div>

        {TAB_HINTS[activeTab] && <p className="text-[11px] text-zinc-500 mb-4">{TAB_HINTS[activeTab]}</p>}

        {/* Add form */}
        {adding && (
          <div className="mb-4 bg-nox-bg rounded-lg p-3 flex gap-2">
            <input
              type="text"
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Enter rule content..."
              className="flex-1 bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text placeholder:text-zinc-600"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <button onClick={handleAdd} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-medium bg-nox-accent text-white hover:bg-nox-accent-hover disabled:opacity-50">
              {saving ? '...' : 'Add'}
            </button>
            <button onClick={() => { setAdding(false); setNewContent(''); }} className="px-3 py-2 rounded-lg text-xs font-medium bg-nox-surface-2 text-nox-text-muted hover:text-nox-text">
              Cancel
            </button>
          </div>
        )}

        {/* Rules list */}
        {isChipStyle ? (
          <div className="flex flex-wrap gap-2">
            {filtered.map(rule => (
              <ChipRule
                key={rule.id}
                rule={rule}
                color={currentTab?.color}
                editing={editingId === rule.id}
                editContent={editContent}
                onStartEdit={() => { setEditingId(rule.id); setEditContent(rule.content); }}
                onEditChange={setEditContent}
                onSave={() => handleUpdate(rule.id)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => handleToggle(rule)}
                saving={saving}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-nox-text-muted">No rules yet. Add one above.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((rule, i) => (
              <ListRule
                key={rule.id}
                rule={rule}
                index={i}
                editing={editingId === rule.id}
                editContent={editContent}
                onStartEdit={() => { setEditingId(rule.id); setEditContent(rule.content); }}
                onEditChange={setEditContent}
                onSave={() => handleUpdate(rule.id)}
                onCancel={() => setEditingId(null)}
                onDelete={() => handleDelete(rule.id)}
                onToggle={() => handleToggle(rule)}
                saving={saving}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-nox-text-muted">No rules yet. Add one above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChipRule({ rule, color, editing, editContent, onStartEdit, onEditChange, onSave, onCancel, onDelete, onToggle, saving }) {
  const colorMap = {
    'nox-success': 'bg-nox-success/15 text-nox-success border-nox-success/30',
    'nox-danger': 'bg-nox-danger/15 text-nox-danger border-nox-danger/30',
    'nox-accent': 'bg-nox-accent/15 text-nox-accent border-nox-accent/30',
    'nox-warning': 'bg-nox-warning/15 text-nox-warning border-nox-warning/30',
  };

  if (editing) {
    return (
      <div className="flex gap-1 items-center">
        <input
          type="text"
          value={editContent}
          onChange={e => onEditChange(e.target.value)}
          className="bg-nox-bg border border-nox-border rounded-lg px-2 py-1 text-xs text-nox-text w-64"
          onKeyDown={e => e.key === 'Enter' && onSave()}
          autoFocus
        />
        <button onClick={onSave} disabled={saving} className="text-nox-success hover:text-nox-success/80 p-1">
          <CheckIcon className="w-3.5 h-3.5" />
        </button>
        <button onClick={onCancel} className="text-nox-text-muted hover:text-nox-text p-1">
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${colorMap[color] || colorMap['nox-accent']} ${!rule.active ? 'opacity-40' : ''} group`}
    >
      <span className="cursor-pointer" onClick={onStartEdit}>{rule.content}</span>
      <button onClick={onToggle} className="opacity-0 group-hover:opacity-100 transition-opacity" title={rule.active ? 'Disable' : 'Enable'}>
        {rule.active ? <EyeIcon className="w-3 h-3" /> : <EyeOffIcon className="w-3 h-3" />}
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity text-current hover:text-nox-danger">
        <XIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

function ListRule({ rule, index, editing, editContent, onStartEdit, onEditChange, onSave, onCancel, onDelete, onToggle, saving }) {
  if (editing) {
    return (
      <div className="flex gap-2 items-center bg-nox-bg rounded-lg px-3 py-2">
        <span className="text-xs text-nox-text-muted w-5">{index + 1}.</span>
        <input
          type="text"
          value={editContent}
          onChange={e => onEditChange(e.target.value)}
          className="flex-1 bg-nox-surface border border-nox-border rounded-lg px-3 py-1.5 text-sm text-nox-text"
          onKeyDown={e => e.key === 'Enter' && onSave()}
          autoFocus
        />
        <button onClick={onSave} disabled={saving} className="text-nox-success hover:text-nox-success/80 p-1">
          <CheckIcon className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="text-nox-text-muted hover:text-nox-text p-1">
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-nox-bg transition-colors group ${!rule.active ? 'opacity-40' : ''}`}>
      <span className="text-xs text-nox-text-muted w-5">{index + 1}.</span>
      <span className="flex-1 text-sm text-nox-text cursor-pointer" onClick={onStartEdit}>{rule.content}</span>
      <button onClick={onToggle} className="opacity-0 group-hover:opacity-100 text-nox-text-muted hover:text-nox-text transition-all p-1" title={rule.active ? 'Disable' : 'Enable'}>
        {rule.active ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
      </button>
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-nox-text-muted hover:text-nox-danger transition-all p-1">
        <XIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load tone rules</div>
      <div className="text-nox-text-muted text-xs">{message}</div>
    </div>
  );
}

function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CheckIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EyeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
