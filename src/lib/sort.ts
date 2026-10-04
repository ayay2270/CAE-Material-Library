import type { Material } from '../types';
import { CATEGORY_LABEL } from '../types';
import { PROPS } from './props';

export type SortKey = 'name' | 'category' | 'source' | 'updatedAt' | (typeof PROPS)[number]['key'];
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function value(m: Material, key: SortKey): string | number | null {
  const v = m[key];
  if (typeof v === 'string' && v === '') return null;
  return v;
}

/** Missing values always sort last, whichever direction is active. */
export function sortMaterials(list: Material[], sort: SortState): Material[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const x = value(a, sort.key);
    const y = value(b, sort.key);
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    const c =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
    return c !== 0 ? c * sign : a.name.localeCompare(b.name);
  });
}

export function matchesQuery(m: Material, q: string, labels: Record<string,string> = CATEGORY_LABEL): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const label = typeof labels[m.category] === 'string' ? labels[m.category] : m.category;
  return [m.name, m.source, m.notes, m.category, label].some((f) => f.toLowerCase().includes(s));
}

export type UpdatedFilter = 'all' | 'today' | '7d' | '30d' | '90d';
export const UPDATED_OPTIONS: { value: UpdatedFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
];

export function matchesUpdated(m: Material, f: UpdatedFilter, now = Date.now()): boolean {
  if (f === 'all') return true;
  const t = new Date(m.updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  if (f === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return t >= d.getTime();
  }
  const days = f === '7d' ? 7 : f === '30d' ? 30 : 90;
  return t >= now - days * 86400000;
}
