import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material, MaterialInput, View } from './types';
import { useMaterials } from './lib/storage';
import { useColumnPrefs } from './lib/columns';
import { DEFAULT_UNITS } from './lib/format';
import type { UnitPrefs } from './lib/format';
import { matchesQuery, matchesUpdated, sortMaterials } from './lib/sort';
import type { SortKey, SortState } from './lib/sort';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import type { Filters } from './components/Toolbar';
import { ColumnSettings } from './components/ColumnSettings';
import { Sidebar } from './components/Sidebar';
import { MaterialCards } from './components/MaterialCards';
import type { LibraryMode } from './components/Toolbar';
import { MaterialTable } from './components/MaterialTable';
import { MaterialDrawer } from './components/MaterialDrawer';
import { MaterialForm } from './components/MaterialForm';
import { ComparePage } from './components/ComparePage';
import { MaterialMap } from './components/MaterialMap';
import { EtanPage } from './components/EtanPage';
import {
  ConfirmDelete,
  HelpDialog,
  ImportExportDialog,
  MapInfoDialog,
} from './components/Dialogs';

type Dialog = 'help' | 'io' | 'mapInfo' | null;

export function App() {
  const { materials, add, update, remove, importMany, resetToSamples } =
    useMaterials();

  const [view, setView] = useState<View>('materials');
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('table');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    source: 'all',
    updated: 'all',
  });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const cols = useColumnPrefs();
  const [sort, setSort] = useState<SortState>({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitPrefs>(DEFAULT_UNITS);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Drop selections that no longer exist (deleted / reset).
  useEffect(() => {
    setSelected((s) =>
      s.every((id) => materials.some((m) => m.id === id))
        ? s
        : s.filter((id) => materials.some((m) => m.id === id)),
    );
  }, [materials]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key === '/' &&
        !/INPUT|TEXTAREA|SELECT/.test(t.tagName) &&
        !document.querySelector('.overlay')
      ) {
        e.preventDefault();
        setView('materials');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

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

  const detail = materials.find((m) => m.id === detailId) ?? null;

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  const save = (input: MaterialInput) => {
    if (editing && editing !== 'new') {
      update(editing.id, input);
      setNotice(`已儲存 ${input.name} 的變更。`);
    } else {
      add(input);
      setNotice(`已新增 ${input.name}。`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove(deleting.id);
    setNotice(`已刪除 ${deleting.name}。`);
    if (detailId === deleting.id) setDetailId(null);
    setDeleting(null);
  };

  const openDetail = (m: Material) => setDetailId(m.id);

  const navigate = (v: View) => setView(v);

  return (
    <div className="app">
      <Header
        onHelp={() => setDialog('help')}
        onAdd={() => setEditing('new')}
      />
      <div className="workspace-shell">
        <Sidebar
          materials={materials}
          view={view}
          onNavigate={navigate}
          filters={filters}
          onFilters={setFilters}
          selectedCount={selected.length}
        />
        <div className="workspace-content">
          {view === 'materials' && (
            <main className="page materials-page">
              <Toolbar
                ref={searchRef}
                materials={materials}
                query={query}
                onQuery={setQuery}
                filters={filters}
                onFilters={setFilters}
                selectedCount={selected.length}
                onCompare={() => setView('compare')}
                onClearSelection={() => setSelected([])}
                onColumns={() => setColumnsOpen((o) => !o)}
                onImportExport={() => setDialog('io')}
                mode={libraryMode}
                onMode={setLibraryMode}
                sort={sort}
                onSortState={setSort}
                units={units}
                onUnits={setUnits}
                visibleCount={rows.length}
                columnsPopover={
                  columnsOpen && (
                    <ColumnSettings
                      prefs={cols.prefs}
                      units={units}
                      onUnits={setUnits}
                      onMove={cols.move}
                      onStep={cols.step}
                      onToggle={cols.toggle}
                      onReset={cols.reset}
                      onClose={() => setColumnsOpen(false)}
                    />
                  )
                }
              />
              {libraryMode === 'table' ? (
                <MaterialTable
                  rows={rows}
                  total={materials.length}
                  columns={cols.visible}
                  sort={sort}
                  onSort={onSort}
                  selected={selected}
                  onToggle={toggle}
                  onClearSelection={() => setSelected([])}
                  onOpen={openDetail}
                  onEdit={(m) => setEditing(m)}
                  onDelete={(m) => setDeleting(m)}
                  units={units}
                  activeId={detailId}
                />
              ) : (
                <MaterialCards
                  rows={rows}
                  total={materials.length}
                  selected={selected}
                  onToggle={toggle}
                  onOpen={openDetail}
                  units={units}
                  activeId={detailId}
                />
              )}
            </main>
          )}

          {view === 'compare' && (
            <ComparePage
              materials={materials}
              selected={selected}
              units={units}
              onToggle={toggle}
              onClear={() => setSelected([])}
              onBack={() => setView('materials')}
              onOpen={openDetail}
            />
          )}

          {view === 'etan' && <EtanPage materials={materials} />}

          {view === 'map' && (
            <MaterialMap
              materials={materials}
              onBack={() => setView('materials')}
              onInfo={() => setDialog('mapInfo')}
              onOpen={openDetail}
            />
          )}
        </div>
      </div>

      {detail && !editing && !deleting && (
        <MaterialDrawer
          material={detail}
          units={units}
          onClose={() => setDetailId(null)}
          onEdit={() => setEditing(detail)}
          onDelete={() => setDeleting(detail)}
        />
      )}
      {editing && (
        <MaterialForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          existing={materials}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          material={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        />
      )}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'mapInfo' && (
        <MapInfoDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'io' && (
        <ImportExportDialog
          materials={materials}
          visibleRows={rows}
          onImport={importMany}
          onReset={() => {
            resetToSamples();
            setSelected([]);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
