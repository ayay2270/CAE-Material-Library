import { forwardRef, type ReactNode } from 'react';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  type Material,
} from '../types';
import {
  UPDATED_OPTIONS,
  type UpdatedFilter,
  type SortKey,
  type SortState,
} from '../lib/sort';
import type { UnitPrefs } from '../lib/format';
import { COLUMNS } from '../lib/columns';
import {
  ColumnsIcon,
  CompareIcon,
  GridIcon,
  ImportExportIcon,
  SearchIcon,
} from './icons';
export interface Filters {
  category: 'all' | Category;
  source: 'all' | string;
  updated: UpdatedFilter;
}
export type LibraryMode = 'table' | 'cards';
interface Props {
  materials: Material[];
  query: string;
  onQuery: (q: string) => void;
  filters: Filters;
  onFilters: (f: Filters) => void;
  selectedCount: number;
  onCompare: () => void;
  onClearSelection: () => void;
  onColumns: () => void;
  onImportExport: () => void;
  columnsPopover: ReactNode;
  mode: LibraryMode;
  onMode: (mode: LibraryMode) => void;
  sort: SortState;
  onSortState: (sort: SortState) => void;
  units: UnitPrefs;
  onUnits: (units: UnitPrefs) => void;
  visibleCount: number;
}
export const Toolbar = forwardRef<HTMLInputElement, Props>(
  function Toolbar(p, searchRef) {
    const sources = [
      ...new Set(p.materials.map((m) => m.source).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b));
    const count = (category: Category) =>
      p.materials.filter((m) => m.category === category).length;
    return (
      <div className="toolbar-block">
        <div className="library-heading">
          <h1>材料庫</h1>
          <p>搜尋與瀏覽 CAE 分析所需的材料資料</p>
        </div>
        <div className="library-search-row">
          <label className="search">
            <SearchIcon size={17} />
            <input
              ref={searchRef}
              type="search"
              value={p.query}
              onChange={(event) => p.onQuery(event.target.value)}
              placeholder="搜尋材料名稱、關鍵字或來源，例如 ADC12、Aluminum、Steel、Web"
              aria-label="搜尋材料名稱、關鍵字或來源"
              title="快捷鍵：按 / 即可搜尋"
            />
            <kbd>/</kbd>
          </label>
          <label className="compact-filter">
            <span>來源</span>
            <select
              aria-label="來源"
              value={p.filters.source}
              onChange={(event) =>
                p.onFilters({ ...p.filters, source: event.target.value })
              }
            >
              <option value="all">全部</option>
              {sources.map((source) => (
                <option key={source}>{source}</option>
              ))}
              {p.materials.some((m) => !m.source) && (
                <option value="">未提供來源</option>
              )}
            </select>
          </label>
          <label className="compact-filter">
            <span>更新時間</span>
            <select
              aria-label="更新時間"
              value={p.filters.updated}
              onChange={(event) =>
                p.onFilters({
                  ...p.filters,
                  updated: event.target.value as UpdatedFilter,
                })
              }
            >
              {UPDATED_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="library-filter-row">
          <div
            className="category-chips"
            role="group"
            aria-label="材料類別篩選"
          >
            <button
              className={p.filters.category === 'all' ? 'active' : ''}
              aria-pressed={p.filters.category === 'all'}
              onClick={() => p.onFilters({ ...p.filters, category: 'all' })}
            >
              <i className="category-dot category-all" aria-hidden="true" />
              全部 <span>{p.materials.length}</span>
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category}
                className={p.filters.category === category ? 'active' : ''}
                aria-pressed={p.filters.category === category}
                onClick={() => p.onFilters({ ...p.filters, category })}
              >
                <i
                  className={`category-dot category-${category}`}
                  aria-hidden="true"
                />
                {CATEGORY_LABEL[category]} <span>{count(category)}</span>
              </button>
            ))}
          </div>
          <div className="library-view-actions">
            <div className="popover-anchor">
              <button
                className="btn"
                onClick={p.onColumns}
                data-col-settings-trigger
                aria-haspopup="dialog"
              >
                <ColumnsIcon /> 欄位設定
              </button>
              {p.columnsPopover}
            </div>
            <button className="btn" onClick={p.onImportExport}>
              <ImportExportIcon /> 匯入 / 匯出
            </button>
            <div
              className="library-view-switch"
              role="group"
              aria-label="瀏覽方式"
            >
              <button
                aria-pressed={p.mode === 'table'}
                className={p.mode === 'table' ? 'active' : ''}
                onClick={() => p.onMode('table')}
              >
                <CompareIcon /> 表格
              </button>
              <button
                aria-pressed={p.mode === 'cards'}
                className={p.mode === 'cards' ? 'active' : ''}
                onClick={() => p.onMode('cards')}
              >
                <GridIcon /> 卡片
              </button>
            </div>
          </div>
        </div>
        <div className="library-data-tools">
          <h2>
            {p.filters.category === 'all'
              ? '全部材料'
              : CATEGORY_LABEL[p.filters.category]}{' '}
            <span>{p.visibleCount}</span>
          </h2>
          {(p.filters.category !== 'all' ||
            p.filters.source !== 'all' ||
            p.filters.updated !== 'all') && (
            <button
              className="link-btn small"
              onClick={() =>
                p.onFilters({ category: 'all', source: 'all', updated: 'all' })
              }
            >
              清除篩選
            </button>
          )}
          <div className="library-sort-units">
            <label>
              排序
              <select
                aria-label="排序欄位"
                value={p.sort.key}
                onChange={(event) =>
                  p.onSortState({
                    ...p.sort,
                    key: event.target.value as SortKey,
                  })
                }
              >
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn"
              aria-label="切換排序方向"
              onClick={() =>
                p.onSortState({
                  ...p.sort,
                  dir: p.sort.dir === 'asc' ? 'desc' : 'asc',
                })
              }
            >
              {p.sort.dir === 'asc' ? '↑ 升冪' : '↓ 降冪'}
            </button>
            <span className="unit-caption">單位</span>
            <label>
              密度
              <select
                aria-label="Density 顯示單位"
                value={p.units.density}
                onChange={(event) =>
                  p.onUnits({
                    ...p.units,
                    density: event.target.value as UnitPrefs['density'],
                  })
                }
              >
                <option>t/mm³</option>
                <option>kg/m³</option>
              </select>
            </label>
            <label>
              應力
              <select
                aria-label="Stress 顯示單位"
                value={p.units.stress}
                onChange={(event) =>
                  p.onUnits({
                    ...p.units,
                    stress: event.target.value as UnitPrefs['stress'],
                  })
                }
              >
                <option>MPa</option>
                <option>GPa</option>
              </select>
            </label>
          </div>
        </div>
        {p.selectedCount > 0 && (
          <div className="workspace-selection" role="status">
            <span>
              已選取 <b>{p.selectedCount}</b> 個材料
            </span>
            <button
              className="btn primary"
              disabled={p.selectedCount < 2}
              onClick={p.onCompare}
            >
              比較材料
            </button>
            <button className="btn" onClick={p.onClearSelection}>
              清除選取
            </button>
          </div>
        )}
      </div>
    );
  },
);
