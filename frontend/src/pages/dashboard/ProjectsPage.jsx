import { useState } from 'react';
import {
  FolderKanban, Plus, Trash2, Archive, Pencil,
} from 'lucide-react';
import api, { errMsg } from '../../api';
import { fmt } from './helpers';

export function ProjectsPage({ projects, setProjects, archived, setArchived, onError, onSelect }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const visible = projects.filter((p) => p.archived === archived);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = form._id
        ? await api.put(`/projects/${form._id}`, form)
        : await api.post('/projects', form);
      setProjects((list) => form._id ? list.map((p) => p._id === data._id ? data : p) : [data, ...list]);
      setForm(null);
    } catch (e) { onError(errMsg(e)); }
    finally { setBusy(false); }
  };
  const change = async (p, patch) => {
    try {
      const { data } = await api.put(`/projects/${p._id}`, patch);
      setProjects((list) => list.map((item) => item._id === p._id ? data : item));
    } catch (e) { onError(errMsg(e)); }
  };
  const remove = async (p) => {
    try {
      await api.delete(`/projects/${p._id}`);
      setProjects((list) => list.filter((item) => item._id !== p._id));
    } catch (e) { onError(errMsg(e)); }
  };
  return (
    <section className="projects-page">
      <div className="projects-heading">
        <div><p className="greet">Your workspace</p><h1 className="big">Projects</h1><p className="muted">Organize work into focused spaces and keep every plan moving.</p></div>
        {!archived && <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', color: '#7c7ff8' })}><Plus size={16} /> New Project</button>}
      </div>
      <div className="project-toolbar">
        <div className="tabs"><button className={!archived ? 'on' : ''} onClick={() => { setArchived(false); setForm(null); }}>Active <span>{projects.filter((p) => !p.archived).length}</span></button><button className={archived ? 'on' : ''} onClick={() => { setArchived(true); setForm(null); }}>Archived <span>{projects.filter((p) => p.archived).length}</span></button></div>
      </div>
      {form && <form className="project-editor" onSubmit={save}>
        <div className="editor-title"><div className="project-swatch" style={{ background: form.color }} /><div><h3>{form._id ? 'Edit project' : 'Create a project'}</h3><p className="muted">Give this workspace a name and a little context.</p></div></div>
        <div className="project-editor-fields">
          <label>Project name<input className="input" placeholder="e.g. Website redesign" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Description<input className="input" placeholder="What are you working on?" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="color-field">Color<input aria-label="Project color" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></label>
        </div>
        <div className="editor-actions"><button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form._id ? 'Save changes' : 'Create project'}</button></div>
      </form>}
      {visible.length ? <div className="project-grid">{visible.map((p) => (
        <article className="project-card project-card-clickable" key={p._id} onClick={() => onSelect(p)}>
          <div className="project-card-accent" style={{ background: p.color }} />
          <div className="project-card-top"><div className="project-icon" style={{ color: p.color, background: `${p.color}20` }}><FolderKanban size={20} /></div><div className="project-card-actions">
            <button className="icon-btn" title="Edit" onClick={(e) => { e.stopPropagation(); setForm(p); }}><Pencil size={15} /></button>
            <button className="icon-btn" title={archived ? 'Restore project' : 'Archive project'} onClick={(e) => { e.stopPropagation(); change(p, { archived: !archived }); }}><Archive size={15} /></button>
            <button className="icon-btn" title="Delete project" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete “${p.name}”?`)) remove(p); }}><Trash2 size={15} /></button>
          </div></div>
          <h3>{p.name}</h3><p className="project-description">{p.description || 'No description yet.'}</p>
          <div className="project-card-footer"><span><i style={{ background: p.color }} />{archived ? 'Archived' : 'Active'}</span><small>Created {fmt(p.createdAt)}</small></div>
        </article>
      ))}</div> : !form && <div className="projects-empty"><div className="empty-icon"><FolderKanban size={26} /></div><h3>{archived ? 'No archived projects' : 'A fresh space for your next big idea'}</h3><p>{archived ? 'Projects you archive will be kept here.' : 'Create your first project to give related tasks a home.'}</p>{!archived && <button className="btn btn-primary" onClick={() => setForm({ name: '', description: '', color: '#7c7ff8' })}><Plus size={15} /> Create your first project</button>}</div>}
    </section>
  );
}
