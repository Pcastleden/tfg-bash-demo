import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import {
  getScenarios,
  createScenario,
  updateScenario,
  createScenarioField,
  deleteScenarioField,
} from '../lib/api';

const CATEGORIES = [
  { key: 'order', label: 'Order' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'return', label: 'Return' },
  { key: 'payment', label: 'Payment' },
  { key: 'device', label: 'Device' },
  { key: 'promo', label: 'Promo' },
  { key: 'account', label: 'Account' },
];

export default function Scenarios() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [promptPreview, setPromptPreview] = useState(null);
  const [addingFieldFor, setAddingFieldFor] = useState(null);
  const [newField, setNewField] = useState({ field_name: '', display_name: '', field_type: 'text', required: true });
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    sop_number: '',
    display_name: '',
    description: '',
    category: 'order',
    build_status: 'handover_only',
    device_type: '',
    handover_trigger: 'always',
    enabled: true,
  });
  const [createError, setCreateError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getScenarios().then(setScenarios).catch(err => { console.error(err); setError(err.message); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = activeCategory === 'all'
    ? scenarios
    : scenarios.filter(s => s.category === activeCategory);

  const grouped = {};
  for (const s of filtered) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  const handleToggleEnabled = async (scenario) => {
    try {
      await updateScenario(scenario.id, { enabled: !scenario.enabled });
      load();
    } catch (e) { console.error(e); }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await updateScenario(editingId, editData);
      setEditingId(null);
      setEditData({});
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (scenario) => {
    setEditingId(scenario.id);
    setEditData({
      display_name: scenario.display_name,
      description: scenario.description,
      build_status: scenario.build_status,
      device_type: scenario.device_type || '',
      handover_trigger: scenario.handover_trigger || '',
      troubleshooting_steps: scenario.troubleshooting_steps || '',
      notes: scenario.notes || '',
    });
  };

  const handleAddField = async (scenarioId) => {
    if (!newField.field_name || !newField.display_name) return;
    setSaving(true);
    try {
      await createScenarioField(scenarioId, newField);
      setAddingFieldFor(null);
      setNewField({ field_name: '', display_name: '', field_type: 'text', required: true });
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!confirm('Delete this field?')) return;
    try {
      await deleteScenarioField(fieldId);
      load();
    } catch (e) { console.error(e); }
  };

  const getNextSopNumber = () => {
    const nums = scenarios.map(s => parseInt(s.sop_number.replace('SOP-', ''), 10)).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `SOP-${String(next).padStart(3, '0')}`;
  };

  const handleOpenCreate = () => {
    setCreateData({
      sop_number: getNextSopNumber(),
      display_name: '',
      description: '',
      category: 'order',
      build_status: 'handover_only',
      device_type: '',
      handover_trigger: 'always',
      enabled: true,
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateScenario = async () => {
    if (!createData.sop_number || !createData.display_name || !createData.description) {
      setCreateError('SOP number, display name, and description are required.');
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      await createScenario({
        ...createData,
        device_type: createData.device_type || null,
      });
      setShowCreateModal(false);
      load();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePromptPreview = (scenario) => {
    let preview = `### ${scenario.sop_number}: ${scenario.display_name}\n`;
    preview += `Category: ${scenario.category}\n`;
    preview += `Description: ${scenario.description}\n`;
    if (scenario.device_type) preview += `Device: ${scenario.device_type} only\n`;
    preview += `Build Status: ${scenario.build_status}\n`;
    preview += `Handover Trigger: ${scenario.handover_trigger || 'N/A'}\n\n`;
    preview += `Required fields (beyond baseline):\n`;
    const fields = (scenario.fields || []).filter(f => !f.is_baseline);
    if (fields.length === 0) preview += '  (baseline fields only)\n';
    else fields.forEach(f => {
      preview += `  - ${f.display_name} (${f.field_name}) [${f.required ? 'REQUIRED' : 'OPTIONAL'}]`;
      if (f.validation_hint) preview += ` — ${f.validation_hint}`;
      preview += '\n';
    });
    if (scenario.troubleshooting_steps) {
      preview += `\nTroubleshooting Steps:\n${scenario.troubleshooting_steps}`;
    }
    setPromptPreview(preview);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Scenarios"
        description={`Manage SOPs — ${scenarios.length} scenarios across order, delivery, return, payment, device, and promo categories.`}
      >
        <SmallBtn onClick={handleOpenCreate}>+ New Scenario</SmallBtn>
      </PageHeader>

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        <TabBtn active={activeCategory === 'all'} onClick={() => setActiveCategory('all')}>
          All ({scenarios.length})
        </TabBtn>
        {CATEGORIES.map(c => {
          const count = scenarios.filter(s => s.category === c.key).length;
          if (count === 0) return null;
          return (
            <TabBtn key={c.key} active={activeCategory === c.key} onClick={() => setActiveCategory(c.key)}>
              {c.label} ({count})
            </TabBtn>
          );
        })}
      </div>

      {/* Scenario cards grouped by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-6">
          <h2 className="text-xs font-semibold text-nox-text-muted uppercase tracking-wider mb-3">
            {category}
          </h2>
          <div className="space-y-2">
            {items.map(scenario => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                expanded={expandedId === scenario.id}
                editing={editingId === scenario.id}
                editData={editData}
                saving={saving}
                addingField={addingFieldFor === scenario.id}
                newField={newField}
                onToggleExpand={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
                onToggleEnabled={() => handleToggleEnabled(scenario)}
                onStartEdit={() => handleStartEdit(scenario)}
                onCancelEdit={() => { setEditingId(null); setEditData({}); }}
                onSaveEdit={handleSaveEdit}
                onEditChange={(field, value) => setEditData(prev => ({ ...prev, [field]: value }))}
                onPromptPreview={() => handlePromptPreview(scenario)}
                onStartAddField={() => setAddingFieldFor(scenario.id)}
                onCancelAddField={() => { setAddingFieldFor(null); setNewField({ field_name: '', display_name: '', field_type: 'text', required: true }); }}
                onNewFieldChange={(field, value) => setNewField(prev => ({ ...prev, [field]: value }))}
                onAddField={() => handleAddField(scenario.id)}
                onDeleteField={handleDeleteField}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Create Scenario Modal */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} title="Create New Scenario">
          <div className="space-y-3">
            {createError && (
              <div className="text-xs text-nox-danger bg-nox-danger/10 rounded-lg px-3 py-2">{createError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <InputField label="SOP Number" hint="Unique identifier, e.g. SOP-027" value={createData.sop_number} onChange={v => setCreateData(d => ({ ...d, sop_number: v }))} placeholder="SOP-027" />
              <InputField label="Display Name" hint="Name shown in the scenario list and system prompt." value={createData.display_name} onChange={v => setCreateData(d => ({ ...d, display_name: v }))} placeholder="e.g. Order Cancellation" />
            </div>
            <InputField label="Description" hint="A short summary of what this scenario covers." value={createData.description} onChange={v => setCreateData(d => ({ ...d, description: v }))} textarea placeholder="Store needs help with..." />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-nox-text-muted mb-0.5">Category</label>
                <select
                  value={createData.category}
                  onChange={e => setCreateData(d => ({ ...d, category: e.target.value }))}
                  className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-nox-text-muted mb-0.5">Build Status</label>
                <select
                  value={createData.build_status}
                  onChange={e => setCreateData(d => ({ ...d, build_status: e.target.value }))}
                  className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                >
                  <option value="full">Full (troubleshooting)</option>
                  <option value="handover_only">Handover Only</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-nox-text-muted mb-0.5">Device Type</label>
                <select
                  value={createData.device_type}
                  onChange={e => setCreateData(d => ({ ...d, device_type: e.target.value }))}
                  className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                >
                  <option value="">Any / N/A</option>
                  <option value="sunmi">Sunmi</option>
                  <option value="feitian">Feitian</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-nox-text-muted mb-0.5">Handover Trigger</label>
                <select
                  value={createData.handover_trigger}
                  onChange={e => setCreateData(d => ({ ...d, handover_trigger: e.target.value }))}
                  className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                >
                  <option value="after_troubleshooting">After Troubleshooting</option>
                  <option value="always">Always (Handover Only)</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-nox-text">
              <input
                type="checkbox"
                checked={createData.enabled}
                onChange={e => setCreateData(d => ({ ...d, enabled: e.target.checked }))}
                className="rounded"
              />
              Enabled
            </label>
            <div className="flex gap-2 pt-2">
              <SmallBtn onClick={handleCreateScenario} disabled={saving}>{saving ? 'Creating...' : 'Create Scenario'}</SmallBtn>
              <SmallBtn onClick={() => setShowCreateModal(false)} variant="ghost">Cancel</SmallBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Prompt Preview Modal */}
      {promptPreview !== null && (
        <Modal onClose={() => setPromptPreview(null)} title="Prompt Preview">
          <pre className="text-sm text-nox-text-muted whitespace-pre-wrap font-mono bg-nox-bg p-4 rounded-lg overflow-auto max-h-[60vh]">
            {promptPreview}
          </pre>
        </Modal>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario, expanded, editing, editData, saving, addingField, newField,
  onToggleExpand, onToggleEnabled, onStartEdit, onCancelEdit, onSaveEdit, onEditChange,
  onPromptPreview, onStartAddField, onCancelAddField, onNewFieldChange, onAddField, onDeleteField,
}) {
  const statusColor = scenario.build_status === 'full'
    ? 'bg-nox-success/20 text-nox-success'
    : 'bg-nox-warning/20 text-nox-warning';
  const statusLabel = scenario.build_status === 'full' ? 'Full' : 'Handover Only';

  return (
    <div className="bg-nox-surface border border-nox-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-nox-surface-2/50 transition-colors"
        onClick={onToggleExpand}
      >
        <ChevronIcon className={`w-4 h-4 text-nox-text-muted transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <span className="text-xs font-mono text-nox-text-muted w-16 flex-shrink-0">{scenario.sop_number}</span>
        <span className="text-sm text-nox-text font-medium flex-1">{scenario.display_name}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
          {statusLabel}
        </span>
        {scenario.device_type && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-nox-surface-2 text-nox-text-muted">
            {scenario.device_type}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
          className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${scenario.enabled ? 'bg-nox-accent' : 'bg-nox-surface-2'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${scenario.enabled ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-nox-border px-4 py-4 space-y-4">
          <p className="text-sm text-nox-text-muted">{scenario.description}</p>

          <div className="flex gap-2">
            {!editing && <SmallBtn onClick={onStartEdit}>Edit Scenario</SmallBtn>}
            <SmallBtn onClick={onPromptPreview} variant="ghost">Preview Prompt</SmallBtn>
          </div>

          {/* Edit form */}
          {editing && (
            <div className="bg-nox-bg rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Display Name" hint="The name shown in the scenario list and system prompt." value={editData.display_name || ''} onChange={v => onEditChange('display_name', v)} />
                <div>
                  <label className="block text-xs text-nox-text-muted mb-0.5">Build Status</label>
                  <p className="text-[11px] text-zinc-500 mb-1">Full builds have troubleshooting steps; Handover Only collects info and escalates.</p>
                  <select
                    value={editData.build_status || 'handover_only'}
                    onChange={e => onEditChange('build_status', e.target.value)}
                    className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                  >
                    <option value="full">Full (troubleshooting)</option>
                    <option value="handover_only">Handover Only</option>
                  </select>
                </div>
              </div>
              <InputField label="Description" hint="A short summary of what this scenario covers. Included in the system prompt." value={editData.description || ''} onChange={v => onEditChange('description', v)} textarea />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-nox-text-muted mb-0.5">Device Type</label>
                  <p className="text-[11px] text-zinc-500 mb-1">Restricts this scenario to a specific device. Leave as 'Any' if not device-specific.</p>
                  <select
                    value={editData.device_type || ''}
                    onChange={e => onEditChange('device_type', e.target.value || null)}
                    className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                  >
                    <option value="">Any / N/A</option>
                    <option value="sunmi">Sunmi</option>
                    <option value="feitian">Feitian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-nox-text-muted mb-0.5">Handover Trigger</label>
                  <p className="text-[11px] text-zinc-500 mb-1">When the conversation should be escalated to a human agent.</p>
                  <select
                    value={editData.handover_trigger || ''}
                    onChange={e => onEditChange('handover_trigger', e.target.value)}
                    className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text"
                  >
                    <option value="after_troubleshooting">After Troubleshooting</option>
                    <option value="always">Always (Handover Only)</option>
                  </select>
                </div>
              </div>
              {editData.build_status === 'full' && (
                <div>
                  <label className="block text-xs text-nox-text-muted mb-0.5">Troubleshooting Steps (JSON)</label>
                  <p className="text-[11px] text-zinc-500 mb-1">The step-by-step troubleshooting flow NOX walks through before escalating.</p>
                  <textarea
                    value={editData.troubleshooting_steps || ''}
                    onChange={e => onEditChange('troubleshooting_steps', e.target.value)}
                    rows={10}
                    className="w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text font-mono resize-y"
                    placeholder='{"step_groups": [{"label": "Initial checks", "steps": ["Step 1"], "check": "What do you see?"}]}'
                  />
                </div>
              )}
              <InputField label="Notes" hint="Internal notes for your team. Not included in the system prompt." value={editData.notes || ''} onChange={v => onEditChange('notes', v)} textarea />
              <div className="flex gap-2 pt-1">
                <SmallBtn onClick={onSaveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</SmallBtn>
                <SmallBtn onClick={onCancelEdit} variant="ghost">Cancel</SmallBtn>
              </div>
            </div>
          )}

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-nox-text-muted uppercase tracking-wider">Fields</h3>
              {!addingField && <SmallBtn onClick={onStartAddField} variant="ghost" size="xs">+ Add Field</SmallBtn>}
            </div>
            <div className="space-y-1">
              {(scenario.fields || []).map(field => (
                <div key={field.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nox-bg text-sm">
                  {field.is_baseline ? <LockIcon className="w-3.5 h-3.5 text-nox-text-muted flex-shrink-0" /> : null}
                  <span className={`flex-1 ${field.is_baseline ? 'text-nox-text-muted' : 'text-nox-text'}`}>
                    {field.display_name}
                  </span>
                  <span className="text-[11px] text-nox-text-muted font-mono">{field.field_name}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${field.required ? 'bg-nox-accent/10 text-nox-accent' : 'bg-nox-surface-2 text-nox-text-muted'}`}>
                    {field.required ? 'REQ' : 'OPT'}
                  </span>
                  {!field.is_baseline && (
                    <button onClick={() => onDeleteField(field.id)} className="text-nox-text-muted hover:text-nox-danger transition-colors p-0.5">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {addingField && (
              <div className="mt-2 bg-nox-bg rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <InputField label="Field Name (key)" hint="The internal key used in API payloads and the system prompt." value={newField.field_name} onChange={v => onNewFieldChange('field_name', v)} placeholder="e.g. order_number" size="sm" />
                  <InputField label="Display Name" hint="The label NOX uses when asking the customer for this info." value={newField.display_name} onChange={v => onNewFieldChange('display_name', v)} placeholder="e.g. Order Number" size="sm" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-nox-text-muted">
                    <input type="checkbox" checked={newField.required} onChange={e => onNewFieldChange('required', e.target.checked)} className="rounded" />
                    Required
                  </label>
                  <select
                    value={newField.field_type}
                    onChange={e => onNewFieldChange('field_type', e.target.value)}
                    className="bg-nox-surface border border-nox-border rounded-lg px-2 py-1 text-xs text-nox-text"
                  >
                    <option value="text">Text</option>
                    <option value="select">Select</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <SmallBtn onClick={onAddField} size="xs" disabled={saving}>Add</SmallBtn>
                  <SmallBtn onClick={onCancelAddField} variant="ghost" size="xs">Cancel</SmallBtn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Shared Components ── */

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-nox-accent text-white' : 'bg-nox-surface text-nox-text-muted hover:bg-nox-surface-2 hover:text-nox-text'
      }`}
    >
      {children}
    </button>
  );
}

function SmallBtn({ onClick, children, variant = 'primary', size = 'sm', disabled }) {
  const base = size === 'xs' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';
  const styles = variant === 'ghost'
    ? 'bg-nox-surface-2 text-nox-text-muted hover:text-nox-text'
    : 'bg-nox-accent text-white hover:bg-nox-accent-hover';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} rounded-lg font-medium transition-colors ${styles} disabled:opacity-50`}>
      {children}
    </button>
  );
}

function InputField({ label, hint, value, onChange, textarea, placeholder, size }) {
  const cls = `w-full bg-nox-surface border border-nox-border rounded-lg px-3 py-2 ${size === 'sm' ? 'text-xs' : 'text-sm'} text-nox-text placeholder:text-zinc-600`;
  return (
    <div>
      {label && <label className="block text-xs text-nox-text-muted mb-0.5">{label}</label>}
      {hint && <p className="text-[11px] text-zinc-500 mb-1">{hint}</p>}
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${cls} resize-y`} placeholder={placeholder} />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} className={cls} placeholder={placeholder} />
      )}
    </div>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-nox-surface border border-nox-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-nox-border">
          <h2 className="text-sm font-semibold text-nox-text">{title}</h2>
          <button onClick={onClose} className="text-nox-text-muted hover:text-nox-text"><XIcon className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load scenarios</div>
      <div className="text-nox-text-muted text-xs">{message}</div>
    </div>
  );
}

function ChevronIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
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

function XIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
