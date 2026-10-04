import { useEffect, useRef } from 'react';
import type { Material } from '../types';
import { CATEGORY_LABEL } from '../types';
import { PROPS } from '../lib/props';
import { formatDay, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { COLUMN_BY_ID } from '../lib/columns';
import type { ColId } from '../lib/columns';
import type { SortKey, SortState } from '../lib/sort';
import { EditIcon, SortArrows, TrashIcon } from './icons';

interface Props {
  rows: Material[];
  total: number;
  columns: ColId[];
  sort: SortState;
  onSort: (k: SortKey) => void;
  selected: string[];
  onToggle: (id: string) => void;
  onClearSelection: () => void;
  onOpen: (m: Material) => void;
  onEdit: (m: Material) => void;
  onDelete: (m: Material) => void;
  units: UnitPrefs;
  activeId: string | null;
}

const propDef = (id: ColId) => PROPS.find((p) => p.key === id);

export function MaterialTable(p: Props) {
  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = p.selected.length > 0;
  }, [p.selected.length]);

  const header = (id: ColId) => {
    const def = COLUMN_BY_ID[id];
    const prop = propDef(id);
    const dir = p.sort.key === id ? p.sort.dir : null;
    const sub = prop ? `${unitFor(prop, p.units)}${prop.optional ? ' · optional' : ''}` : undefined;
    return (
      <th
        key={id}
        className={`sortable ${def.numeric ? 'num' : ''} ${id === 'name' ? 'col-name sticky s2' : `col-${id}`}`}
        aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
      >
        <button onClick={() => p.onSort(id as SortKey)} title={`依 ${def.label} 排序`}>
          <span className="th-text">
            <span className="th-main">{def.label}</span>
            {sub && <span className="th-sub">{sub}</span>}
          </span>
          <SortArrows dir={dir} />
        </button>
      </th>
    );
  };

  const cell = (id: ColId, m: Material) => {
    const prop = propDef(id);
    if (prop) {
      const v = m[prop.key];
      return (
        <td key={id} className={`num ${v === null ? 'missing' : ''}`} title={v === null ? `${prop.label} 無資料` : undefined}>
          {formatValue(prop.key, v, p.units)}
        </td>
      );
    }
    switch (id) {
      case 'name':
        return <td key={id} className="col-name sticky s2">{m.name}</td>;
      case 'category':
        return <td key={id} className="col-category"><span className="table-category"><i className={`category-dot category-${m.category}`} aria-hidden="true" />{CATEGORY_LABEL[m.category]}</span></td>;
      case 'source':
        return (
          <td key={id} className="col-source" title={m.source}>
            {m.source || <span className="muted">—</span>}
          </td>
        );
      default:
        return <td key={id} className="col-updatedAt" title={m.updatedAt}>{formatDay(m.updatedAt)}</td>;
    }
  };

  const colSpan = p.columns.length + 3;

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table className="mat-table">
          <thead>
            <tr>
              <th className="col-check sticky s0">
                <input
                  ref={selectAll}
                  type="checkbox"
                  checked={false}
                  disabled={p.selected.length === 0}
                  onChange={p.onClearSelection}
                  aria-label="清除選取"
                  title="清除選取"
                />
              </th>
              <th className="col-idx sticky s1">#</th>
              {p.columns.map(header)}
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((m, i) => {
              const checked = p.selected.includes(m.id);
              return (
                <tr
                  key={m.id}
                  className={`${checked ? 'selected' : ''} ${p.activeId === m.id ? 'active' : ''}`}
                  onClick={() => p.onOpen(m)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) p.onOpen(m);
                  }}
                >
                  <td className="col-check sticky s0" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked} onChange={() => p.onToggle(m.id)} aria-label={`選取 ${m.name}`} />
                  </td>
                  <td className="col-idx sticky s1">{i + 1}</td>
                  {p.columns.map((id) => cell(id, m))}
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => p.onEdit(m)} aria-label={`編輯 ${m.name}`} title="編輯">
                      <EditIcon />
                    </button>
                    <button className="icon-btn danger" onClick={() => p.onDelete(m)} aria-label={`刪除 ${m.name}`} title="刪除">
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            {p.rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={colSpan}>{p.total === 0 ? '尚無材料，請按「新增材料」建立第一筆資料。' : '沒有符合目前搜尋 / 篩選條件的材料。'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>{p.rows.length === 0 ? `顯示 0 筆，共 ${p.total} 筆材料` : `顯示第 1 – ${p.rows.length} 筆，共 ${p.total} 筆材料`}</span>
        <span className="foot-hint">點選列可查看詳細資料 · 勾選多筆材料即可比較</span>
      </div>
    </div>
  );
}
