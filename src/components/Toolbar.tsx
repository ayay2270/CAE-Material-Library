import { forwardRef } from 'react';
import { CATEGORIES, CATEGORY_LABEL } from '../types';
import type { Category, Material } from '../types';
import { UPDATED_OPTIONS } from '../lib/sort';
import type { UpdatedFilter } from '../lib/sort';
import { ColumnsIcon, ImportExportIcon, MapIcon, PlusIcon, SearchIcon } from './icons';

export interface Filters {
  category: 'all' | Category;
  source: 'all' | string;
  updated: UpdatedFilter;
}

interface Props {
  materials: Material[];
  query: string;
  onQuery: (q: string) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedCount: number;
  onCompare: () => void;
  onClearSelection: () => void;
  onMap: () => void;
  onColumns: () => void;
  onImportExport: () => void;
  onAdd: () => void;
  /** Rendered next to the 欄位設定 button (the popover itself). */
  columnsPopover: React.ReactNode;
}

export const Toolbar = forwardRef<HTMLInputElement, Props>(function Toolbar(p, searchRef) {
  const sources = [...new Set(p.materials.map((m) => m.source).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const count = (c: Category) => p.materials.filter((m) => m.category === c).length;

  return (
    <div className="toolbar-block">
      <div className="toolbar">
        <label className="search">
          <SearchIcon size={14} />
          <input
            ref={searchRef}
            type="search"
            value={p.query}
            onChange={(e) => p.onQuery(e.target.value)}
            placeholder="搜尋材料名稱、關鍵字或來源..."
            aria-label="搜尋材料名稱、關鍵字或來源"
            title="快捷鍵：按 / 即可搜尋"
          />
        </label>
        <div className="toolbar-spacer" />
        <button className="btn" onClick={p.onMap}>
          <MapIcon /> 材料地圖
        </button>
        <div className="popover-anchor">
          <button className="btn" onClick={p.onColumns} data-col-settings-trigger aria-haspopup="dialog">
            <ColumnsIcon /> 欄位設定
          </button>
          {p.columnsPopover}
        </div>
        <button className="btn" onClick={p.onImportExport}>
          <ImportExportIcon /> 匯入 / 匯出
        </button>
        <button className="btn primary" onClick={p.onAdd}>
          <PlusIcon /> 新增材料
        </button>
      </div>

      <div className="filters">
        <label>
          <span>材料類別</span>
          <select value={p.filters.category} onChange={(e) => p.onFilters({ ...p.filters, category: e.target.value as Filters['category'] })}>
            <option value="all">全部</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}（{count(c)}）
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>來源</span>
          <select value={p.filters.source} onChange={(e) => p.onFilters({ ...p.filters, source: e.target.value })}>
            <option value="all">全部</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>更新時間</span>
          <select value={p.filters.updated} onChange={(e) => p.onFilters({ ...p.filters, updated: e.target.value as UpdatedFilter })}>
            {UPDATED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {(p.filters.category !== 'all' || p.filters.source !== 'all' || p.filters.updated !== 'all') && (
          <button className="link-btn small" onClick={() => p.onFilters({ category: 'all', source: 'all', updated: 'all' })}>
            清除篩選
          </button>
        )}

        {p.selectedCount >= 2 && (
          <div className="selection-bar" role="status">
            <span>已選取 <b>{p.selectedCount}</b> 個材料</span>
            <button className="btn primary small-btn" onClick={p.onCompare}>比較材料</button>
            <button className="btn small-btn" onClick={p.onClearSelection}>清除選取</button>
          </div>
        )}
      </div>
    </div>
  );
});
