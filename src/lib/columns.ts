import { useCallback, useEffect, useState } from 'react';
import type { PropKey } from '../types';
import { PROPS } from './props';

export type ColId = 'name' | 'category' | PropKey | 'source' | 'updatedAt';

export interface ColDef {
  id: ColId;
  /** English column name (property names stay English everywhere). */
  label: string;
  /** Always visible and always first (the sticky identifier column). */
  pinned?: boolean;
  numeric?: boolean;
}

export const COLUMNS: ColDef[] = [
  { id: 'name', label: 'Material Name', pinned: true },
  { id: 'category', label: 'Category' },
  ...PROPS.map((p) => ({ id: p.key as ColId, label: p.label, numeric: true })),
  { id: 'source', label: 'Source' },
  { id: 'updatedAt', label: 'Updated' },
];

export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c])) as Record<ColId, ColDef>;

/** Reorderable columns (everything except the pinned Material Name). */
export const DEFAULT_ORDER: ColId[] = COLUMNS.filter((c) => !c.pinned).map((c) => c.id);

export interface ColumnPrefs {
  order: ColId[];
  hidden: ColId[];
}

const KEY = 'cae-material-library:columns:v1';

/** Repairs stored prefs: drops unknown ids, appends columns added in later versions. */
export function normalizePrefs(raw: unknown): ColumnPrefs {
  const known = new Set<ColId>(DEFAULT_ORDER);
  const r = (raw ?? {}) as Partial<ColumnPrefs>;
  const order = (Array.isArray(r.order) ? r.order : []).filter((id, i, a): id is ColId => known.has(id as ColId) && a.indexOf(id) === i);
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const hidden = (Array.isArray(r.hidden) ? r.hidden : []).filter((id): id is ColId => known.has(id as ColId));
  return { order, hidden };
}

function load(): ColumnPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalizePrefs(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return normalizePrefs(null);
}

export function useColumnPrefs() {
  const [prefs, setPrefs] = useState<ColumnPrefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }, [prefs]);

  const move = useCallback((from: ColId, to: ColId) => {
    setPrefs((p) => {
      if (from === to) return p;
      const order = p.order.filter((id) => id !== from);
      const idx = order.indexOf(to);
      // Dropping onto a later item places the dragged column after it, onto an earlier one before it.
      const insertAt = p.order.indexOf(from) < p.order.indexOf(to) ? idx + 1 : idx;
      order.splice(insertAt, 0, from);
      return { ...p, order };
    });
  }, []);

  const step = useCallback((id: ColId, dir: -1 | 1) => {
    setPrefs((p) => {
      const i = p.order.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.order.length) return p;
      const order = [...p.order];
      [order[i], order[j]] = [order[j], order[i]];
      return { ...p, order };
    });
  }, []);

  const toggle = useCallback((id: ColId) => {
    setPrefs((p) => ({ ...p, hidden: p.hidden.includes(id) ? p.hidden.filter((x) => x !== id) : [...p.hidden, id] }));
  }, []);

  const reset = useCallback(() => setPrefs(normalizePrefs(null)), []);

  const visible: ColId[] = ['name', ...prefs.order.filter((id) => !prefs.hidden.includes(id))];

  return { prefs, visible, move, step, toggle, reset };
}
