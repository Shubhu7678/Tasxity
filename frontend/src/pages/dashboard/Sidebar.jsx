import { Search, Plus, ChevronDown } from 'lucide-react';
import Logo from '../../components/Logo';
import { NAV, NAV_HINT, SIDEBAR_FOOTER_NAV } from './constants';

export function Sidebar({ user, initials, activePage, tasks, projects, projectFilter, onNavigate, onOpenWorkspace, onOpenPalette, onShowProjects }) {
  return (
    <aside className="sidebar">
      <Logo />
      <button className="sidebar-search" data-tour="search" type="button" onClick={onOpenPalette}>
        <Search size={14} /><span>Quick search</span><kbd>⌘ K</kbd>
      </button>
      <div className="sidebar-scroll">
        <div className="sidebar-section-label">Workspace</div>
        <nav data-tour="nav">
          {NAV.map(([n, Icon]) => (
            <a key={n} title={NAV_HINT[n]} className={activePage === n ? 'active' : ''} onClick={() => onNavigate(n)}><Icon size={17} /> {n}{n === 'My Tasks' && <em>{tasks.length}</em>}</a>
          ))}
        </nav>
        <div className="sidebar-workspaces" data-tour="spaces">
          <div className="ws-head"><span>My Spaces</span><button onClick={onShowProjects} aria-label="Add workspace"><Plus size={15} /></button></div>
          <a className={`ws ${activePage === 'Overview' && projectFilter === 'all' ? 'active' : ''}`}
            role="button" tabIndex={0} aria-current={activePage === 'Overview' && projectFilter === 'all' ? 'page' : undefined}
            onClick={() => onOpenWorkspace('all')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenWorkspace('all');
              }
            }}><i style={{ background: 'var(--gold)' }} /> All tasks</a>
          {projects.filter((p) => !p.archived).map((p) => (
            <a key={p._id} className={`ws ${activePage === 'Overview' && projectFilter === p._id ? 'active' : ''}`}
              role="button" tabIndex={0} aria-current={activePage === 'Overview' && projectFilter === p._id ? 'page' : undefined}
              onClick={() => onOpenWorkspace(p._id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenWorkspace(p._id);
                }
              }}><i style={{ background: p.color }} /> {p.name}</a>
          ))}
          {!projects.some((project) => !project.archived) && <button className="sidebar-empty-space" onClick={onShowProjects}>
              <Plus size={13} /> Create a space
          </button>}
        </div>
      </div>
      <div className="sidebar-footer">
        <nav className="sidebar-utility-nav">
          {SIDEBAR_FOOTER_NAV.map(([name, Icon]) => (
              <a key={name} title={NAV_HINT[name]} data-tour={name === 'Reports' ? 'reports' : undefined} className={activePage === name ? 'active' : ''} onClick={() => onNavigate(name)}><Icon size={16} /> {name}</a>
          ))}
        </nav>
        <button className={`sidebar-account ${activePage === 'Profile' ? 'active' : ''}`} onClick={() => onNavigate('Profile')}>
          <span className="sidebar-account-avatar">{initials}</span>
          <span className="sidebar-account-copy"><b>My Account</b><small>{user.isGuest ? 'Guest workspace' : 'Personal workspace'}</small></span>
          <ChevronDown size={14} />
        </button>
      </div>
    </aside>
  );
}
