import type { ReactNode } from 'react';
import type { Material } from '../../types';
import { CATEGORY_LABEL } from '../../types';
import { PROPS } from '../../lib/props';
import type { PropDef } from '../../lib/props';
import { formatDateLong, formatValue, unitFor } from '../../lib/format';
import type { UnitPrefs } from '../../lib/format';
import type { ColId } from '../../lib/columns';
import { CATEGORY_COLOR } from '../../components/MaterialMap';
import type { Library } from './useLibrary';

export const propOf = (id: ColId): PropDef | undefined => PROPS.find((p) => p.key === id);

/** All properties in the user's 欄位設定 order (hidden columns are still listed in detail views). */
export function orderedProps(L: Library, onlyVisible = false): PropDef[] {
  const order = L.cols.prefs.order.filter((id) => !onlyVisible || !L.cols.prefs.hidden.includes(id));
  return order.map(propOf).filter((p): p is PropDef => !!p);
}

export function CategoryDot({ c, size = 8 }: { c: Material['category']; size?: number }) {
  return <i className="cat-dot" style={{ background: CATEGORY_COLOR[c], width: size, height: size }} aria-hidden="true" />;
}

export function CategoryTag({ c }: { c: Material['category'] }) {
  return (
    <span className="cat-chip">
      <CategoryDot c={c} /> {CATEGORY_LABEL[c]}
    </span>
  );
}

/** Property | value | unit rows; missing values keep the hatched “—” treatment. */
export function PropList({ m, units, props, className = '' }: { m: Material; units: UnitPrefs; props: PropDef[]; className?: string }) {
  return (
    <dl className={`prop-list ${className}`}>
      {props.map((p) => {
        const v = m[p.key];
        const u = unitFor(p, units);
        return (
          <div key={p.key} className={v === null ? 'missing' : ''}>
            <dt>
              {p.label}
              {p.optional && <small> (optional)</small>}
            </dt>
            <dd>{formatValue(p.key, v, units)}</dd>
            <dd className="unit">{v !== null && u !== '—' ? u : ''}</dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SourceNotes({ m }: { m: Material }) {
  return (
    <dl className="meta-list">
      <dt>Source</dt>
      <dd>{m.source || <span className="muted">—</span>}</dd>
      <dt>Updated</dt>
      <dd>{formatDateLong(m.updatedAt)}</dd>
      <dt>備註</dt>
      <dd className="notes">{m.notes || <span className="muted">無備註</span>}</dd>
    </dl>
  );
}

const ACTION_LABEL = { created: '建立', edited: '編輯', imported: '匯入' } as const;
export function HistoryList({ m }: { m: Material }) {
  return (
    <ol className="hist-list">
      {m.history.map((h, i) => (
        <li key={i}>
          <time>{formatDateLong(h.at)}</time>
          <span className={`h-action ${h.action}`}>{ACTION_LABEL[h.action]}</span>
          <span>{h.summary}</span>
        </li>
      ))}
    </ol>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="cx-empty">{children}</div>;
}
