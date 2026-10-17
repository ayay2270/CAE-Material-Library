import { useEffect, useMemo, useRef, useState } from 'react';
import { committedDatabase, LOCAL_EDITOR, readLocalDatabase, writeLocalDatabase } from './masterDatabase';
import { validateDatabase } from './database-schema.mjs';
import { detectLegacy, recoverLegacy, RECOVERY_KEY, type LegacyRecovery } from './legacy';
import { COMPOSITE_STRENGTH_PROPS, ORTHOTROPIC_PROPS, PROPS } from './props';
import { formatValue } from './format';
import type { HistoryEntry, Material, MaterialInput, StressStrainData } from '../types';
import { isStressStrainData } from './curveData';
import { changeIndex, deriveIndexes, type IndexKind } from './indexes';
import { authorizeDatabaseFile, databaseErrorChinese, databaseIsDirty, pickDatabaseFile, readDatabaseFile, restoreDatabaseFile, saveDatabaseFile, supportsFileDatabase, type DatabaseFileHandle, type FileSession } from './browserDatabase';
import { forgetHandle, getRememberedHandle, rememberHandle } from './fileHandleStore';
import { useGitHubSync } from './useGitHubSync';
import { isOrthotropicExample, readOrthotropicExample, saveOrthotropicExample } from './orthotropicExample';
import { readSupabaseDatabase } from './supabaseDatabase';
import { deleteSupabaseMaterial, insertSupabaseMaterial, updateSupabaseMaterial } from './supabaseMaterialWrites';
import {
  addSupabaseCategory,
  addSupabaseSource,
  renameSupabaseCategoryLabel,
  renameSupabaseSource,
  updateSupabaseMaterialCurve,
} from './supabaseExtendedWrites';
import {
  commitSupabaseCategoryAdd,
  commitSupabaseCategoryRename,
  commitSupabaseCurve,
  commitSupabaseSourceAdd,
  commitSupabaseSourceRename,
} from './supabaseExtendedCommit';
import {
  SUPABASE_SOURCE_DISABLED,
  commitSupabaseDelete,
  commitSupabaseInsert,
  commitSupabaseUpdate,
  createWriteLock,
  runSupabaseMaterialMutation,
} from './supabaseMaterialCommit';
import type { MasterDatabase } from './database-schema.mjs';

// The comparison stays in the true branch so a non-supabase literal makes both sides false
// and the reader import can be dropped. A missing env object never evaluates the member.
const supabaseReadOnly = import.meta.env
  ? import.meta.env.VITE_MATERIAL_DATA_SOURCE === 'supabase'
  : false;
const readSupabaseWhenEnabled = supabaseReadOnly ? readSupabaseDatabase : null;
const supabaseMaterialWriters = supabaseReadOnly
  ? { insertSupabaseMaterial, updateSupabaseMaterial, deleteSupabaseMaterial }
  : null;
const supabaseExtendedWriters = supabaseReadOnly
  ? {
      updateSupabaseMaterialCurve,
      addSupabaseCategory,
      renameSupabaseCategoryLabel,
      addSupabaseSource,
      renameSupabaseSource,
      readSupabaseDatabase,
    }
  : null;

export function newMaterialId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID() : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
const NO_CHANGES = '無欄位變更';
/** Human-readable diff of two records for the history log. */
export function describeChanges(before: Material, after: MaterialInput): string {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`名稱: ${before.name} → ${after.name}`);
  if (before.category !== after.category) changes.push(`Category: ${before.category} → ${after.category}`);
  if (after.materialModel !== undefined && before.materialModel !== after.materialModel) changes.push(`Material Model: ${before.materialModel ?? 'Isotropic'} → ${after.materialModel}`);
  if (after.subCategory !== undefined && before.subCategory !== after.subCategory) changes.push(`Sub Category: ${before.subCategory ?? '—'} → ${after.subCategory || '—'}`);
  for (const p of ORTHOTROPIC_PROPS) {
    if (after.orthotropic !== undefined && (before.orthotropic?.[p.key] ?? null) !== after.orthotropic[p.key])
      changes.push(`${p.symbol}: ${formatValue(p.key, before.orthotropic?.[p.key] ?? null)} → ${formatValue(p.key, after.orthotropic[p.key])}`);
  }
  for (const p of COMPOSITE_STRENGTH_PROPS) {
    if (after.compositeStrength !== undefined && (before.compositeStrength?.[p.key] ?? null) !== after.compositeStrength[p.key])
      changes.push(`${p.symbol}: ${formatValue(p.key, before.compositeStrength?.[p.key] ?? null)} → ${formatValue(p.key, after.compositeStrength[p.key])}`);
  }
  for (const p of PROPS) {
    if (before[p.key] !== after[p.key])
      changes.push(`${p.label}: ${formatValue(p.key, before[p.key])} → ${formatValue(p.key, after[p.key])}`);
  }
  if (before.source !== after.source) changes.push('Source');
  if (before.notes !== after.notes) changes.push('備註');
  if (after.stressStrainCurve !== undefined && JSON.stringify(before.stressStrainCurve ?? null) !== JSON.stringify(after.stressStrainCurve)) changes.push('Stress–strain curve');
  return changes.length ? changes.join('; ') : NO_CHANGES;
}

export function useMaterials() {
  const [exampleMode] = useState(() => typeof window !== 'undefined' && isOrthotropicExample(window.location.search));
  const supabaseActive = supabaseReadOnly && !exampleMode;
  const [initial] = useState(() => {
    const master = committedDatabase();
    // Accessing sessionStorage itself can fail in restricted browsers.
    if (exampleMode) {
      try { return readOrthotropicExample(master, window.sessionStorage); }
      catch { return readOrthotropicExample(master, { getItem: () => null, setItem: () => {} }); }
    }
    return master;
  });
  const [draft, setDraft] = useState(initial);
  const latest = useRef(draft);
  latest.current = draft;
  const [saved, setSaved] = useState(initial);
  const [fileSupported] = useState(() => !exampleMode && !supabaseActive && supportsFileDatabase());
  const [fileStatus, setFileStatus] = useState<'unlinked' | 'checking' | 'permission' | 'linked' | 'unsupported'>(fileSupported ? 'unlinked' : 'unsupported');
  const fileSession = useRef<FileSession | null>(null);
  const pendingHandle = useRef<DatabaseFileHandle | null>(null);
  const fileGeneration = useRef(0);
  const [fileError, setFileError] = useState<string | null>(null);
  const [backupText, setBackupText] = useState<string | null>(null);
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveSequence, setSaveSequence] = useState(0);
  const [ready, setReady] = useState(exampleMode || !LOCAL_EDITOR);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const connection = useRef({ revision: '', token: '' });
  const [legacy, setLegacy] = useState<LegacyRecovery | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(supabaseActive ? 'loading' : 'idle');
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const indexes = useMemo(() => deriveIndexes(draft.materials, draft.indexes), [draft]);
  const editable = !supabaseActive && (exampleMode || fileStatus === 'linked' || (LOCAL_EDITOR && ready && !fileSession.current));
  const dirty = databaseIsDirty({ ...draft, indexes }, saved);
  const github = useGitHubSync(saved, !supabaseActive && !exampleMode && (fileStatus === 'linked' || (LOCAL_EDITOR && ready)), saveSequence);
  const applyFile = (session: FileSession) => {
    fileSession.current = session; pendingHandle.current = session.handle;
    latest.current = session.database; setDraft(session.database); setSaved(session.database);
    setFileStatus('linked'); setLastReadAt(Date.now()); setLastSavedAt(null); setSaveError(null);
  };
  const setMaterials = (update: Material[] | ((list: Material[]) => Material[])) => {
    const materials = typeof update === 'function' ? update(latest.current.materials) : update;
    // Keep previously-used, now unused categories/sources rather than losing zero-count entries.
    latest.current = { ...latest.current, materials, indexes: deriveIndexes(materials, deriveIndexes(latest.current.materials, latest.current.indexes)) };
    setDraft(latest.current);
  };
  useEffect(() => {
    // Example mode and Supabase mode skip the dev writer, remembered files, and legacy recovery.
    // Catalog reads stay public. Confirmed Admin writes use their own capabilities. Generic editable stays false.
    if (exampleMode || supabaseActive) return;
    let cancelled = false;
    const version = fileGeneration.current;
    const load = async () => {
      try {
        const master = LOCAL_EDITOR ? await readLocalDatabase() : { database: initial, revision: '', token: '' };
        if (cancelled || version !== fileGeneration.current) return;
        connection.current = master;
        latest.current = master.database;
        setDraft(master.database); setSaved(master.database); setReady(true);
        try { setLegacy(detectLegacy(localStorage, master.database)); } catch { /* blocked browser storage does not block the Git master */ }
        if (fileSupported) {
          try {
            const handle = await getRememberedHandle();
            if (cancelled || version !== fileGeneration.current || !handle) return;
            pendingHandle.current = handle;
            const session = await restoreDatabaseFile(handle);
            if (cancelled || version !== fileGeneration.current) return;
            if (session && !databaseIsDirty(latest.current, master.database)) applyFile(session);
            else if (session) setFileError('已有未儲存草稿，因此未自動切換至記住的檔案。請先儲存或匯出草稿。');
            else setFileStatus('permission');
          } catch (error) {
            if (!cancelled && version === fileGeneration.current) setFileError(databaseErrorChinese(error));
          }
        }
      } catch (error) {
        if (!cancelled) setSaveError(error instanceof Error ? error.message : '本機資料庫讀取失敗。');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [initial, exampleMode, supabaseActive]);
  useEffect(() => {
    if (!supabaseActive) return;
    let cancelled = false;
    setSupabaseStatus('loading');
    setSupabaseError(null);
    void (async () => {
      try {
        if (!readSupabaseWhenEnabled) throw new Error('Supabase 資料來源未啟用。');
        const database = await readSupabaseWhenEnabled();
        if (cancelled) return;
        latest.current = database;
        setDraft(database);
        setSaved(database);
        setSupabaseStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setSupabaseStatus('error');
        setSupabaseError(error instanceof Error && error.message ? error.message : 'Supabase 讀取失敗。');
      }
    })();
    return () => { cancelled = true; };
  }, [supabaseActive]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const assertEditor = () => { if (!editable) throw new Error('資料庫尚未就緒，或目前為唯讀模式。'); };
  const connectFile = async (forcePick = false) => {
    if (exampleMode || supabaseActive) return;
    if (savingRef.current || fileStatus === 'checking') return;
    if (dirty && (forcePick || fileStatus !== 'permission')) { setFileError('有未儲存變更，請先儲存或匯出草稿並取消未儲存變更，再連結其他檔案。'); return; }
    ++fileGeneration.current;
    setFileError(null);
    const previousStatus = fileStatus;
    setFileStatus('checking');
    try {
      const handle = !forcePick && previousStatus === 'permission' && pendingHandle.current
        ? pendingHandle.current : (await pickDatabaseFile())[0];
      if (!handle) { setFileStatus(previousStatus); return; }
      // Permission requests occur only in this explicit user action.
      if (!await authorizeDatabaseFile(handle)) {
        pendingHandle.current = handle; setFileStatus('permission');
        setFileError('尚未取得讀寫權限，請按「重新授權」並允許存取。'); return;
      }
      const session = await readDatabaseFile(handle);
      if (dirty && fileSession.current) {
        if (session.canonical !== fileSession.current.canonical) throw new Error('本機檔案與未儲存草稿的基準不同。請先匯出草稿，再取消未儲存變更並重新讀取。');
        setFileStatus('linked'); setLastReadAt(Date.now());
      } else applyFile(session);
      try { await rememberHandle(handle); }
      catch { setFileError('檔案已連結，但此瀏覽器無法記住連結，下次需重新選取。'); }
    } catch (error) {
      setFileStatus(previousStatus);
      if (!(error instanceof Error && error.name === 'AbortError')) setFileError(databaseErrorChinese(error));
    }
  };
  const reloadFile = async () => {
    if (supabaseActive || !fileSession.current || savingRef.current) return;
    if (dirty) { setFileError('有未儲存變更，請先儲存或匯出草稿並取消變更，再重新讀取。'); return; }
    setFileError(null);
    try { applyFile(await readDatabaseFile(fileSession.current.handle)); }
    catch (error) { setFileError(databaseErrorChinese(error)); if (error instanceof Error && error.name === 'NotAllowedError') setFileStatus('permission'); }
  };
  const disconnectFile = async () => {
    if (supabaseActive) return;
    if (dirty || savingRef.current) { setFileError('請先儲存或匯出草稿並取消未儲存變更，再中斷連結。'); return; }
    try { await forgetHandle(); }
    catch { setFileError('無法移除已記住的連結，請稍後再試。'); return; }
    ++fileGeneration.current;
    fileSession.current = null; pendingHandle.current = null;
    setFileStatus(fileSupported ? 'unlinked' : 'unsupported'); setFileError(null); setLastReadAt(null); setLastSavedAt(null); setBackupText(null);
    if (LOCAL_EDITOR) {
      setReady(false);
      try { const master = await readLocalDatabase(); connection.current = master; latest.current = master.database; setDraft(master.database); setSaved(master.database); setReady(true); }
      catch (error) { setSaveError(databaseErrorChinese(error)); }
    } else { latest.current = initial; setDraft(initial); setSaved(initial); }
  };
  const saveDatabase = async () => {
    if (!editable || savingRef.current) return;
    savingRef.current = true; setSaving(true); setSaveError(null);
    try {
      const snapshot = validateDatabase({ ...latest.current, indexes: deriveIndexes(latest.current.materials, latest.current.indexes) });
      if (exampleMode) saveOrthotropicExample(snapshot, window.sessionStorage);
      else if (fileSession.current) {
        const session = await saveDatabaseFile(fileSession.current, snapshot);
        fileSession.current = session; setBackupText(session.backupText ?? null);
      } else connection.current.revision = await writeLocalDatabase(snapshot, connection.current.revision, connection.current.token);
      // An edit made while the request is in flight stays dirty; it was not in this snapshot.
      setSaved(snapshot);
      setLastSavedAt(Date.now()); setSaveSequence(sequence => sequence + 1);
    } catch (error) {
      setSaveError(databaseErrorChinese(error)); setBackupText(fileSession.current?.backupText ?? null);
      if (fileSession.current && error instanceof Error && error.name === 'NotAllowedError') setFileStatus('permission');
    }
    finally { savingRef.current = false; setSaving(false); }
  };
  const dismissLegacy = () => {
    if (legacy) try { localStorage.setItem(RECOVERY_KEY, legacy.fingerprint); } catch { /* never delete old data */ }
    setLegacy(null);
  };
  const importLegacy = () => {
    assertEditor();
    if (!legacy) return;
    latest.current = recoverLegacy(legacy); setDraft(latest.current); dismissLegacy();
  };
  const showLegacy = () => {
    if (supabaseActive) return;
    try { setLegacy(detectLegacy(localStorage, saved, true)); } catch { setLegacy(null); }
  };
  const importDatabase = (value: unknown) => {
    assertEditor();
    latest.current = validateDatabase(value); setDraft(latest.current);
  };

  const add = (input: MaterialInput): Material => {
    assertEditor();
    const now = new Date().toISOString();
    const m: Material = { ...input, id: newMaterialId(), updatedAt: now, history: [{ at: now, action: 'created', summary: '建立記錄' }] };
    setMaterials(list => [...list, m]);
    return m;
  };
  const update = (id: string, input: MaterialInput) => {
    assertEditor();
    setMaterials(list => list.map(m => {
      if (m.id !== id) return m;
      const now = new Date().toISOString();
      const entry: HistoryEntry = { at: now, action: 'edited', summary: describeChanges(m, input) };
      return { ...m, ...input, updatedAt: now, history: [entry, ...m.history] };
    }));
  };
  const remove = (id: string) => { assertEditor(); setMaterials(list => list.filter(m => m.id !== id)); };
  const setCurve = (id: string, curve: StressStrainData): string | null => {
    if (!editable) return '目前為唯讀模式，請在本機編輯資料庫。';
    if (!isStressStrainData(curve)) return '曲線資料無效，未儲存。';
    const current = latest.current.materials;
    if (!current.some(m => m.id === id)) return '材料已不存在，未儲存。';
    const now = new Date().toISOString();
    setMaterials(current.map(m => m.id !== id ? m : {
      ...m, stressStrainCurve: curve, updatedAt: now,
      history: [{ at: now, action: 'edited' as const, summary: `Stress–strain curve：${curve.points.length} 個完整資料點` }, ...m.history],
    }));
    return null;
  };
  /** Original CSV name matching, history behavior and absent-curve preservation. */
  const importMany = (rows: MaterialInput[]) => {
    assertEditor();
    let added = 0, updated = 0, unchanged = 0;
    const next = [...latest.current.materials];
    const now = new Date().toISOString();
    for (const row of rows) {
      const idx = next.findIndex(m => m.name.toLowerCase() === row.name.toLowerCase());
      if (idx >= 0) {
        const m = next[idx];
        const diff = describeChanges(m, row);
        if (diff === NO_CHANGES) { unchanged++; continue; }
        next[idx] = { ...m, ...row, updatedAt: now, history: [{ at: now, action: 'imported', summary: `CSV 匯入 — ${diff}` }, ...m.history] };
        updated++;
      } else {
        next.push({ ...row, id: newMaterialId(), updatedAt: now, history: [{ at: now, action: 'imported', summary: '由 CSV 匯入建立' }] });
        added++;
      }
    }
    setMaterials(next);
    return { added, updated, unchanged };
  };
  // Discarding an in-memory draft is safe even if external file permission was revoked.
  const discardDraft = () => { latest.current = saved; setDraft(saved); setSaveError(null); };
  const editIndex = (kind: IndexKind, id: string | null, name: string): string | null => {
    if (!editable) return '目前為唯讀模式，請在本機編輯資料庫。';
    const current = latest.current.materials;
    const result = changeIndex(deriveIndexes(current, latest.current.indexes), kind, id, name);
    if (!result.next) return result.error ?? '無法儲存索引。';
    const now = new Date().toISOString();
    const materials = kind === 'source' && id !== null && id !== name.trim()
      ? current.map(m => m.source !== id ? m : { ...m, source: name.trim(), updatedAt: now, history: [{ at: now, action: 'edited' as const, summary: `Source：${id} → ${name.trim()}（來源索引重新命名）` }, ...m.history] })
      : current;
    latest.current = { ...latest.current, materials, indexes: result.next }; setDraft(latest.current);
    return null;
  };
  const writeLock = useRef(createWriteLock());
  const [materialWriting, setMaterialWriting] = useState(false);
  const runSupabaseMutation = (change: (database: MasterDatabase) => Promise<MasterDatabase>) => {
    if (!supabaseActive || !supabaseMaterialWriters) return Promise.reject(new Error(SUPABASE_SOURCE_DISABLED));
    return writeLock.current.exclusive(async () => {
      setMaterialWriting(true);
      try {
        // Draft and saved both become the returned database, so a direct write is not a local draft.
        const committed = await runSupabaseMaterialMutation(latest.current, change);
        latest.current = committed;
        setDraft(committed);
        setSaved(committed);
      } finally {
        setMaterialWriting(false);
      }
    });
  };
  // The writer object is null in a legacy build, so these calls are removed with the adapter.
  const materialMutations = supabaseMaterialWriters ? {
    add(input: MaterialInput) {
      return runSupabaseMutation(database => commitSupabaseInsert(
        database,
        input,
        material => supabaseMaterialWriters.insertSupabaseMaterial(material),
        new Date().toISOString(),
        newMaterialId(),
      ));
    },
    updateMaterial(id: string, input: MaterialInput) {
      return runSupabaseMutation(database => commitSupabaseUpdate(
        database,
        id,
        input,
        material => supabaseMaterialWriters.updateSupabaseMaterial(material),
        new Date().toISOString(),
        describeChanges,
      ));
    },
    remove(id: string) {
      return runSupabaseMutation(database => commitSupabaseDelete(
        database,
        id,
        materialId => supabaseMaterialWriters.deleteSupabaseMaterial(materialId),
      ));
    },
  } : null;
  // Curve and index Admin writes share the same lock and pending flag as material CRUD.
  const extendedMutations = supabaseExtendedWriters ? {
    saveCurve(id: string, curve: StressStrainData) {
      return runSupabaseMutation(database => commitSupabaseCurve(
        database,
        id,
        curve,
        (materialId, next) => supabaseExtendedWriters.updateSupabaseMaterialCurve(materialId, next),
      ));
    },
    addCategory(name: string) {
      return runSupabaseMutation(database => commitSupabaseCategoryAdd(
        database,
        name,
        category => supabaseExtendedWriters.addSupabaseCategory(category),
      ));
    },
    renameCategory(id: string, label: string) {
      return runSupabaseMutation(database => commitSupabaseCategoryRename(
        database,
        id,
        label,
        (categoryId, next) => supabaseExtendedWriters.renameSupabaseCategoryLabel(categoryId, next),
      ));
    },
    addSource(name: string) {
      return runSupabaseMutation(database => commitSupabaseSourceAdd(
        database,
        name,
        source => supabaseExtendedWriters.addSupabaseSource(source),
      ));
    },
    renameSource(oldName: string, newName: string) {
      return runSupabaseMutation(database => commitSupabaseSourceRename(
        database,
        oldName,
        newName,
        (previous, next) => supabaseExtendedWriters.renameSupabaseSource(previous, next),
        () => supabaseExtendedWriters.readSupabaseDatabase(),
      ));
    },
  } : null;
  const state = { materials: draft.materials, add, update, remove, importMany, discardDraft, setCurve, indexes, editIndex,
    materialWriting,
    editable, dirty, ready, saving, saveError, saveDatabase, legacy, dismissLegacy, importLegacy, showLegacy, importDatabase, database: draft,
    fileSupported, fileStatus, fileError, fileName: fileSession.current?.handle.name ?? pendingHandle.current?.name ?? null, connectFile, reloadFile, disconnectFile,
    lastReadAt, lastSavedAt, backupText, github, exampleMode, developerMode: !supabaseActive && !exampleMode && LOCAL_EDITOR && ready && !fileSession.current,
    dataSource: supabaseActive ? 'supabase' as const : 'legacy' as const,
    supabaseStatus: supabaseActive ? supabaseStatus : 'idle' as const,
    supabaseError: supabaseActive ? supabaseError : null };
  // The mutation object is absent from a legacy build, so its name is not shipped there.
  return supabaseReadOnly ? { ...state, materialMutations, extendedMutations } : state;
}
