import { useMemo, useState } from 'react';
import { ClipboardPaste, Trash2, X } from 'lucide-react';
import api, { errMsg } from '../api';
import { MAX_TASK_TITLE_LENGTH, parseSmartPaste } from '../utils/smartPaste';

const STATUSES = [
  ['todo', 'To Do'],
  ['in_progress', 'In Progress'],
  ['review', 'Review'],
  ['done', 'Done'],
];
const newRequestKey = () => globalThis.crypto?.randomUUID?.() || `import-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function SmartPasteModal({ projects, defaultProjectId = '', onClose, onCreated }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseSmartPaste(text), [text]);
  const [items, setItems] = useState(parsed.tasks);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const [failureMessages, setFailureMessages] = useState({});
  const [error, setError] = useState('');

  const titleError = (title) => !title.trim()
    ? 'Title is required'
    : title.trim().length > MAX_TASK_TITLE_LENGTH
      ? `Titles must be ${MAX_TASK_TITLE_LENGTH} characters or fewer`
      : '';
  const selected = items.filter((item) => item.selected
    && !item.imported
    && (item.duplicateOf === undefined || item.duplicateOf === null || includeDuplicates)
    && !titleError(item.title));
  const validCount = selected.length;

  const updateItem = (id, patch) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const removeItem = (id) => setItems((current) => current.filter((item) => item.id !== id));
  const selectAll = (checked) => setItems((current) => current.map((item) => ({
    ...item,
    selected: checked && !item.imported
      && (item.duplicateOf === undefined || item.duplicateOf === null || includeDuplicates)
      && !titleError(item.title),
  })));

  const createTasks = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    setError('');
    const submitted = selected;
    try {
      const { data } = await api.post('/tasks/bulk', {
        tasks: submitted.map(({ title }) => ({ title: title.trim() })),
        projectId: projectId || undefined,
        status,
        priority,
        dueDate: dueDate || null,
      }, { headers: { 'Idempotency-Key': requestKey } });
      onCreated(data.createdTasks);
      const failedPositions = new Map(data.failures.map((failure) => [failure.index, failure.message]));
      const importedIds = new Set();
      const nextFailures = {};
      submitted.forEach((item, index) => {
        const failure = failedPositions.get(index);
        if (failure) nextFailures[item.id] = failure;
        else {
          importedIds.add(item.id);
        }
      });
      setItems((current) => current.map((item) => importedIds.has(item.id)
        ? { ...item, imported: true, selected: false }
        : item));
      setFailureMessages(nextFailures);
      setRequestKey(newRequestKey());
      if (data.failures.length) {
        setError(`${data.createdTasks.length} task${data.createdTasks.length === 1 ? '' : 's'} created; ${data.failures.length} failed. Review the failed items and retry.`);
      } else {
        onClose();
      }
    } catch (requestError) {
      setError(errMsg(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay smart-paste-backdrop" role="presentation">
      <section className="modal smart-paste-modal" role="dialog" aria-modal="true" aria-labelledby="smart-paste-title">
        <div className="panel-head"><div><p className="greet">Bulk task import</p><h2 id="smart-paste-title">Paste tasks</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
        <p className="muted small">Paste a list, checklist, numbered phases, or one task per line. Nothing is saved until you confirm.</p>
        <label className="smart-paste-input-label">Task text
          <textarea className="input smart-paste-textarea" value={text} onChange={(event) => {
            const value = event.target.value;
            setText(value);
            setItems(parseSmartPaste(value).tasks);
            setFailureMessages({});
          }} placeholder={'Phase 1: Authentication\nPhase 2: Project Management\nPhase 3: Task Management'} autoFocus />
        </label>
        {text && <div className="smart-paste-preview">
          <div className="smart-paste-preview-head"><b>Preview</b><span>{parsed.detectedCount} detected{items.length !== parsed.tasks.length ? ` · ${items.length} in preview` : ''}</span><button className="link-gold" onClick={() => selectAll(true)}>Select valid</button><button className="link-gold" onClick={() => selectAll(false)}>Clear</button></div>
          {!!parsed.warnings.length && <div className="smart-paste-warnings">{parsed.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
          {items.map((item) => {
            const invalid = titleError(item.title);
            return <div className={`smart-paste-row ${item.imported ? 'imported' : ''}`} key={item.id}>
              <input type="checkbox" checked={item.selected && (item.duplicateOf === undefined || item.duplicateOf === null || includeDuplicates)} disabled={item.imported || (item.duplicateOf !== undefined && item.duplicateOf !== null && !includeDuplicates)} aria-label={`Select ${item.title || 'task'}`} onChange={(event) => updateItem(item.id, { selected: event.target.checked })} />
              <div className="smart-paste-item-content">
                <input className="input" value={item.title} disabled={item.imported} maxLength={MAX_TASK_TITLE_LENGTH + 100} aria-label="Task title" onChange={(event) => updateItem(item.id, { title: event.target.value })} />
                {invalid && <small className="error">{invalid}</small>}
                {item.duplicateOf !== undefined && item.duplicateOf !== null && <small className="smart-paste-note">Duplicate of item {item.duplicateOf + 1}; opt in below to include.</small>}
                {item.review && <small className="smart-paste-note">Review this possible subtask or descriptive line.</small>}
                {failureMessages[item.id] && <small className="error">{failureMessages[item.id]}</small>}
                {item.imported && <small className="smart-paste-note">Created</small>}
              </div>
              <button className="icon-btn" disabled={item.imported} onClick={() => removeItem(item.id)} aria-label="Remove task"><Trash2 size={14} /></button>
            </div>;
          })}
          {items.some((item) => item.duplicateOf !== undefined && item.duplicateOf !== null) && <label className="preference-check smart-paste-duplicates"><input type="checkbox" checked={includeDuplicates} onChange={(event) => setIncludeDuplicates(event.target.checked)} /> Include duplicate lines</label>}
          <div className="smart-paste-defaults">
            <label>Project<select className="input" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Personal</option>{projects.filter((project) => !project.archived || project._id === projectId).map((project) => <option key={project._id} value={project._id}>{project.name}{project.archived ? ' (Archived)' : ''}</option>)}</select></label>
            <label>Status<select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Priority<select className="input" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label>Due date<input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          </div>
        </div>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="editor-actions"><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !validCount} onClick={createTasks}><ClipboardPaste size={15} />{busy ? 'Creating…' : `Create ${validCount} Tasks`}</button></div>
      </section>
    </div>
  );
}
