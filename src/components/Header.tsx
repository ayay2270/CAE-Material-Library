import { CompareIcon, GridIcon, HelpIcon, ImportExportIcon, SearchIcon, UserIcon } from './icons';
import type { View } from '../types';

interface Props {
  view: View;
  query: string;
  onQuery: (q: string) => void;
  onNavigate: (v: View) => void;
  onImportExport: () => void;
  onHelp: () => void;
  compareCount: number;
}

export function Header({ view, query, onQuery, onNavigate, onImportExport, onHelp, compareCount }: Props) {
  return (
    <header className="app-header">
      <div className="brand">
        {/* Text placeholder for the Lenovo wordmark — swap for the official asset. */}
        <span className="logo-mark">Lenovo</span>
        <span className="brand-title">CAE Material Library</span>
      </div>
      <nav className="main-nav" aria-label="Main">
        <button className={view === 'materials' || view === 'map' ? 'active' : ''} onClick={() => onNavigate('materials')}>
          <GridIcon /> Materials
        </button>
        <button className={view === 'compare' ? 'active' : ''} onClick={() => onNavigate('compare')}>
          <CompareIcon /> Compare{compareCount > 0 && <span className="nav-count">{compareCount}</span>}
        </button>
        <button onClick={onImportExport}>
          <ImportExportIcon /> Import / Export
        </button>
        <button onClick={onHelp}>
          <HelpIcon /> Help
        </button>
      </nav>
      <div className="header-right">
        <label className="header-search">
          <input
            type="search"
            value={query}
            placeholder="Search materials, e.g. SUS304, FR4…"
            onChange={(e) => {
              onQuery(e.target.value);
              if (view !== 'materials') onNavigate('materials');
            }}
            aria-label="Search materials"
          />
          <SearchIcon size={15} />
        </label>
        <button className="avatar" title="User (placeholder)" aria-label="User profile placeholder">
          <UserIcon size={16} />
        </button>
      </div>
    </header>
  );
}
