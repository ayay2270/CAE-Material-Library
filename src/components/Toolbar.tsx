import { forwardRef } from 'react';
import { CATEGORIES } from '../types';
import type { Category, Material } from '../types';
import { CompareIcon, DownloadIcon, MapIcon, PlusIcon, RulerIcon, SearchIcon } from './icons';

export type CategoryFilter = 'All' | Category;

export const CATEGORY_LABEL: Record<CategoryFilter, string> = {
  All: 'All',
  Metal: 'Metals',
  Plastic: 'Plastics',
  Composite: 'Composites',
  Elastomer: 'Elastomers',
  Others: 'Others',
};

interface Props {
  materials: Material[];
  query: string;
  onQuery: (q: string) => void;
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  selectedCount: number;
  onMap: () => void;
  onCompare: () => void;
  onUnits: () => void;
  onExport: () => void;
  onAdd: () => void;
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(p, searchRef) {
  const chips: CategoryFilter[] = ['All', ...CATEGORIES];
  const count = (c: CategoryFilter) => (c === 'All' ? p.materials.length : p.materials.filter((m) => m.category === c).length);
  const canCompare = p.selectedCount >= 2 && p.selectedCount <= 3;

  return (
    <div className="toolbar">
      <label className="search">
        <SearchIcon size={14} />
        <input
          ref={searchRef}
          type="search"
          value={p.query}
          onChange={(e) => p.onQuery(e.target.value)}
          placeholder="Search name / source / notes"
          aria-label="Filter materials by name, source or notes"
          title="Shortcut: press /"
        />
      </label>
      <div className="chips" role="group" aria-label="Category filter">
        {chips.map((c) => (
          <button key={c} className={`chip ${p.category === c ? 'active' : ''}`} aria-pressed={p.category === c} onClick={() => p.onCategory(c)}>
            {CATEGORY_LABEL[c]} <span className="chip-count">{count(c)}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-spacer" />
      <button className="btn" onClick={p.onMap} title="Open the Lightweight vs. Stiffness material map">
        <MapIcon /> Material Map
      </button>
      <button
        className="btn"
        onClick={p.onCompare}
        disabled={!canCompare}
        title={canCompare ? 'Compare the selected materials' : 'Tick 2–3 materials in the table to compare'}
      >
        <CompareIcon /> Compare Selected{p.selectedCount > 0 && <span className="btn-badge">{p.selectedCount}</span>}
      </button>
      <button className="btn" onClick={p.onUnits}>
        <RulerIcon /> Units
      </button>
      <button className="btn" onClick={p.onExport} title="Export the rows currently shown to CSV">
        <DownloadIcon /> Export CSV
      </button>
      <button className="btn primary" onClick={p.onAdd}>
        <PlusIcon /> Add Material
      </button>
    </div>
  );
});
