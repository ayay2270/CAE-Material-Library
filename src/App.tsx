import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material, MaterialInput, View } from './types';
import { useMaterials } from './lib/storage';
import { downloadCsv } from './lib/csv';
import { DEFAULT_UNITS } from './lib/format';
import type { UnitPrefs } from './lib/format';
import { matchesQuery, sortMaterials } from './lib/sort';
import type { SortKey, SortState } from './lib/sort';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import type { CategoryFilter } from './components/Toolbar';
import { MaterialTable } from './components/MaterialTable';
import { MaterialDrawer } from './components/MaterialDrawer';
import { MaterialForm } from './components/MaterialForm';
import { ComparePage } from './components/ComparePage';
import { MaterialMap } from './components/MaterialMap';
import { ConfirmDelete, HelpDialog, ImportExportDialog, MapInfoDialog, UnitsDialog } from './components/Dialogs';

type Dialog = 'units' | 'help' | 'io' | 'mapInfo' | null;

export function App() {
  const { materials, add, update, remove, importMany, resetToSamples } = useMaterials();

  const [view, setView] = useState<View>('materials');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
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
    setSelected((s) => (s.every((id) => materials.some((m) => m.id === id)) ? s : s.filter((id) => materials.some((m) => m.id === id))));
  }, [materials]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !document.querySelector('.overlay')) {
        e.preventDefault();
        setView('materials');
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const rows = useMemo(() => {
    const filtered = materials.filter((m) => (category === 'All' || m.category === category) && matchesQuery(m, query));
    return sortMaterials(filtered, sort);
  }, [materials, category, query, sort]);

  const detail = materials.find((m) => m.id === detailId) ?? null;

  const toggle = (id: string): boolean => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      return true;
    }
    if (selected.length >= 3) {
      setNotice('Compare supports up to 3 materials — untick one first.');
      return false;
    }
    setSelected([...selected, id]);
    return true;
  };

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const save = (input: MaterialInput) => {
    if (editing && editing !== 'new') {
      update(editing.id, input);
      setNotice(`Saved changes to ${input.name}.`);
    } else {
      add(input);
      setNotice(`Added ${input.name}.`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove(deleting.id);
    setNotice(`Deleted ${deleting.name}.`);
    if (detailId === deleting.id) setDetailId(null);
    setDeleting(null);
  };

  const openDetail = (m: Material) => setDetailId(m.id);

  const navigate = (v: View) => setView(v);

  return (
    <div className="app">
      <Header
        view={view}
        query={query}
        onQuery={setQuery}
        onNavigate={navigate}
        onImportExport={() => setDialog('io')}
        onHelp={() => setDialog('help')}
        compareCount={selected.length}
      />

      {view === 'materials' && (
        <main className="page materials-page">
          <Toolbar
            ref={searchRef}
            materials={materials}
            query={query}
            onQuery={setQuery}
            category={category}
            onCategory={setCategory}
            selectedCount={selected.length}
            onMap={() => setView('map')}
            onCompare={() => setView('compare')}
            onUnits={() => setDialog('units')}
            onExport={() => downloadCsv(rows)}
            onAdd={() => setEditing('new')}
          />
          <MaterialTable
            rows={rows}
            total={materials.length}
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
        </main>
      )}

      {view === 'compare' && (
        <ComparePage
          materials={materials}
          selected={selected}
          units={units}
          onToggle={toggle}
          onBack={() => setView('materials')}
          onOpen={openDetail}
        />
      )}

      {view === 'map' && (
        <MaterialMap materials={materials} onBack={() => setView('materials')} onInfo={() => setDialog('mapInfo')} onOpen={openDetail} />
      )}

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
      {deleting && <ConfirmDelete material={deleting} onConfirm={confirmDelete} onClose={() => setDeleting(null)} />}
      {dialog === 'units' && <UnitsDialog units={units} onChange={setUnits} onClose={() => setDialog(null)} />}
      {dialog === 'help' && <HelpDialog onClose={() => setDialog(null)} />}
      {dialog === 'mapInfo' && <MapInfoDialog onClose={() => setDialog(null)} />}
      {dialog === 'io' && (
        <ImportExportDialog
          materials={materials}
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
