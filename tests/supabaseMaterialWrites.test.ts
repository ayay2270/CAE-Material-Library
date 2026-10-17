import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MATERIAL_COLUMNS } from '../src/lib/supabaseDatabase';
import {
  deleteSupabaseMaterial,
  insertSupabaseMaterial,
  materialToDatabaseRow,
  updateSupabaseMaterial,
  type MaterialWriteClient,
} from '../src/lib/supabaseMaterialWrites';
import type { HistoryEntry, Material, StressStrainData } from '../src/types';

const history: HistoryEntry[] = [
  { at: '2026-09-17T15:17:00', action: 'created', summary: 'Sample record seeded from design mockup' },
  { at: '2026-09-18T14:37:00', action: 'edited', summary: '保持原始歷史順序' },
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

function material(overrides: Partial<Material> = {}): Material {
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
    updatedAt: '2026-09-17T07:17:00.000Z',
    history,
    stressStrainCurve: curve,
    ...overrides,
  };
}

interface Call {
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: unknown;
  eq?: { column: string; value: string };
  columns?: string;
}

function fakeClient(
  respond: (call: Call) => { data: unknown[] | null; error: { message: string } | null },
  calls: Call[],
): MaterialWriteClient {
  const query = (call: Call) => ({
    eq(column: string, value: string) {
      call.eq = { column, value };
      return this;
    },
    select(columns: string) {
      call.columns = columns;
      return Promise.resolve(respond(call));
    },
  });
  return {
    from(table: string) {
      return {
        insert(payload: unknown) {
          const call: Call = { table, op: 'insert', payload };
          calls.push(call);
          return query(call);
        },
        update(payload: unknown) {
          const call: Call = { table, op: 'update', payload };
          calls.push(call);
          return query(call);
        },
        delete() {
          const call: Call = { table, op: 'delete' };
          calls.push(call);
          return query(call);
        },
      };
    },
  };
}

function echoRow(call: Call): { data: unknown[]; error: null } {
  const payload = call.payload as Record<string, unknown>;
  return { data: [{ id: call.eq?.value ?? payload.id, ...payload }], error: null };
}

test('Material to database row mapping uses the materials snake_case columns', () => {
  const row = materialToDatabaseRow(material({
    materialModel: 'Isotropic',
    subCategory: 'Die cast',
  }));
  assert.deepEqual(Object.keys(row), MATERIAL_COLUMNS.split(','));
  assert.equal(row.id, 'seed-adc12');
  assert.equal(row.name, 'ADC12');
  assert.equal(row.category_id, 'Metal');
  assert.equal(row.material_model, 'Isotropic');
  assert.equal(row.sub_category, 'Die cast');
  assert.equal(row.ultimate_stress, 336);
  assert.equal(row.elongation, 2.5);
  assert.equal(row.source, 'Web');
  assert.equal(row.notes, '');
  assert.equal(row.updated_at, '2026-09-17T07:17:00.000Z');
  assert.equal('category' in row, false);
  assert.equal('youngsModulus' in row, false);
  assert.equal('materialModel' in row, false);
});

test('exact engineering numbers are preserved on the database row', () => {
  const row = materialToDatabaseRow(material());
  assert.equal(Object.is(row.density, 2.82e-9), true);
  assert.equal(Object.is(row.youngs_modulus, 71000), true);
  assert.equal(Object.is(row.poisson_ratio, 0.3), true);
  assert.equal(Object.is(row.yield_stress, 165), true);
  assert.equal(Object.is(row.etan, 8002.05), true);
});

test('undefined nullable optional fields map to null', () => {
  const row = materialToDatabaseRow(material({
    materialModel: undefined,
    subCategory: undefined,
    orthotropic: undefined,
    compositeStrength: undefined,
    stressStrainCurve: undefined,
    density: null,
  }));
  assert.equal(row.material_model, null);
  assert.equal(row.sub_category, null);
  assert.equal(row.orthotropic, null);
  assert.equal(row.composite_strength, null);
  assert.equal(row.stress_strain_curve, null);
  assert.equal(row.density, null);
  assert.equal(Object.is(row.youngs_modulus, 71000), true);
});

test('stress-strain point order is preserved', () => {
  const row = materialToDatabaseRow(material());
  assert.equal(row.stress_strain_curve, curve);
  assert.deepEqual(row.stress_strain_curve?.points.map(point => [point.strain, point.stress]), [
    [0.02, 100],
    [0.001, 10],
    [0.03, 275],
  ]);
});

test('history is preserved without rewriting timestamps or order', () => {
  const row = materialToDatabaseRow(material());
  assert.equal(row.history, history);
  assert.deepEqual(row.history.map(entry => entry.at), ['2026-09-17T15:17:00', '2026-09-18T14:37:00']);
});

test('INSERT uses the materials table and one explicit payload', async () => {
  const calls: Call[] = [];
  const input = material({ materialModel: 'Isotropic' });
  const saved = await insertSupabaseMaterial(input, fakeClient(call => {
    assert.equal(Array.isArray(call.payload), false);
    return {
      data: [{
        ...call.payload as object,
        updated_at: '2026-09-17T07:17:00+00:00',
      }],
      error: null,
    };
  }, calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'materials');
  assert.equal(calls[0].op, 'insert');
  assert.equal(calls[0].columns, MATERIAL_COLUMNS);
  assert.equal(calls[0].columns.includes('*'), false);
  assert.equal((calls[0].payload as { id: string }).id, 'seed-adc12');
  assert.equal(Object.is((calls[0].payload as { density: number }).density, 2.82e-9), true);
  assert.equal(saved.id, 'seed-adc12');
  assert.equal(saved.name, 'ADC12');
  assert.equal(saved.category, 'Metal');
  assert.equal(saved.materialModel, 'Isotropic');
  assert.equal(saved.updatedAt, '2026-09-17T07:17:00.000Z');
  assert.equal(saved.history, history);
  assert.notEqual(saved.updatedAt, '2026-09-17T15:17:00.000Z');
});

test('INSERT with an empty id throws before calling Supabase', async () => {
  const calls: Call[] = [];
  await assert.rejects(
    () => insertSupabaseMaterial(material({ id: '' }), fakeClient(() => ({ data: [], error: null }), calls)),
    (error: unknown) => {
      assert.equal(error instanceof Error ? error.message : '', 'Supabase 新增材料失敗：缺少材料 id。');
      return true;
    },
  );
  assert.equal(calls.length, 0);
});

test('INSERT error throws', async () => {
  const calls: Call[] = [];
  await assert.rejects(
    () => insertSupabaseMaterial(material(), fakeClient(() => ({ data: null, error: { message: 'duplicate key value' } }), calls)),
    /Supabase 新增材料失敗：duplicate key value/,
  );
  assert.equal(calls[0].table, 'materials');
});

test('INSERT with no returned row throws', async () => {
  await assert.rejects(
    () => insertSupabaseMaterial(material(), fakeClient(() => ({ data: [], error: null }), [])),
    /Supabase 新增材料失敗：沒有回傳寫入後的材料。/,
  );
  await assert.rejects(
    () => insertSupabaseMaterial(material(), fakeClient(() => ({ data: null, error: null }), [])),
    /Supabase 新增材料失敗：沒有回傳寫入後的材料。/,
  );
});

test('UPDATE filters by the exact id and does not send id', async () => {
  const calls: Call[] = [];
  const input = material();
  const saved = await updateSupabaseMaterial(input, fakeClient(echoRow, calls));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'materials');
  assert.equal(calls[0].op, 'update');
  assert.deepEqual(calls[0].eq, { column: 'id', value: 'seed-adc12' });
  assert.equal(calls[0].columns, MATERIAL_COLUMNS);
  assert.equal('id' in (calls[0].payload as object), false);
  assert.equal((calls[0].payload as { name: string }).name, 'ADC12');
  assert.equal(Object.is((calls[0].payload as { etan: number }).etan, 8002.05), true);
  assert.equal(saved.id, 'seed-adc12');
  assert.equal(saved.youngsModulus, 71000);
  assert.equal(saved.updatedAt, '2026-09-17T07:17:00.000Z');
});

test('UPDATE error throws', async () => {
  await assert.rejects(
    () => updateSupabaseMaterial(material(), fakeClient(() => ({ data: null, error: { message: 'check constraint' } }), [])),
    /Supabase 更新材料失敗：check constraint/,
  );
});

test('UPDATE zero rows throws the permission or not-found error', async () => {
  await assert.rejects(
    () => updateSupabaseMaterial(material(), fakeClient(() => ({ data: [], error: null }), [])),
    (error: unknown) => {
      assert.equal(error instanceof Error ? error.message : '', '材料不存在或目前帳號沒有更新權限。');
      return true;
    },
  );
  await assert.rejects(
    () => updateSupabaseMaterial(material(), fakeClient(() => ({ data: null, error: null }), [])),
    /材料不存在或目前帳號沒有更新權限。/,
  );
});

test('DELETE filters by the exact id and succeeds only when that id is returned', async () => {
  const calls: Call[] = [];
  const deleted = await deleteSupabaseMaterial('seed-adc12', fakeClient(() => ({ data: [{ id: 'seed-adc12' }], error: null }), calls));
  assert.equal(deleted, 'seed-adc12');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].table, 'materials');
  assert.equal(calls[0].op, 'delete');
  assert.deepEqual(calls[0].eq, { column: 'id', value: 'seed-adc12' });
  assert.equal(calls[0].columns, 'id');
  assert.equal(calls[0].payload, undefined);
});

test('DELETE error throws', async () => {
  await assert.rejects(
    () => deleteSupabaseMaterial('seed-adc12', fakeClient(() => ({ data: null, error: { message: 'statement timeout' } }), [])),
    /Supabase 刪除材料失敗：statement timeout/,
  );
});

test('DELETE zero rows throws the permission or not-found error', async () => {
  await assert.rejects(
    () => deleteSupabaseMaterial('missing-id', fakeClient(() => ({ data: [], error: null }), [])),
    (error: unknown) => {
      assert.equal(error instanceof Error ? error.message : '', '材料不存在或目前帳號沒有刪除權限。');
      return true;
    },
  );
  await assert.rejects(
    () => deleteSupabaseMaterial('missing-id', fakeClient(() => ({ data: null, error: null }), [])),
    /材料不存在或目前帳號沒有刪除權限。/,
  );
});

test('write module has no upsert, category or source writes, or service credentials', async () => {
  const source = await readFile(new URL('../src/lib/supabaseMaterialWrites.ts', import.meta.url), 'utf8');
  assert.equal(source.includes('upsert('), false);
  assert.equal(source.includes('.upsert'), false);
  assert.equal(source.includes('categories'), false);
  assert.equal(source.includes('sources'), false);
  assert.equal(source.includes('service_role'), false);
  assert.equal(source.includes('sb_secret_'), false);
  assert.equal(source.includes('SUPABASE_SERVICE_ROLE_KEY'), false);
  assert.equal(source.includes('is_current_user_material_admin'), false);
  assert.equal(source.includes('createMaterialLibraryClient'), true);
  assert.equal(source.includes("from('materials')"), true);
});

test('only storage reaches the material write adapter, and only behind the Supabase flag', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const editing = await readFile(new URL('../src/lib/localEditing.ts', import.meta.url), 'utf8');
  for (const token of ['supabaseMaterialWrites', 'insertSupabaseMaterial', 'updateSupabaseMaterial', 'deleteSupabaseMaterial']) {
    assert.equal(app.includes(token), false, token);
    assert.equal(editing.includes(token), false, token);
  }
  assert.equal(storage.includes("from './supabaseMaterialWrites'"), true);
  assert.match(storage, /const supabaseMaterialWriters = supabaseReadOnly\s*\?\s*\{ insertSupabaseMaterial, updateSupabaseMaterial, deleteSupabaseMaterial \}/);
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.equal(editing.includes('此功能在 Supabase 模式目前為唯讀，尚未開放寫入。'), true);
});
