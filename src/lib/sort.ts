import type { Material } from '../types';
import { filledCount, PROPS } from './props';

export type SortKey = 'name' | 'category' | 'completeness' | 'source' | 'updatedAt' | (typeof PROPS)[number]['key'];
export interface SortState {
  key: SortKey;
  dir: 'asc' | 'desc';
}

function value(m: Material, key: SortKey): string | number | null {
  if (key === 'completeness') return filledCount(m);
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

export function matchesQuery(m: Material, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [m.name, m.source, m.notes, m.category].some((f) => f.toLowerCase().includes(s));
}
