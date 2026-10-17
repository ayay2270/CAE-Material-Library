import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { databaseIsDirty } from '../src/lib/browserDatabase';
import { validateDatabase } from '../src/lib/database-schema.mjs';
import { deriveIndexes } from '../src/lib/indexes';
import {
  SUPABASE_MATERIAL_CRUD_DENIED,
  SUPABASE_WRITE_LATER,
  closeAfterDirectWrite,
  materialCrudEnabledFor,
  requestMaterialCrud,
  requestMaterialMutation,
  supabaseCommittedNotice,
  supabaseCrudDialogsShouldClose,
} from '../src/lib/localEditing';
import {
  SUPABASE_EXISTING_SOURCE_REQUIRED,
  commitSupabaseDelete,
  commitSupabaseInsert,
  commitSupabaseUpdate,
  createWriteLock,
  materialFromInput,
  runSupabaseMaterialMutation,
} from '../src/lib/supabaseMaterialCommit';
import { isSupabaseAdminCapability } from '../src/lib/useMaterialAuth';
import type { MaterialAdminStatus } from '../src/lib/supabaseAuth';
import type { MasterDatabase } from '../src/lib/database-schema.mjs';
import type { Material, MaterialInput, StressStrainData } from '../src/types';

const NOW = '2026-10-17T08:06:00.000Z';
let describeChanges: (before: Material, after: MaterialInput) => string;
let newMaterialId: () => string;
const curve: StressStrainData = {
  points: [{ strain: 0, stress: 0 }, { strain: 0.2, stress: 200 }],
  definition: 'engineering',
  strainKind: 'total',
  source: 'Web',
  notes: '',
};

function material(id: string, name = id, source = 'Web'): Material {
  return {
    id,
    name,
    category: 'Metal',
    source,
    notes: '',
    density: null,
    youngsModulus: null,
    poissonRatio: null,
    yieldStress: null,
    etan: null,
    ultimateStress: null,
    elongation: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    history: [
      { at: '2026-01-01T00:00:00.000Z', action: 'created', summary: '建立記錄' },
      { at: '2026-01-02T00:00:00.000Z', action: 'edited', summary: '先前編輯' },
    ],
    stressStrainCurve: curve,
  };
}

function database(rows: Material[], sources = ['Supplier', 'Web']): MasterDatabase {
  return validateDatabase({
    schemaVersion: 1,
    materials: rows,
    indexes: {
      categories: [
        { id: 'Metal', label: '金屬', color: '#2563eb' },
        { id: 'Plastic', label: '塑膠', color: '#df8105' },
      ],
      sources,
    },
  });
}

function inputOf(row: Material, patch: Partial<MaterialInput> = {}): MaterialInput {
  const input: MaterialInput = {
    name: row.name,
    category: row.category,
    source: row.source,
    notes: row.notes,
    density: row.density,
    youngsModulus: row.youngsModulus,
    poissonRatio: row.poissonRatio,
    yieldStress: row.yieldStress,
    etan: row.etan,
    ultimateStress: row.ultimateStress,
    elongation: row.elongation,
    stressStrainCurve: row.stressStrainCurve,
  };
  return { ...input, ...patch };
}

function track() {
  return { action: 0, local: 0, denied: 0 };
}

test('signed-out, checking, non-admin, and error cannot open material add, edit, or delete', () => {
  const blocked: MaterialAdminStatus[] = ['signed_out', 'checking', 'non_admin', 'error'];
  for (const status of blocked) {
    const enabled = materialCrudEnabledFor('supabase', false, isSupabaseAdminCapability('supabase', status));
    assert.equal(enabled, false, status);
    for (const name of ['add', 'edit', 'delete']) {
      const calls = track();
      requestMaterialCrud(enabled, 'supabase', () => { calls.action += 1; }, () => { calls.local += 1; }, () => { calls.denied += 1; });
      assert.deepEqual(calls, { action: 0, local: 0, denied: 1 }, `${status} ${name}`);
    }
  }
  assert.equal(SUPABASE_MATERIAL_CRUD_DENIED, '目前帳號沒有材料寫入權限。');
});

test('confirmed Supabase admin can open add, edit, and delete without becoming the legacy editor', () => {
  const enabled = materialCrudEnabledFor('supabase', false, isSupabaseAdminCapability('supabase', 'admin'));
  assert.equal(enabled, true);
  for (const name of ['add', 'edit', 'delete']) {
    const calls = track();
    requestMaterialCrud(enabled, 'supabase', () => { calls.action += 1; }, () => { calls.local += 1; }, () => { calls.denied += 1; });
    assert.deepEqual(calls, { action: 1, local: 0, denied: 0 }, name);
  }
  const deferred = track();
  requestMaterialMutation('supabase', true, () => { deferred.action += 1; }, () => { deferred.local += 1; }, () => { deferred.denied += 1; });
  assert.deepEqual(deferred, { action: 0, local: 0, denied: 1 });
});

test('example and legacy material editing stay on the local editable flag', () => {
  assert.equal(materialCrudEnabledFor('legacy', true, false), true);
  assert.equal(materialCrudEnabledFor('legacy', false, true), false);
  assert.equal(isSupabaseAdminCapability('legacy', 'admin'), false);
  const ready = track();
  requestMaterialCrud(true, 'legacy', () => { ready.action += 1; }, () => { ready.local += 1; }, () => { ready.denied += 1; });
  const blocked = track();
  requestMaterialCrud(false, 'legacy', () => { blocked.action += 1; }, () => { blocked.local += 1; }, () => { blocked.denied += 1; });
  assert.deepEqual(ready, { action: 1, local: 0, denied: 0 });
  assert.deepEqual(blocked, { action: 0, local: 1, denied: 0 });
  assert.equal(supabaseCrudDialogsShouldClose('legacy', false), false);
  assert.equal(supabaseCrudDialogsShouldClose('supabase', true), false);
  assert.equal(supabaseCrudDialogsShouldClose('supabase', false), true);
});

test('new Supabase material gets a generated id, ISO updatedAt, and a created history entry', async () => {
  const id = newMaterialId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  const db = database([material('kept', 'Kept')]);
  let prepared: Material | null = null;
  const next = await commitSupabaseInsert(db, inputOf(material('unused', 'ADC12')), async row => {
    prepared = row;
    return { ...row, notes: 'from-remote' };
  }, NOW, id);
  assert.ok(prepared);
  assert.equal(prepared.id, id);
  assert.equal(prepared.updatedAt, NOW);
  assert.match(prepared.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual(prepared.history, [{ at: NOW, action: 'created', summary: '建立記錄' }]);
  const stored = next.materials.find(row => row.id === id);
  assert.equal(stored?.notes, 'from-remote');
  assert.equal(stored?.id, id);
  assert.equal(db.materials.length, 1);
});

test('Supabase edit preserves id, refreshes updatedAt, and prepends describeChanges()', async () => {
  const before = material('same-id', 'ADC12');
  const db = database([before, material('other', 'Other')]);
  const input = inputOf(before, { name: 'ADC12-B', stressStrainCurve: undefined });
  delete input.stressStrainCurve;
  let prepared: Material | null = null;
  await commitSupabaseUpdate(db, before.id, input, async row => {
    prepared = row;
    return row;
  }, NOW, describeChanges);
  assert.ok(prepared);
  assert.equal(prepared.id, before.id);
  assert.equal(prepared.updatedAt, NOW);
  assert.deepEqual(prepared.history[0], { at: NOW, action: 'edited', summary: describeChanges(before, input) });
  assert.deepEqual(prepared.history.slice(1), before.history);
  assert.deepEqual(prepared.stressStrainCurve, before.stressStrainCurve);
  assert.equal(prepared.history[0].summary.includes('名稱:'), true);
});

test('insert calls the adapter once and changes local state only after success', async () => {
  const db = database([material('kept', 'Kept')]);
  const snapshot = JSON.stringify(db);
  let calls = 0;
  const next = await runSupabaseMaterialMutation(db, current => commitSupabaseInsert(current, inputOf(material('new', 'New')), async row => {
    calls += 1;
    assert.equal(current.materials.length, 1);
    assert.equal(JSON.stringify(db), snapshot);
    return row;
  }, NOW, 'generated-id'));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(db), snapshot);
  assert.equal(next.materials.length, 2);
  assert.equal(next.materials.some(row => row.id === 'generated-id'), true);
});

test('insert failure leaves the material list unchanged', async () => {
  const db = database([material('kept', 'Kept')]);
  const snapshot = JSON.stringify(db);
  let published = false;
  await assert.rejects(runSupabaseMaterialMutation(db, current => commitSupabaseInsert(current, inputOf(material('new', 'New')), async () => {
    throw new Error('材料不存在或目前帳號沒有更新權限。');
  }, NOW, 'generated-id')), /沒有更新權限/);
  assert.equal(published, false);
  assert.equal(JSON.stringify(db), snapshot);
});

test('update calls the adapter once and keeps the returned row only after success', async () => {
  const before = material('same-id', 'ADC12');
  const db = database([before, material('other', 'Other')]);
  const snapshot = JSON.stringify(db);
  let calls = 0;
  const next = await runSupabaseMaterialMutation(db, current => commitSupabaseUpdate(current, before.id, inputOf(before, { notes: 'local-note' }), async row => {
    calls += 1;
    assert.equal(JSON.stringify(db), snapshot);
    assert.equal(current.materials.find(item => item.id === before.id)?.notes, '');
    return { ...row, notes: 'from-remote', updatedAt: '2026-10-17T09:00:00.000Z' };
  }, NOW, describeChanges));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(db), snapshot);
  const stored = next.materials.find(row => row.id === before.id);
  assert.equal(stored?.notes, 'from-remote');
  assert.equal(stored?.updatedAt, '2026-10-17T09:00:00.000Z');
});

test('update failure preserves the old local record', async () => {
  const before = material('same-id', 'ADC12');
  const db = database([before, material('other', 'Other')]);
  const snapshot = JSON.stringify(db);
  await assert.rejects(commitSupabaseUpdate(db, before.id, inputOf(before, { name: 'Changed' }), async () => {
    throw new Error('材料不存在或目前帳號沒有更新權限。');
  }, NOW, describeChanges), /沒有更新權限/);
  assert.equal(JSON.stringify(db), snapshot);
  assert.equal(db.materials.find(row => row.id === before.id)?.name, 'ADC12');
});

test('delete calls the adapter once and removes the row only after the returned id', async () => {
  const db = database([material('gone', 'Gone'), material('kept', 'Kept')]);
  const snapshot = JSON.stringify(db);
  let calls = 0;
  const next = await runSupabaseMaterialMutation(db, current => commitSupabaseDelete(current, 'gone', async id => {
    calls += 1;
    assert.equal(current.materials.some(row => row.id === id), true);
    assert.equal(JSON.stringify(db), snapshot);
    return id;
  }));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(db), snapshot);
  assert.equal(next.materials.some(row => row.id === 'gone'), false);
  assert.equal(next.materials.some(row => row.id === 'kept'), true);
});

test('delete failure preserves the material', async () => {
  const db = database([material('gone', 'Gone'), material('kept', 'Kept')]);
  const snapshot = JSON.stringify(db);
  let calls = 0;
  await assert.rejects(commitSupabaseDelete(db, 'gone', async () => {
    calls += 1;
    throw new Error('材料不存在或目前帳號沒有刪除權限。');
  }));
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(db), snapshot);
  await assert.rejects(commitSupabaseDelete(db, 'gone', async () => 'other-id'));
  assert.equal(JSON.stringify(db), snapshot);
});

test('a successful Supabase write is not a dirty draft and does not ask for Save Database', async () => {
  const db = database([material('kept', 'Kept')]);
  const next = await runSupabaseMaterialMutation(db, current => commitSupabaseInsert(
    current,
    inputOf(material('new', 'New')),
    async row => row,
    NOW,
    'generated-id',
  ));
  const visible = deriveIndexes(next.materials, next.indexes);
  assert.equal(databaseIsDirty({ ...next, indexes: visible }, next), false);
  for (const kind of ['add', 'edit', 'delete'] as const) {
    const notice = supabaseCommittedNotice(kind, 'ADC12');
    assert.equal(notice.includes('Save Database'), false, notice);
    assert.equal(notice.includes('請按'), false, notice);
    assert.equal(notice.includes('草稿'), false, notice);
  }
  assert.equal(SUPABASE_WRITE_LATER.includes('Save Database'), false);
});

test('a direct write closes only after success', async () => {
  let closed = false;
  await assert.rejects(closeAfterDirectWrite(async () => {
    throw new Error('Supabase 新增材料失敗：沒有回傳寫入後的材料。');
  }, () => { closed = true; }));
  assert.equal(closed, false);
  await closeAfterDirectWrite(async () => {}, () => { closed = true; });
  assert.equal(closed, true);
});

test('an overlapping material write cannot call the adapter twice', async () => {
  const db = database([material('kept', 'Kept'), material('other', 'Other')]);
  const lock = createWriteLock();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const first = lock.exclusive(() => commitSupabaseInsert(db, inputOf(material('new', 'New')), async row => {
    calls += 1;
    await gate;
    return row;
  }, NOW, 'generated-id'));
  await assert.rejects(lock.exclusive(() => commitSupabaseUpdate(db, 'kept', inputOf(material('kept', 'Kept')), async row => {
    calls += 1;
    return row;
  }, NOW, describeChanges)), /材料寫入進行中/);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(lock.pending, false);
});

test('a source outside the Supabase index is rejected before the write', async () => {
  const db = database([material('kept', 'Kept')]);
  const snapshot = JSON.stringify(db);
  let calls = 0;
  await assert.rejects(commitSupabaseInsert(db, inputOf(material('new', 'New'), { source: '品牌新規格' }), async row => {
    calls += 1;
    return row;
  }, NOW, 'generated-id'), new RegExp(SUPABASE_EXISTING_SOURCE_REQUIRED));
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(db), snapshot);
});

test('an existing Supabase source is accepted and does not add a source', async () => {
  const db = database([material('kept', 'Kept')], ['Supplier', 'Web']);
  let calls = 0;
  const next = await commitSupabaseInsert(db, inputOf(material('new', 'New'), { source: 'Supplier' }), async row => {
    calls += 1;
    assert.equal(row.source, 'Supplier');
    return row;
  }, NOW, 'generated-id');
  assert.equal(calls, 1);
  assert.deepEqual(db.indexes.sources, ['Supplier', 'Web']);
  assert.equal(next.materials.find(row => row.id === 'generated-id')?.source, 'Supplier');
  assert.equal(next.indexes.sources.includes('品牌新規格'), false);
});

test('legacy free-text behavior is not routed through the Supabase source guard', async () => {
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const add = storage.slice(storage.indexOf('const add ='), storage.indexOf('const update ='));
  assert.equal(add.includes('assertExistingSource'), false);
  assert.equal(add.includes('insertSupabaseMaterial'), false);
  assert.match(add, /history: \[\{ at: now, action: 'created', summary: '建立記錄' \}\]/);
  const curve = storage.slice(storage.indexOf('const setCurve ='), storage.indexOf('const importMany ='));
  assert.match(curve, /if \(!editable\) return '目前為唯讀模式，請在本機編輯資料庫。'/);
  assert.match(storage, /const saveDatabase = async \(\) => \{\s*if \(!editable \|\| savingRef\.current\) return;/);
  assert.equal(storage.includes('.upsert('), false);
  assert.equal(storage.includes('service_role'), false);
  assert.match(storage, /material => supabaseMaterialWriters\.insertSupabaseMaterial\(material\)/);
  assert.match(storage, /material => supabaseMaterialWriters\.updateSupabaseMaterial\(material\)/);
  assert.match(storage, /materialId => supabaseMaterialWriters\.deleteSupabaseMaterial\(materialId\)/);
});

test('Supabase admin wiring keeps CSV and Save Database closed', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const drawer = await readFile(new URL('../src/components/MaterialDrawer.tsx', import.meta.url), 'utf8');
  const status = await readFile(new URL('../src/components/DatabaseStatus.tsx', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(app, /materialCrudEnabledFor\(materialState\.dataSource, editable, supabaseAdmin\)/);
  assert.match(app, /<Sidebar[\s\S]*?indexManageEnabled=\{indexWriteEnabled && !indexRemoteStale\}/);
  assert.equal(app.includes('requestEdit(() => setIndexManager(kind))'), false);
  assert.match(app, /<ImportExportDialog[\s\S]*?editable=\{editable\}/);
  assert.match(app, /readOnlyHint=\{materialState\.dataSource === 'supabase' \? SUPABASE_WRITE_LATER : undefined\}/);
  assert.match(app, /<MaterialDrawer[\s\S]*?editable=\{editable\}[\s\S]*?materialCrudEnabled=\{materialCrudEnabled\}/);
  assert.match(drawer, /<StressStrainSection key=\{m\.id\} material=\{m\} units=\{units\} onSave=\{onSaveCurve\} onDelete=\{onDeleteCurve\} editable=\{curveEditable\} pending=\{curvePending\} \/>/);
  assert.match(status, /\{editable && <button className="btn" disabled=\{!dirty \|\| saving\} onClick=\{\(\) => void saveDatabase\(\)\}>Save Database<\/button>\}/);
  assert.match(sidebar, /\{indexManageEnabled && <button className="index-manage-trigger" aria-label="管理材料分類"/);
  assert.match(sidebar, /\{indexManageEnabled && <button className="index-manage-trigger" aria-label="管理 SOURCE"/);
  assert.equal(app.includes('is_current_user_material_admin'), false);
  assert.equal(app.includes('startMaterialLibraryAuth'), false);
  const save = app.slice(app.indexOf('const save = async'), app.indexOf('const confirmDelete'));
  assert.equal(save.includes('supabaseCommittedNotice'), true);
  assert.equal(save.slice(0, save.indexOf('const saveHint')).includes('Save Database'), false);
});

test('material CRUD tests do not call the live network', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error('live network');
  }) as typeof fetch;
  try {
    const db = database([material('kept', 'Kept'), material('other', 'Other')]);
    await commitSupabaseInsert(db, inputOf(material('new', 'New')), async row => row, NOW, 'generated-id');
    await commitSupabaseUpdate(db, 'kept', inputOf(material('kept', 'Kept'), { notes: 'n' }), async row => row, NOW, describeChanges);
    await commitSupabaseDelete(db, 'other', async id => id);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls, 0);
});

const uiBuild = buildSync({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MaterialForm } from './src/components/MaterialForm';
      import { MaterialDrawer } from './src/components/MaterialDrawer';
      import { ConfirmDelete } from './src/components/Dialogs';
      import { StressStrainSection } from './src/components/StressStrainSection';
      import { IndexContext } from './src/lib/indexes';
      export { describeChanges, newMaterialId, clearStoredCurveDraft } from './src/lib/storage';
      const indexes = { categories: [{ id: 'Metal', label: '金屬', color: '#2563eb' }], sources: ['Supplier', 'Web'] };
      const material = { id: 'm1', name: 'ADC12', category: 'Metal', source: 'Web', notes: '', density: null, youngsModulus: null, poissonRatio: null, yieldStress: null, etan: null, ultimateStress: null, elongation: null, updatedAt: '2026-01-01T00:00:00.000Z', history: [{ at: '2026-01-01T00:00:00.000Z', action: 'created', summary: '建立記錄' }] };
      const units = { density: 't/mm³', stress: 'MPa' };
      const wrap = node => renderToStaticMarkup(<IndexContext.Provider value={indexes}>{node}</IndexContext.Provider>);
      export const restricted = pending => wrap(<MaterialForm restrictSourceToExisting pending={pending} initial={material} existing={[material]} onSave={() => {}} onClose={() => {}} />);
      export const freeText = () => wrap(<MaterialForm initial={material} existing={[material]} onSave={() => {}} onClose={() => {}} />);
      export const legacyDelete = () => renderToStaticMarkup(<ConfirmDelete material={material} onConfirm={() => {}} onClose={() => {}} />);
      export const directDelete = (pending, error) => renderToStaticMarkup(<ConfirmDelete direct pending={pending} error={error} material={material} onConfirm={() => {}} onClose={() => {}} />);
      export const adminDrawer = () => wrap(<MaterialDrawer editable={false} materialCrudEnabled material={material} units={units} onClose={() => {}} onEdit={() => {}} onDelete={() => {}} onSaveCurve={() => null} />);
      export const curve = editable => renderToStaticMarkup(<StressStrainSection material={material} units={units} editable={editable} onSave={() => null} />);
    `,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl' },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"',
    'process.env.NODE_ENV': '"production"',
  },
});
const compiled = { exports: {} as Record<string, (...args: unknown[]) => string> };
new Function('require', 'module', 'exports', uiBuild.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;
describeChanges = ui.describeChanges as typeof describeChanges;
newMaterialId = ui.newMaterialId as typeof newMaterialId;
if (typeof describeChanges !== 'function' || typeof newMaterialId !== 'function') {
  throw new Error(`storage exports missing: ${Object.keys(compiled.exports).join(',')}`);
}

test('Supabase source is a select and legacy source stays free text', () => {
  const restricted = ui.restricted(false);
  assert.match(restricted, /aria-label="Source"/);
  assert.match(restricted, /<option[^>]*>Supplier<\/option>/);
  assert.match(restricted, /<option[^>]*>Web<\/option>/);
  assert.equal(restricted.includes('material-source-options'), false);
  const legacy = ui.freeText();
  assert.match(legacy, /list="material-source-options"/);
  assert.match(legacy, /placeholder="例如：供應商資料表、網路、提供者姓名"/);
  assert.equal(legacy.includes('請選擇現有來源'), false);
});

test('material save and delete controls show the pending state', () => {
  const saving = ui.restricted(true);
  assert.match(saving, /儲存中…/);
  assert.match(saving, /disabled=""/);
  const deleting = ui.directDelete(true, '材料不存在或目前帳號沒有刪除權限。');
  assert.match(deleting, /刪除中…/);
  assert.match(deleting, /直接從 Supabase 刪除/);
  assert.match(deleting, /role="alert"/);
  assert.equal(deleting.includes('Save Database'), false);
  assert.equal(deleting.includes('草稿'), false);
  const legacy = ui.legacyDelete();
  assert.match(legacy, /目前草稿移除/);
  assert.match(legacy, /Save Database/);
  assert.equal(legacy.includes('直接從 Supabase'), false);
});

test('Supabase admin can use material edit and delete while the curve stays read-only', () => {
  const drawer = ui.adminDrawer();
  assert.match(drawer, /title="編輯"/);
  assert.match(drawer, /title="刪除"/);
  assert.equal(drawer.includes('加入完整曲線'), false);
  assert.equal(drawer.includes('編輯完整曲線'), false);
  const readonlyCurve = ui.curve(false);
  assert.equal(readonlyCurve.includes('加入完整曲線'), false);
  assert.equal(readonlyCurve.includes('編輯完整曲線'), false);
  const editableCurve = ui.curve(true);
  assert.match(editableCurve, /加入完整曲線/);
});

test('empty material id is refused before a Supabase insert payload exists', () => {
  assert.throws(() => materialFromInput(inputOf(material('new', 'New')), NOW, ''), /缺少材料 id/);
});

test('legacy clear removes only the stored curve and leaves Save Database responsible for the dirty draft', async () => {
  const clearStoredCurveDraft = ui.clearStoredCurveDraft as unknown as (
    materials: Material[],
    id: string,
    editable: boolean,
    now: string,
  ) => { materials: Material[]; error: string | null };
  const kept: Material = {
    ...material('kept', 'ADC12'),
    notes: '保留備註',
    density: 2.82e-9,
    youngsModulus: 71000,
    poissonRatio: 0.3,
    yieldStress: 165,
    etan: 8002.05,
    ultimateStress: 336,
    elongation: 2.5,
    materialModel: 'Orthotropic',
    subCategory: '板',
    orthotropic: { e1: 10, e2: 20, e3: 30, g12: 4, g13: 5, g23: 6, nu12: 0.1, nu13: 0.2, nu23: 0.3 },
    compositeStrength: { xt: 1, xc: 2, yt: 3, yc: 4, s12: 5 },
  };
  const other = material('other', 'Other', 'Supplier');
  const saved = database([kept, other]);
  const now = '2026-10-17T18:00:00.000Z';
  const blocked = clearStoredCurveDraft(saved.materials, 'kept', false, now);
  assert.match(blocked.error ?? '', /唯讀/);
  assert.equal(blocked.materials, saved.materials);
  const missing = clearStoredCurveDraft(saved.materials, 'gone', true, now);
  assert.match(missing.error ?? '', /材料已不存在/);
  assert.equal(missing.materials, saved.materials);
  const result = clearStoredCurveDraft(saved.materials, 'kept', true, now);
  assert.equal(result.error, null);
  const cleared = result.materials[0];
  assert.equal(cleared.name, 'ADC12');
  assert.equal(cleared.category, kept.category);
  assert.equal(cleared.source, kept.source);
  assert.equal(cleared.notes, kept.notes);
  assert.equal(cleared.stressStrainCurve, null);
  assert.equal(cleared.updatedAt, now);
  assert.notEqual(cleared.updatedAt, kept.updatedAt);
  assert.equal(cleared.history[0]?.action, 'edited');
  assert.equal(cleared.history[0]?.summary, 'Stress–strain curve：已移除完整曲線');
  assert.equal(cleared.history[0]?.at, now);
  assert.deepEqual(cleared.history.slice(1), kept.history);
  assert.equal(cleared.density, kept.density);
  assert.equal(cleared.youngsModulus, kept.youngsModulus);
  assert.equal(cleared.poissonRatio, kept.poissonRatio);
  assert.equal(cleared.yieldStress, kept.yieldStress);
  assert.equal(cleared.etan, kept.etan);
  assert.equal(cleared.ultimateStress, kept.ultimateStress);
  assert.equal(cleared.elongation, kept.elongation);
  assert.equal(cleared.materialModel, kept.materialModel);
  assert.equal(cleared.subCategory, kept.subCategory);
  assert.equal(cleared.orthotropic, kept.orthotropic);
  assert.equal(cleared.compositeStrength, kept.compositeStrength);
  assert.equal(result.materials[1], other);
  assert.equal(kept.stressStrainCurve, curve);
  const draft = validateDatabase({ ...saved, materials: result.materials });
  assert.equal(databaseIsDirty(draft, saved), true);
  const again = clearStoredCurveDraft(result.materials, 'kept', true, now);
  assert.match(again.error ?? '', /目前沒有已儲存的完整曲線/);
  assert.equal(again.materials, result.materials);
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const clear = storage.slice(storage.indexOf('const clearCurve ='), storage.indexOf('const importMany ='));
  assert.match(clear, /clearStoredCurveDraft\(/);
  assert.match(clear, /setMaterials\(result\.materials\)/);
  assert.equal(clear.includes('saveDatabase'), false);
  assert.match(storage, /const saveDatabase = async \(\) => \{\s*if \(!editable \|\| savingRef\.current\) return;/);
  assert.match(storage, /discardDraft, setCurve, clearCurve, indexes/);
});
