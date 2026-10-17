import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { materialToDatabaseRow } from '../src/lib/supabaseMaterialWrites';
import {
  SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED,
  SupabaseSourceRenameRemoteCommittedError,
  addSupabaseCategory,
  addSupabaseSource,
  renameSupabaseCategoryLabel,
  renameSupabaseSource,
  updateSupabaseMaterialCurve,
  type SupabaseRpcClient,
} from '../src/lib/supabaseExtendedWrites';
import type { HistoryEntry, Material, StressStrainData } from '../src/types';

const history: HistoryEntry[] = [
  { at: '2026-10-17T12:00:00.000Z', action: 'edited', summary: '更新應力應變曲線' },
];

const curve: StressStrainData = {
  points: [
    { strain: 0.02, stress: 100 },
    { strain: 0.001, stress: 10 },
    { strain: 0.03, stress: 275 },
  ],
  definition: 'engineering',
  strainKind: 'total',
  source: 'Web',
  notes: '保留原始順序',
};

function material(): Material {
  return {
    id: 'seed-adc12',
    name: 'ADC12',
    category: 'Metal',
    density: 2.82e-9,
    youngsModulus: 71000,
    poissonRatio: 0.3,
    yieldStress: 165,
    etan: 8002.05,
    ultimateStress: 336,
    elongation: 2.5,
    source: 'Web',
    notes: '',
    updatedAt: '2026-10-17T12:00:00.000Z',
    history,
    stressStrainCurve: curve,
  };
}

function fakeRpc(
  respond: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null },
): { client: SupabaseRpcClient; calls: { fn: string; args: Record<string, unknown> }[] } {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    client: {
      rpc(fn, args) {
        calls.push({ fn, args });
        return Promise.resolve(respond(fn, args));
      },
    },
  };
}

test('curve RPC uses the exact function and preserves the submitted point order', async () => {
  const { client, calls } = fakeRpc(() => ({ data: [materialToDatabaseRow(material())], error: null }));
  const returned = await updateSupabaseMaterialCurve('seed-adc12', curve, client);
  assert.deepEqual(calls, [{ fn: 'update_material_curve', args: { p_material_id: 'seed-adc12', p_curve: curve } }]);
  assert.equal(returned.id, 'seed-adc12');
  assert.deepEqual(returned.stressStrainCurve?.points, curve.points);
  assert.equal(calls[0].args.p_curve, curve);
});

test('curve RPC rejects empty ids and invalid curves before calling the server', async () => {
  const { client, calls } = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => updateSupabaseMaterialCurve('  ', curve, client), /缺少材料 id/);
  await assert.rejects(
    () => updateSupabaseMaterialCurve('seed-adc12', { ...curve, points: [{ strain: 0, stress: 0 }] }, client),
    /曲線資料不正確/,
  );
  assert.equal(calls.length, 0);
});

test('curve RPC fails on server errors, zero rows, multiple rows, and a different id', async () => {
  const secret = 'Bearer abc.def eyJhbGciOiJIUzI1NiJ9.payload.signature';
  const errored = fakeRpc(() => ({ data: null, error: { message: secret } }));
  await assert.rejects(() => updateSupabaseMaterialCurve('seed-adc12', curve, errored.client), (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    assert.match(message, /Supabase 更新曲線失敗/);
    assert.equal(message.includes('Bearer'), false);
    assert.equal(message.includes('eyJ'), false);
    assert.match(message, /\[redacted\]/);
    return true;
  });
  const none = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => updateSupabaseMaterialCurve('seed-adc12', curve, none.client), /沒有回傳寫入後的材料/);
  const many = fakeRpc(() => ({ data: [materialToDatabaseRow(material()), materialToDatabaseRow(material())], error: null }));
  await assert.rejects(() => updateSupabaseMaterialCurve('seed-adc12', curve, many.client), /回傳資料列數量不正確/);
  const other = fakeRpc(() => ({ data: [materialToDatabaseRow({ ...material(), id: 'other' })], error: null }));
  await assert.rejects(() => updateSupabaseMaterialCurve('seed-adc12', curve, other.client), /回傳的材料 id 不正確/);
});

test('category add RPC requires one complete row', async () => {
  const row = { id: 'Foam', label: '泡棉', color: '#112233' };
  const { client, calls } = fakeRpc(() => ({ data: [row], error: null }));
  assert.deepEqual(await addSupabaseCategory('泡棉', client), row);
  assert.deepEqual(calls, [{ fn: 'add_material_category', args: { p_name: '泡棉' } }]);
  const none = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => addSupabaseCategory('泡棉', none.client), /沒有回傳寫入後的資料/);
  const many = fakeRpc(() => ({ data: [row, row], error: null }));
  await assert.rejects(() => addSupabaseCategory('泡棉', many.client), /回傳資料列數量不正確/);
  const broken = fakeRpc(() => ({ data: [{ id: 'Foam', label: '泡棉' }], error: null }));
  await assert.rejects(() => addSupabaseCategory('泡棉', broken.client), /回傳的分類資料不正確/);
  const failed = fakeRpc(() => ({ data: null, error: { message: 'duplicate' } }));
  await assert.rejects(() => addSupabaseCategory('泡棉', failed.client), /Supabase 新增分類失敗：duplicate/);
  const skipped = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => addSupabaseCategory('   ', skipped.client), /缺少分類名稱/);
  assert.equal(skipped.calls.length, 0);
});

test('category rename RPC keeps the requested id', async () => {
  const { client, calls } = fakeRpc(() => ({ data: [{ id: 'Metal', label: '金屬材料', color: '#2563eb' }], error: null }));
  const row = await renameSupabaseCategoryLabel('Metal', '金屬材料', client);
  assert.equal(row.id, 'Metal');
  assert.deepEqual(calls, [{ fn: 'rename_material_category_label', args: { p_id: 'Metal', p_label: '金屬材料' } }]);
  const moved = fakeRpc(() => ({ data: [{ id: 'Other', label: '金屬材料', color: '#2563eb' }], error: null }));
  await assert.rejects(() => renameSupabaseCategoryLabel('Metal', '金屬材料', moved.client), /回傳的分類 id 與要求不一致/);
  const broken = fakeRpc(() => ({ data: [{ id: 'Metal', label: 1, color: '#2563eb' }], error: null }));
  await assert.rejects(() => renameSupabaseCategoryLabel('Metal', '金屬材料', broken.client), /回傳的分類資料不正確/);
  const skipped = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => renameSupabaseCategoryLabel(' ', '金屬材料', skipped.client), /缺少分類 id/);
  assert.equal(skipped.calls.length, 0);
});

test('source add RPC requires one named row', async () => {
  const { client, calls } = fakeRpc(() => ({ data: [{ name: 'Archive' }], error: null }));
  assert.deepEqual(await addSupabaseSource('Archive', client), { name: 'Archive' });
  assert.deepEqual(calls, [{ fn: 'add_material_source', args: { p_name: 'Archive' } }]);
  const none = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => addSupabaseSource('Archive', none.client), /沒有回傳寫入後的資料/);
  const many = fakeRpc(() => ({ data: [{ name: 'Archive' }, { name: 'Archive' }], error: null }));
  await assert.rejects(() => addSupabaseSource('Archive', many.client), /回傳資料列數量不正確/);
  const broken = fakeRpc(() => ({ data: [{ name: 12 }], error: null }));
  await assert.rejects(() => addSupabaseSource('Archive', broken.client), /回傳的來源資料不正確/);
});

function assertRemoteCommitted(error: unknown): boolean {
  assert.equal(error instanceof SupabaseSourceRenameRemoteCommittedError, true);
  assert.equal(error instanceof Error ? error.message : '', SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED);
  assert.equal((error as { remoteCommitted?: boolean }).remoteCommitted, true);
  return true;
}

test('source rename RPC error stays ordinary and a successful malformed result is already committed', async () => {
  const secret = 'Bearer secret-token eyJhbGciOiJIUzI1NiJ9.payload.signature';
  const failed = fakeRpc(() => ({ data: null, error: { message: secret } }));
  await assert.rejects(() => renameSupabaseSource('Web', 'Archive', failed.client), (error: unknown) => {
    const message = error instanceof Error ? error.message : '';
    assert.equal(error instanceof SupabaseSourceRenameRemoteCommittedError, false);
    assert.notEqual((error as { remoteCommitted?: boolean }).remoteCommitted, true);
    assert.match(message, /Supabase 重新命名來源失敗/);
    assert.equal(message.includes('Bearer'), false);
    assert.equal(message.includes('eyJ'), false);
    return true;
  });
  assert.equal(failed.calls.length, 1);

  const numeric = fakeRpc(() => ({ data: [{ old_name: 'Web', new_name: 'Archive', affected_count: 2 }], error: null }));
  assert.deepEqual(await renameSupabaseSource('Web', 'Archive', numeric.client), { oldName: 'Web', newName: 'Archive', affectedCount: 2 });
  assert.deepEqual(numeric.calls, [{ fn: 'rename_material_source', args: { p_old_name: 'Web', p_new_name: 'Archive' } }]);
  const text = fakeRpc(() => ({ data: [{ old_name: 'Web', new_name: 'Archive', affected_count: '11' }], error: null }));
  assert.equal((await renameSupabaseSource('Web', 'Archive', text.client)).affectedCount, 11);

  const none = fakeRpc(() => ({ data: [], error: null }));
  await assert.rejects(() => renameSupabaseSource('Web', 'Archive', none.client), assertRemoteCommitted);
  assert.equal(none.calls.length, 1);
  const many = fakeRpc(() => ({
    data: [
      { old_name: 'Web', new_name: 'Archive', affected_count: 1 },
      { old_name: 'Web', new_name: 'Archive', affected_count: 1 },
    ],
    error: null,
  }));
  await assert.rejects(() => renameSupabaseSource('Web', 'Archive', many.client), assertRemoteCommitted);
  assert.equal(many.calls.length, 1);
  for (const affected_count of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, '-1', '1.5', '9007199254740993', 'nope']) {
    const fake = fakeRpc(() => ({ data: [{ old_name: 'Web', new_name: 'Archive', affected_count }], error: null }));
    await assert.rejects(() => renameSupabaseSource('Web', 'Archive', fake.client), assertRemoteCommitted);
    assert.equal(fake.calls.length, 1);
  }
  const broken = fakeRpc(() => ({ data: [{ old_name: 1, new_name: 'Archive', affected_count: 0 }], error: null }));
  await assert.rejects(() => renameSupabaseSource('Web', 'Archive', broken.client), assertRemoteCommitted);
  assert.equal(broken.calls.length, 1);
});

test('extended RPC adapters stay out of the UI and the material CRUD module', async () => {
  const writes = await readFile(new URL('../src/lib/supabaseMaterialWrites.ts', import.meta.url), 'utf8');
  const extended = await readFile(new URL('../src/lib/supabaseExtendedWrites.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const drawer = await readFile(new URL('../src/components/MaterialDrawer.tsx', import.meta.url), 'utf8');
  const curveSection = await readFile(new URL('../src/components/StressStrainSection.tsx', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
  const manager = await readFile(new URL('../src/components/IndexManager.tsx', import.meta.url), 'utf8');
  assert.equal(writes.includes('update_material_curve'), false);
  assert.equal(writes.includes('add_material_category'), false);
  assert.equal(extended.includes('createMaterialLibraryClient'), true);
  assert.equal(extended.includes('signInWithPassword'), false);
  assert.equal(extended.includes('service_role'), false);
  for (const source of [drawer, curveSection, sidebar, manager]) {
    assert.equal(source.includes('extendedMutations'), false);
    assert.equal(source.includes('supabaseExtendedWrites'), false);
    assert.equal(source.includes('updateSupabaseMaterialCurve'), false);
    assert.equal(source.includes('addSupabaseCategory'), false);
    assert.equal(source.includes('renameSupabaseSource'), false);
  }
  const editing = await readFile(new URL('../src/lib/localEditing.ts', import.meta.url), 'utf8');
  assert.match(app, /extendedMutations\.saveCurve/);
  assert.match(app, /commitSupabaseIndexWrite\(/);
  assert.match(editing, /mutations\.addCategory\(name\)/);
  assert.match(editing, /mutations\.renameSource\(id, name\)/);
  assert.equal(app.includes('supabaseExtendedWrites'), false);
  assert.equal(editing.includes('supabaseExtendedWrites'), false);
  assert.equal(app.includes('updateSupabaseMaterialCurve'), false);
  assert.equal(app.includes('addSupabaseCategory'), false);
  assert.equal(editing.includes('addSupabaseCategory'), false);
  assert.equal(app.includes('renameSupabaseSource'), false);
  assert.equal(editing.includes('renameSupabaseSource'), false);
  assert.equal(app.includes('indexWriteEnabledFor'), true);
});
