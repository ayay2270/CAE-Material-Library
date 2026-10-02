import { useEffect, useRef } from 'react';
import type { Material } from '../types';
import { PROPS, filledCount } from '../lib/props';
import { formatDate, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import type { SortKey, SortState } from '../lib/sort';
import { CompletenessBar } from './CompletenessBar';
import { EditIcon, SortArrows, TrashIcon } from './icons';

interface Props {
  rows: Material[];
  total: number;
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

export function MaterialTable(p: Props) {
  const selectAll = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = p.selected.length > 0;
  }, [p.selected.length]);

  const th = (key: SortKey, label: string, opts?: { sub?: string; symbol?: string; className?: string }) => {
    const dir = p.sort.key === key ? p.sort.dir : null;
    return (
      <th
        key={key}
        className={`sortable ${opts?.className ?? ''}`}
        aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
      >
        <button onClick={() => p.onSort(key)} title={`Sort by ${label}`}>
          <span className="th-text">
            <span className="th-main">
              {opts?.symbol && <span className="sym">{opts.symbol}</span>}
              {label}
            </span>
            {opts?.sub && <span className="th-sub">{opts.sub}</span>}
          </span>
          <SortArrows dir={dir} />
        </button>
      </th>
    );
  };

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
                  aria-label="Clear selection"
                  title="Clear selection"
                />
              </th>
              <th className="col-idx sticky s1">#</th>
              {th('name', 'Material', { sub: 'Name', className: 'col-name sticky s2' })}
              {th('category', 'Category', { className: 'col-cat' })}
              {PROPS.map((d) =>
                th(d.key, d.label, {
                  symbol: d.symbol,
                  sub: d.optional ? `${unitFor(d, p.units)} · optional` : unitFor(d, p.units),
                  className: 'num',
                }),
              )}
              {th('completeness', 'Completeness', { sub: `Filled / ${PROPS.length}`, className: 'col-comp' })}
              {th('source', 'Source', { className: 'col-src' })}
              {th('updatedAt', 'Updated', { sub: 'Last', className: 'col-date' })}
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
                    <input type="checkbox" checked={checked} onChange={() => p.onToggle(m.id)} aria-label={`Select ${m.name}`} />
                  </td>
                  <td className="col-idx sticky s1">{i + 1}</td>
                  <td className="col-name sticky s2">{m.name}</td>
                  <td className="col-cat">{m.category}</td>
                  {PROPS.map((d) => {
                    const v = m[d.key];
                    return (
                      <td key={d.key} className={`num ${v === null ? 'missing' : ''}`} title={v === null ? `${d.label} not available` : undefined}>
                        {formatValue(d.key, v, p.units)}
                      </td>
                    );
                  })}
                  <td className="col-comp">
                    <CompletenessBar filled={filledCount(m)} />
                  </td>
                  <td className="col-src" title={m.source}>
                    {m.source || <span className="muted">—</span>}
                  </td>
                  <td className="col-date">{formatDate(m.updatedAt)}</td>
                  <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => p.onEdit(m)} aria-label={`Edit ${m.name}`} title="Edit">
                      <EditIcon />
                    </button>
                    <button className="icon-btn danger" onClick={() => p.onDelete(m)} aria-label={`Delete ${m.name}`} title="Delete">
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            {p.rows.length === 0 && (
              <tr className="empty-row">
                <td colSpan={PROPS.length + 8}>
                  {p.total === 0 ? 'No materials yet. Use “+ Add Material” to create the first record.' : 'No materials match the current search / filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>
          {p.rows.length === 0
            ? `Showing 0 of ${p.total} materials`
            : `Showing 1 – ${p.rows.length} of ${p.total} materials`}
        </span>
        <span className="foot-hint">Click a row for details · tick 2–3 rows to compare</span>
      </div>
    </div>
  );
}
