import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Material, MaterialInput } from '../../types';
import { useMaterials } from '../../lib/storage';
import { useColumnPrefs } from '../../lib/columns';
import { DEFAULT_UNITS } from '../../lib/format';
import type { UnitPrefs } from '../../lib/format';
import { matchesQuery, matchesUpdated, sortMaterials } from '../../lib/sort';
import type { SortKey, SortState, UpdatedFilter } from '../../lib/sort';

export interface Filters {
  category: 'all' | Category;
  source: 'all' | string;
  updated: UpdatedFilter;
}
export const NO_FILTERS: Filters = { category: 'all', source: 'all', updated: 'all' };
export type Dialog = 'help' | 'io' | 'mapInfo' | null;

/**
 * One shared engine for all concept UIs. It re-uses the production data/logic modules unchanged
 * (storage, columns, sort, filters, units, CSV) so every concept behaves identically — only the UI differs.
 */
export function useLibrary() {
  const store = useMaterials();
  const cols = useColumnPrefs();
  const { materials } = store;

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitPrefs>(DEFAULT_UNITS);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  useEffect(() => {
    setSelected((s) => (s.every((id) => materials.some((m) => m.id === id)) ? s : s.filter((id) => materials.some((m) => m.id === id))));
    if (detailId && !materials.some((m) => m.id === detailId)) setDetailId(null);
  }, [materials, detailId]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const rows = useMemo(() => {
    const filtered = materials.filter(
      (m) =>
        (filters.category === 'all' || m.category === filters.category) &&
        (filters.source === 'all' || m.source === filters.source) &&
        matchesUpdated(m, filters.updated) &&
        matchesQuery(m, query),
    );
    return sortMaterials(filtered, sort);
  }, [materials, filters, query, sort]);

  const sources = useMemo(() => [...new Set(materials.map((m) => m.source).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [materials]);

  const toggle = useCallback((id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])), []);
  const clearSelection = useCallback(() => setSelected([]), []);
  const onSort = useCallback(
    (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
    [],
  );

  const save = (input: MaterialInput) => {
    if (editing && editing !== 'new') {
      store.update(editing.id, input);
      setNotice(`已儲存 ${input.name} 的變更。`);
    } else {
      const m = store.add(input);
      setDetailId(m.id);
      setNotice(`已新增 ${input.name}。`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    store.remove(deleting.id);
    setNotice(`已刪除 ${deleting.name}。`);
    if (detailId === deleting.id) setDetailId(null);
    setDeleting(null);
  };

  const detail = materials.find((m) => m.id === detailId) ?? null;
  const picked = selected.map((id) => materials.find((m) => m.id === id)).filter((m): m is Material => !!m);

  return {
    ...store,
    cols,
    materials,
    rows,
    sources,
    query,
    setQuery,
    filters,
    setFilters,
    sort,
    setSort,
    onSort,
    selected,
    setSelected,
    picked,
    toggle,
    clearSelection,
    units,
    setUnits,
    dialog,
    setDialog,
    detailId,
    setDetailId,
    detail,
    editing,
    setEditing,
    deleting,
    setDeleting,
    notice,
    setNotice,
    columnsOpen,
    setColumnsOpen,
    save,
    confirmDelete,
  };
}
export type Library = ReturnType<typeof useLibrary>;
