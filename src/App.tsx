import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material, MaterialInput, View } from './types';
import { useMaterials } from './lib/storage';
import { EXAMPLE_ID } from './lib/orthotropicExample';
import { DatabaseStatus } from './components/DatabaseStatus';
import {
  LOCAL_EDITING_HINT,
  SUPABASE_MATERIAL_CRUD_DENIED,
  SUPABASE_WRITE_LATER,
  closeAfterDirectWrite,
  commitSupabaseIndexWrite,
  curveWriteEnabledFor,
  indexWriteEnabledFor,
  materialCrudEnabledFor,
  renamedSourceFilter,
  requestMaterialCrud,
  requestMaterialMutation,
  supabaseCommittedNotice,
  supabaseCrudDialogsShouldClose,
} from './lib/localEditing';
import { isSupabaseAdminCapability, useMaterialLibraryAuth } from './lib/useMaterialAuth';
import { LocalEditingDialog } from './components/LocalEditingDialog';
import { Modal } from './components/Modal';
import { LegacyRecovery } from './components/LegacyRecovery';
import { useColumnPrefs } from './lib/columns';
import { DEFAULT_UNITS } from './lib/format';
import type { UnitPrefs } from './lib/format';
import { sortMaterials } from './lib/sort';
import { matchesModel, materialsBeforeModelFilter } from './lib/modelView';
import type { SortKey, SortState } from './lib/sort';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import type { Filters } from './components/Toolbar';
import { ColumnSettings } from './components/ColumnSettings';
import { Sidebar } from './components/Sidebar';
import { MaterialCards } from './components/MaterialCards';
import type { LibraryMode } from './components/Toolbar';
import { MaterialTable } from './components/MaterialTable';
import { MaterialDetailPage } from './components/MaterialDetailPage';
import { materialIdFromSearch, searchWithMaterial } from './lib/detailNavigation';
import { IndexContext, type IndexKind } from './lib/indexes';
import { IndexManager } from './components/IndexManager';
import { MaterialForm } from './components/MaterialForm';
import { ComparePage } from './components/ComparePage';
import { MaterialMap } from './components/MaterialMap';
import { EtanPage } from './components/EtanPage';
import { DensityTuner } from './components/DensityTuner';
import {
  ConfirmDelete,
  HelpDialog,
  ImportExportDialog,
  MapInfoDialog,
} from './components/Dialogs';

type Dialog = 'help' | 'io' | 'mapInfo' | 'localEditing' | 'supabaseReadOnly' | 'supabaseCrudDenied' | null;

// Same true-branch comparison used by storage, so a legacy build drops the Supabase write calls.
const supabaseDataSourceEnabled = import.meta.env
  ? import.meta.env.VITE_MATERIAL_DATA_SOURCE === 'supabase'
  : false;
const supabaseIndexDirectHint = supabaseDataSourceEnabled ? '變更會直接寫入 Supabase。' : undefined;

export function App() {
  const materialState = useMaterials();
  const auth = useMaterialLibraryAuth(materialState.dataSource === 'supabase');
  const supabaseAdmin = isSupabaseAdminCapability(materialState.dataSource, auth.snapshot.status);
  const { materials, add, update, remove, importMany, discardDraft, setCurve, clearCurve, indexes, editIndex,
    editable, saveError, legacy, dismissLegacy, importLegacy, showLegacy, importDatabase, database } = materialState;

  const [indexManager, setIndexManager] = useState<IndexKind | null>(null);
  const categoryLabels = useMemo(
    () => Object.fromEntries(indexes.categories.map(c => [c.id, c.label])),
    [indexes.categories],
  );
  const [view, setView] = useState<View>('materials');
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('table');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({
    category: 'all',
    source: 'all',
    updated: 'all',
    model: 'all',
  });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [indexRemoteStale, setIndexRemoteStale] = useState(false);
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
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteLock = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const pushedDetail = useRef(false);
  const materialCrudEnabled = materialCrudEnabledFor(materialState.dataSource, editable, supabaseAdmin);
  const curveWriteEnabled = curveWriteEnabledFor(materialState.dataSource, editable, supabaseAdmin);
  const indexWriteEnabled = indexWriteEnabledFor(materialState.dataSource, editable, supabaseAdmin);

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
    if (!supabaseCrudDialogsShouldClose(materialState.dataSource, supabaseAdmin)) return;
    setEditing(null);
    setDeleting(null);
    setDeleteError(null);
  }, [materialState.dataSource, supabaseAdmin]);

  useEffect(() => {
    if (indexWriteEnabled || materialState.materialWriting) return;
    setIndexManager(null);
  }, [indexWriteEnabled, materialState.materialWriting]);

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
    const beforeModel = materialsBeforeModelFilter(materials, {
      category: filters.category,
      source: filters.source,
      updated: filters.updated,
      query,
    }, categoryLabels);
    return sortMaterials(beforeModel.filter((material) => matchesModel(material, filters.model ?? 'all')), sort);
  }, [materials, filters, query, sort, categoryLabels]);

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

  const save = async (input: MaterialInput) => {
    if (supabaseDataSourceEnabled && materialState.dataSource === 'supabase' && 'materialMutations' in materialState && materialState.materialMutations) {
      const mutations = materialState.materialMutations;
      const editingId = editing && editing !== 'new' ? editing.id : null;
      await closeAfterDirectWrite(async () => {
        if (editingId) await mutations.updateMaterial(editingId, input);
        else await mutations.add(input);
      }, () => {
        setNotice(supabaseCommittedNotice(editingId ? 'edit' : 'add', input.name));
        setEditing(null);
      });
      return;
    }
    const saveHint = materialState.exampleMode ? '請按「儲存範例」保留在此分頁。' : '請按 Save Database 寫入資料庫。';
    if (editing && editing !== 'new') {
      update(editing.id, input);
      setNotice(`已更新 ${input.name} 草稿；${saveHint}`);
    } else {
      add(input);
      setNotice(`已新增 ${input.name} 草稿；${saveHint}`);
    }
    setEditing(null);
  };

  const confirmDelete = () => {
    if (!deleting || deleteLock.current) return;
    const target = deleting;
    if (!(supabaseDataSourceEnabled && materialState.dataSource === 'supabase' && 'materialMutations' in materialState && materialState.materialMutations)) {
      remove(target.id);
      setNotice(`已從草稿刪除 ${target.name}；請按 Save Database。`);
      if (detailId === target.id) closeDetail();
      setDeleting(null);
      return;
    }
    const mutations = materialState.materialMutations;
    deleteLock.current = true;
    setDeletePending(true);
    setDeleteError(null);
    void closeAfterDirectWrite(
      () => mutations.remove(target.id),
      () => {
        setNotice(supabaseCommittedNotice('delete', target.name));
        if (detailId === target.id) closeDetail();
        setDeleting(current => current?.id === target.id ? null : current);
      },
    ).catch(error => {
      setDeleteError(error instanceof Error && error.message ? error.message : '材料刪除失敗。');
    }).finally(() => {
      deleteLock.current = false;
      setDeletePending(false);
    });
  };

  const openDetail = (m: Material) => {
    setDetailId(m.id);
    if (materialIdFromSearch(window.location.search) === m.id) return;
    const next = `${window.location.pathname}${searchWithMaterial(window.location.search, m.id)}${window.location.hash}`;
    window.history.pushState({ materialDetail: true }, '', next);
    pushedDetail.current = true;
  };
  const closeDetail = () => {
    if (pushedDetail.current) {
      pushedDetail.current = false;
      window.history.back();
      return;
    }
    setDetailId(null);
    const next = `${window.location.pathname}${searchWithMaterial(window.location.search, null)}${window.location.hash}`;
    window.history.replaceState({}, '', next);
  };

  useEffect(() => {
    const apply = () => {
      pushedDetail.current = false;
      setDetailId(materialIdFromSearch(window.location.search));
    };
    const initial = materialIdFromSearch(window.location.search);
    if (initial) setDetailId(initial);
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, []);

  const navigate = (v: View) => setView(v);
  const showLocalEditing = () => setDialog('localEditing');
  const showSupabaseReadOnly = () => setDialog('supabaseReadOnly');
  const crudReadOnlyTitle = materialState.dataSource === 'supabase' ? SUPABASE_MATERIAL_CRUD_DENIED : LOCAL_EDITING_HINT;
  // CSV, JSON, and Save Database stay on the deferred Supabase gate.
  const requestEdit = (action: () => void) => requestMaterialMutation(
    materialState.dataSource, editable, action, showLocalEditing, showSupabaseReadOnly,
  );
  const showSupabaseCrudDenied = () => setDialog('supabaseCrudDenied');
  const requestCrud = (action: () => void) => requestMaterialCrud(
    materialCrudEnabled, materialState.dataSource, action, showLocalEditing, showSupabaseCrudDenied,
  );

  return (
    <IndexContext.Provider value={indexes}>
    <div className="app">
      <Header
        editable={materialCrudEnabled}
        readOnlyTitle={crudReadOnlyTitle}
        databaseStatus={<DatabaseStatus state={materialState} auth={auth} />}
        onHelp={() => setDialog('help')}
        onAdd={() => requestCrud(() => setEditing('new'))}
      />
      {materialState.exampleMode && <section className="orthotropic-example-banner" aria-label="FR4 獨立範例">
        <div><strong>FR4 Orthotropic 獨立範例</strong><p>可新增、編輯與比較；儲存僅限此分頁，重新整理會保留。原始 materials.json 與 FR4 density 不受影響。</p></div>
        <div className="orthotropic-example-actions">
          <button className="btn" disabled={!materials.some(m => m.id === EXAMPLE_ID)} onClick={() => { const example = materials.find(m => m.id === EXAMPLE_ID); setEditing(null); if (example) openDetail(example); }}>查看範例</button>
          <button className="btn" disabled={!materials.some(m => m.id === EXAMPLE_ID)} onClick={() => { setDetailId(null); setEditing(materials.find(m => m.id === EXAMPLE_ID)!); }}>編輯範例</button>
          <button className="btn" onClick={() => { setEditing(null); setDetailId(null); setSelected(materials.filter(m => m.id === EXAMPLE_ID || m.name === 'SGCC').map(m => m.id)); setView('compare'); }}>Mixed Compare</button>
          <a className="btn" href={import.meta.env.BASE_URL}>離開範例</a>
        </div>
      </section>}
      <div className="workspace-shell">
        <Sidebar
          materials={materials}
          view={view}
          onNavigate={navigate}
          filters={filters}
          onFilters={setFilters}
          selectedCount={selected.length}
          onManage={(kind) => {
            if (!indexWriteEnabled || indexRemoteStale) return;
            setIndexManager(kind);
          }}
          indexManageEnabled={indexWriteEnabled && !indexRemoteStale}
        />
        <div className="workspace-content">
          {detail && (
            <MaterialDetailPage
              editable={editable}
              materialCrudEnabled={materialCrudEnabled}
              curveEditable={curveWriteEnabled}
              curvePending={materialState.materialWriting}
              readOnlyTitle={crudReadOnlyTitle}
              material={detail}
              units={units}
              onClose={closeDetail}
              onEdit={() => requestCrud(() => setEditing(detail))}
              onDelete={() => requestCrud(() => { setDeleteError(null); setDeleting(detail); })}
              onSaveCurve={async (data) => {
                if (supabaseDataSourceEnabled && materialState.dataSource === 'supabase') {
                  if (!('extendedMutations' in materialState) || !materialState.extendedMutations) return 'Supabase 曲線寫入未啟用。';
                  try {
                    await materialState.extendedMutations.saveCurve(detail.id, data);
                    setNotice(`已更新 Supabase 材料曲線：${detail.name}。`);
                    return null;
                  } catch (error) {
                    return error instanceof Error && error.message ? error.message : '曲線儲存失敗。';
                  }
                }
                const error = setCurve(detail.id, data);
                if (!error) setNotice(`已更新 ${detail.name} 的完整曲線草稿；請按 Save Database。`);
                return error;
              }}
              onDeleteCurve={async () => {
                if (supabaseDataSourceEnabled && materialState.dataSource === 'supabase') {
                  if (!('extendedMutations' in materialState) || !materialState.extendedMutations) return 'Supabase 曲線寫入未啟用。';
                  try {
                    await materialState.extendedMutations.clearCurve(detail.id);
                    setNotice(`已刪除 Supabase 材料完整曲線：${detail.name}。`);
                    return null;
                  } catch (error) {
                    return error instanceof Error && error.message ? error.message : '曲線刪除失敗。';
                  }
                }
                const error = clearCurve(detail.id);
                if (!error) setNotice(`已移除 ${detail.name} 的完整曲線草稿；請按 Save Database。`);
                return error;
              }}
            />
          )}
          {!detail && view === 'materials' && (
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
                  editable={materialCrudEnabled}
                  readOnlyTitle={crudReadOnlyTitle}
                  rows={rows}
                  total={materials.length}
                  columns={cols.visible}
                  sort={sort}
                  onSort={onSort}
                  selected={selected}
                  onToggle={toggle}
                  onClearSelection={() => setSelected([])}
                  onOpen={openDetail}
                  onEdit={(m) => requestCrud(() => setEditing(m))}
                  onDelete={(m) => requestCrud(() => { setDeleteError(null); setDeleting(m); })}
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

          {!detail && view === 'compare' && (
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

          {!detail && view === 'etan' && <EtanPage materials={materials} />}

          {!detail && view === 'density-tuner' && <DensityTuner />}

          {!detail && view === 'map' && (
            <MaterialMap
              materials={materials}
              onBack={() => setView('materials')}
              onInfo={() => setDialog('mapInfo')}
              onOpen={openDetail}
            />
          )}
        </div>
      </div>

      {editing && materialCrudEnabled && (
        <MaterialForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          existing={materials}
          restrictSourceToExisting={materialState.dataSource === 'supabase'}
          pending={materialState.materialWriting}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && materialCrudEnabled && (
        <ConfirmDelete
          material={deleting}
          direct={materialState.dataSource === 'supabase'}
          pending={deletePending}
          error={deleteError}
          onConfirm={confirmDelete}
          onClose={() => { if (!deletePending) { setDeleteError(null); setDeleting(null); } }}
        />
      )}
      {indexManager && (indexWriteEnabled || materialState.materialWriting) && (
        <IndexManager
          kind={indexManager}
          materials={materials}
          direct={materialState.dataSource === 'supabase'}
          directHint={supabaseIndexDirectHint}
          pending={materialState.materialWriting}
          onClose={() => setIndexManager(null)}
          onRemoteCommitted={() => setIndexRemoteStale(true)}
          onSave={async (id, name) => {
            if (supabaseDataSourceEnabled && materialState.dataSource === 'supabase') {
              const result = await commitSupabaseIndexWrite({
                stale: indexRemoteStale,
                kind: indexManager,
                id,
                name,
                readActiveSource: () => filtersRef.current.source,
                mutations: 'extendedMutations' in materialState ? materialState.extendedMutations : null,
              });
              if (result.notice) setNotice(result.notice);
              if (result.sourceFilter !== null) setFilters({ ...filtersRef.current, source: result.sourceFilter });
              return result.message;
            }
            const error = editIndex(indexManager, id, name);
            if (!error && indexManager === 'source' && id !== null) {
              const nextSource = renamedSourceFilter(filters.source, id, name);
              if (nextSource !== null) setFilters({ ...filters, source: nextSource });
            }
            return error;
          }}
        />
      )}
      {dialog === 'help' && <HelpDialog mode={materialState.exampleMode ? 'example' : materialState.dataSource} onClose={() => setDialog(null)} />}
      {dialog === 'localEditing' && <LocalEditingDialog onClose={() => setDialog(null)} supported={materialState.fileSupported} permissionNeeded={materialState.fileStatus === 'permission'} onConnect={() => { setDialog(null); void materialState.connectFile(); }} />}
      {dialog === 'supabaseReadOnly' && <Modal title="此功能目前為唯讀" width={440} onClose={() => setDialog(null)}><p>{SUPABASE_WRITE_LATER}</p></Modal>}
      {dialog === 'supabaseCrudDenied' && <Modal title="沒有材料寫入權限" width={440} onClose={() => setDialog(null)}><p>{SUPABASE_MATERIAL_CRUD_DENIED}</p></Modal>}
      {dialog === 'mapInfo' && (
        <MapInfoDialog onClose={() => setDialog(null)} />
      )}
      {dialog === 'io' && (
        <ImportExportDialog
          editable={editable}
          dirty={materialState.dirty}
          database={database}
          readOnlyHint={materialState.dataSource === 'supabase' ? SUPABASE_WRITE_LATER : undefined}
          onReadOnly={() => requestEdit(() => {})}
          onRecover={importDatabase}
          onLegacy={showLegacy}
          showLegacyRecovery={materialState.dataSource !== 'supabase'}
          materials={materials}
          visibleRows={rows}
          onImport={importMany}
          onReset={() => {
            discardDraft();
            setSelected([]);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {legacy && <LegacyRecovery recovery={legacy} editable={editable} onImport={importLegacy} onClose={dismissLegacy} />}
      {saveError && <div className="database-save-error" role="alert">{saveError} 尚未確認儲存成功；草稿仍保留，可從「匯入 / 匯出」下載備份。</div>}

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
    </IndexContext.Provider>
  );
}
