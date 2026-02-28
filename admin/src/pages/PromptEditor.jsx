import { useState, useEffect, useRef } from 'react';
import PageHeader from '../components/PageHeader';
import { getConfig, updateConfig, getPromptPreview, testChat } from '../lib/api';

export default function PromptEditor() {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [preview, setPreview] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showChat, setShowChat] = useState(false);

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

  const handleLoadPreview = async () => {
    setShowPreview(true);
    try {
      const data = await getPromptPreview();
      setPreview(data.prompt);
    } catch (e) {
      setPreview('Error loading prompt preview');
      console.error(e);
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Prompt Editor" description="Edit the system prompt preamble, suffix, and messaging. Preview the assembled prompt.">
        <button
          onClick={handleLoadPreview}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-nox-surface-2 text-nox-text-muted hover:text-nox-text transition-colors"
        >
          Full Prompt Preview
        </button>
        <button
          onClick={() => setShowChat(!showChat)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showChat ? 'bg-nox-accent text-white' : 'bg-nox-accent text-white hover:bg-nox-accent-hover'}`}
        >
          {showChat ? 'Hide Test Chat' : 'Live Test Chat'}
        </button>
      </PageHeader>

      <div className={`grid gap-6 ${showChat ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Editor panel */}
        <div className="space-y-4">
          <ConfigCard label="Brand Greeting" hint="The first message NOX sends at the start of every conversation." configKey="brand_greeting" value={config.brand_greeting || ''} onSave={handleSave} saving={saving.brand_greeting} />
          <ConfigCard label="Routing Question" hint="Asked when NOX can't determine the scenario from the initial message." configKey="routing_question" value={config.routing_question || ''} onSave={handleSave} saving={saving.routing_question} />
          <ConfigCard label="Escalation Message" hint="Sent to store staff when NOX hands the conversation over to a human agent." configKey="escalation_message" value={config.escalation_message || ''} onSave={handleSave} saving={saving.escalation_message} />
          <ConfigCard label="Pre-Handover Prompt" hint="Sent just before handover to confirm any missing identifiers. Use {relevant_identifier} as a placeholder." configKey="pre_handover_prompt" value={config.pre_handover_prompt || ''} onSave={handleSave} saving={saving.pre_handover_prompt} />
          <ConfigCard label="Handover Destination" hint="The Freshchat group/inbox name where handovers are routed." configKey="handover_destination" value={config.handover_destination || ''} onSave={handleSave} saving={saving.handover_destination} />
          <ConfigCard label="System Prompt Preamble" hint="Free text injected at the start of NOX's instructions. Use for temporary announcements or overrides." configKey="system_prompt_preamble" value={config.system_prompt_preamble || ''} onSave={handleSave} saving={saving.system_prompt_preamble} textarea placeholder="Custom text prepended to the system prompt..." />
          <ConfigCard label="System Prompt Suffix" hint="Free text injected at the end of NOX's instructions. Use for additional rules or context." configKey="system_prompt_suffix" value={config.system_prompt_suffix || ''} onSave={handleSave} saving={saving.system_prompt_suffix} textarea placeholder="Custom text appended to the system prompt..." />
        </div>

        {/* Test Chat panel */}
        {showChat && <TestChatPanel />}
      </div>

      {/* Prompt Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-nox-surface border border-nox-border rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-nox-border flex-shrink-0">
              <h2 className="text-sm font-semibold text-nox-text">Assembled System Prompt</h2>
              <button onClick={() => setShowPreview(false)} className="text-nox-text-muted hover:text-nox-text">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              {preview ? (
                <pre className="text-xs text-nox-text-muted whitespace-pre-wrap font-mono leading-relaxed">{preview}</pre>
              ) : (
                <div className="text-sm text-nox-text-muted text-center py-8">Loading...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigCard({ label, hint, configKey, value, onSave, saving, textarea, placeholder }) {
  const [localValue, setLocalValue] = useState(value);
  const changed = localValue !== value;

  useEffect(() => { setLocalValue(value); }, [value]);

  const cls = 'w-full bg-nox-bg border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text placeholder:text-zinc-600';

  return (
    <div className="bg-nox-surface border border-nox-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-nox-text-muted">{label}</label>
        {changed && (
          <button
            onClick={() => onSave(configKey, localValue)}
            disabled={saving}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-nox-accent text-white hover:bg-nox-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
      {hint && <p className="text-[11px] text-zinc-500 mb-2">{hint}</p>}
      {textarea ? (
        <textarea
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          rows={4}
          className={`${cls} resize-y`}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          className={cls}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function TestChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setSending(true);

    try {
      const data = await testChat(sessionId, msg);
      setSessionId(data.session_id);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      if (data.handoff) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `Handed over to ${data.handoff.handover_destination || 'support team'}\nRef: ${data.handoff.reference}`,
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSessionId(null);
    setInput('');
  };

  return (
    <div className="bg-nox-surface border border-nox-border rounded-xl flex flex-col h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-nox-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-nox-success" />
          <span className="text-xs font-medium text-nox-text">Live Test Chat</span>
        </div>
        <button
          onClick={handleReset}
          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-nox-surface-2 text-nox-text-muted hover:text-nox-text transition-colors"
        >
          Reset Session
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-nox-text-muted text-center py-8">Send a message to test the current configuration.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-nox-accent text-white'
                : msg.role === 'system'
                  ? 'bg-nox-warning/10 text-nox-warning border border-nox-warning/30'
                  : 'bg-nox-bg text-nox-text'
            }`}>
              <span className="whitespace-pre-wrap">{msg.content}</span>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-nox-bg rounded-xl px-3 py-2 text-sm text-nox-text-muted">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-nox-border p-3 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 bg-nox-bg border border-nox-border rounded-lg px-3 py-2 text-sm text-nox-text placeholder:text-zinc-600"
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-nox-accent text-white hover:bg-nox-accent-hover disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-nox-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-nox-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-nox-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

function LoadingState() {
  return <div className="flex items-center justify-center h-64 text-nox-text-muted text-sm">Loading...</div>;
}

function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="text-nox-danger text-sm font-medium">Failed to load configuration</div>
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
