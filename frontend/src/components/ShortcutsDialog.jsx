import { X } from 'lucide-react';

export function ShortcutsDialog({ onClose }) {
  const shortcuts = [['⌘ / Ctrl + K','Open command palette'],['⌘ / Ctrl + Shift + V','Open Paste Tasks'],['N','Create a task'],['/','Focus task search'],['G then O','Overview'],['G then M','My Day'],['G then C','Calendar'],['Escape','Close dialog or selection mode']];
  return <div className="overlay" onMouseDown={onClose}><section className="modal shortcuts-modal" onMouseDown={(e)=>e.stopPropagation()}><div className="panel-head"><h4>Keyboard shortcuts</h4><button className="icon-btn" onClick={onClose}><X size={16}/></button></div>{shortcuts.map(([key,label])=><div className="shortcut-row" key={key}><span>{label}</span><kbd>{key}</kbd></div>)}</section></div>;
}
