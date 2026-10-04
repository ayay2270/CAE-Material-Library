import type { Material, View } from '../types';
import { useIndexes, type IndexKind } from '../lib/indexes';
import type { Filters } from './Toolbar';
import { CalcIcon, CompareIcon, GridIcon, MapIcon, EditIcon } from './icons';

interface Props {
  materials: Material[];
  view: View;
  onNavigate: (view: View) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  selectedCount: number;
  onManage: (kind: IndexKind) => void;
}
export function Sidebar({
  materials,
  view,
  onNavigate,
  filters,
  onFilters,
  selectedCount, onManage,
}: Props) {
  const indexes = useIndexes();
  const sources = indexes.sources;
  const filter = (change: Partial<Filters>) => {
    onFilters({ ...filters, ...change });
    onNavigate('materials');
  };
  const pages = [
    { id: 'materials', label: '材料庫', icon: GridIcon },
    { id: 'compare', label: '材料比較', icon: CompareIcon },
    { id: 'map', label: 'Material Map', icon: MapIcon },
    { id: 'etan', label: 'ETAN 計算', icon: CalcIcon },
  ] as const;
  return (
    <aside className="workspace-sidebar" aria-label="工作區與材料索引">
      <nav className="sidebar-workspace" aria-label="Workspace">
        <h2>
          WORKSPACE <span>/ 工作區</span>
        </h2>
        {pages.map((page) => (
          <button
            key={page.id}
            className={view === page.id ? 'active' : ''}
            aria-current={view === page.id ? 'page' : undefined}
            onClick={() => onNavigate(page.id)}
          >
            <page.icon size={17} />
            <span>{page.label}</span>
            {page.id === 'compare' && selectedCount > 0 && (
              <b>{selectedCount}</b>
            )}
          </button>
        ))}
      </nav>
      <nav className="sidebar-categories" aria-label="材料分類">
        <div className="sidebar-index-heading"><h2>材料分類</h2><button className="index-manage-trigger" aria-label="管理材料分類" onClick={() => onManage('category')}><EditIcon size={12}/> 編輯</button></div>
        <button
          className={filters.category === 'all' ? 'active' : ''}
          aria-pressed={filters.category === 'all'}
          onClick={() => filter({ category: 'all' })}
        >
          <GridIcon size={16} />
          <span>全部材料</span>
          <b>{materials.length}</b>
        </button>
        {indexes.categories.map(({id:category,label,color}) => (
          <button
            key={category}
            className={filters.category === category ? 'active' : ''}
            aria-pressed={filters.category === category}
            onClick={() => filter({ category })}
          >
            <i
              className="category-dot" style={{background:color}}
              aria-hidden="true"
            />
            <span>{label}</span>
            <b>{materials.filter((m) => m.category === category).length}</b>
          </button>
        ))}
      </nav>
      <nav className="sidebar-sources" aria-label="Source 來源索引">
        <div className="sidebar-index-heading"><h2>SOURCE <span>/ 來源索引</span></h2><button className="index-manage-trigger" aria-label="管理 SOURCE" onClick={() => onManage('source')}><EditIcon size={12}/> 編輯</button></div>
        <button
          className={filters.source === 'all' ? 'active' : ''}
          aria-pressed={filters.source === 'all'}
          onClick={() => filter({ source: 'all' })}
        >
          <span>全部來源</span>
          <b>{materials.length}</b>
        </button>
        {sources.map((source) => (
          <button
            key={source}
            className={filters.source === source ? 'active' : ''}
            aria-pressed={filters.source === source}
            onClick={() => filter({ source })}
          >
            <span>{source}</span>
            <b>{materials.filter((m) => m.source === source).length}</b>
          </button>
        ))}
        {materials.some((m) => !m.source) && (
          <button
            aria-pressed={filters.source === ''}
            className={filters.source === '' ? 'active' : ''}
            onClick={() => filter({ source: '' })}
          >
            <span>未提供來源</span>
            <b>{materials.filter((m) => !m.source).length}</b>
          </button>
        )}
      </nav>
      <footer className="sidebar-footer">
        <GridIcon size={18} />
        <div>
          <b>{pages.find((page) => page.id === view)?.label}</b>
          <span>{materials.length} 筆材料</span>
        </div>
      </footer>
    </aside>
  );
}
