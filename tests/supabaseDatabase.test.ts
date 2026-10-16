import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDatabase } from '../src/lib/database-schema.mjs';
import {
  assembleSupabaseDatabase,
  mapCategoryIndex,
  mapMaterialRow,
  mapSourceIndex,
  readSupabaseDatabase,
  updatedAtFromTimestamptz,
  type CategoryRow,
  type MaterialCatalogClient,
  type MaterialRow,
  type SourceRow,
} from '../src/lib/supabaseDatabase';
import type { CompositeStrength, HistoryEntry, OrthotropicProperties, StressStrainData } from '../src/types';

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

const orthotropic: OrthotropicProperties = {
  e1: 25000, e2: 20000, e3: 10000, g12: 5000, g13: 4000, g23: 3000, nu12: 0.2, nu13: 0.18, nu23: 0.16,
};
const compositeStrength: CompositeStrength = { xt: 400, xc: 300, yt: 200, yc: 150, s12: 80 };

function row(overrides: Partial<MaterialRow> = {}): MaterialRow {
  return {
    id: 'seed-1',
    name: 'ADC12',
    category_id: 'Metal',
    material_model: null,
    sub_category: null,
    density: 2.82e-9,
    youngs_modulus: 71000,
    poisson_ratio: 0.3,
    yield_stress: 165,
    etan: 8002.05,
    ultimate_stress: 336,
    elongation: 2.5,
    orthotropic: null,
    composite_strength: null,
    stress_strain_curve: null,
    source: 'Web',
    notes: '',
    updated_at: '2026-09-17T07:17:00+00:00',
    history,
    ...overrides,
  };
}

const categories: CategoryRow[] = [
  { id: 'Others', label: '其他-from-db', color: '#111111' },
  { id: 'beta', label: 'Beta-from-db', color: '#222222' },
  { id: 'Metal', label: '金屬-from-db', color: '#333333' },
  { id: 'Alloy', label: 'Alloy-from-db', color: '#444444' },
  { id: 'Elastomer', label: '彈性體-from-db', color: '#555555' },
  { id: 'Plastic', label: '塑膠-from-db', color: '#666666' },
  { id: 'Composite', label: '複合材料-from-db', color: '#777777' },
];

const sources: SourceRow[] = [
  { name: 'zeta' },
  { name: 'Alpha' },
  { name: 'Web' },
];

test('maps snake_case Supabase columns onto the existing Material shape', () => {
  const material = mapMaterialRow(row({
    material_model: 'Isotropic',
    sub_category: 'Die cast',
    stress_strain_curve: curve,
  }));
  assert.equal(material.category, 'Metal');
  assert.equal(material.materialModel, 'Isotropic');
  assert.equal(material.subCategory, 'Die cast');
  assert.equal(material.youngsModulus, 71000);
  assert.equal(material.poissonRatio, 0.3);
  assert.equal(material.yieldStress, 165);
  assert.equal(material.ultimateStress, 336);
  assert.equal(material.stressStrainCurve, curve);
  assert.equal('category_id' in material, false);
  assert.equal('youngs_modulus' in material, false);
  assert.equal('material_model' in material, false);
  assert.equal('sub_category' in material, false);
  assert.equal('updated_at' in material, false);
});

test('omits null optional material fields instead of storing null', () => {
  const material = mapMaterialRow(row());
  assert.equal('materialModel' in material, false);
  assert.equal('subCategory' in material, false);
  assert.equal('orthotropic' in material, false);
  assert.equal('compositeStrength' in material, false);
  assert.equal(material.materialModel, undefined);
  assert.equal(material.subCategory, undefined);
  assert.equal(material.orthotropic, undefined);
  assert.equal(material.compositeStrength, undefined);
});

test('keeps representative engineering numbers exact', () => {
  const material = mapMaterialRow(row());
  assert.equal(Object.is(material.density, 2.82e-9), true);
  assert.equal(Object.is(material.youngsModulus, 71000), true);
  assert.equal(Object.is(material.etan, 8002.05), true);
});

test('preserves history entries without rewriting them', () => {
  const material = mapMaterialRow(row());
  assert.equal(material.history, history);
  assert.deepEqual(material.history, [
    { at: '2026-09-17T15:17:00', action: 'created', summary: 'Sample record seeded from design mockup' },
    { at: '2026-09-18T14:37:00', action: 'edited', summary: '保持原始歷史順序' },
  ]);
});

test('preserves stress-strain curve point order and nested objects', () => {
  const material = mapMaterialRow(row({
    material_model: 'Orthotropic',
    orthotropic,
    composite_strength: compositeStrength,
    stress_strain_curve: curve,
  }));
  assert.equal(material.stressStrainCurve, curve);
  assert.equal(material.orthotropic, orthotropic);
  assert.equal(material.compositeStrength, compositeStrength);
  assert.deepEqual(material.stressStrainCurve?.points.map(point => [point.strain, point.stress]), [
    [0.02, 100],
    [0.001, 10],
    [0.03, 275],
  ]);
});

test('reconstructs category indexes from Supabase labels and colors', () => {
  const index = mapCategoryIndex(categories);
  assert.deepEqual(index, [
    { id: 'Metal', label: '金屬-from-db', color: '#333333' },
    { id: 'Plastic', label: '塑膠-from-db', color: '#666666' },
    { id: 'Composite', label: '複合材料-from-db', color: '#777777' },
    { id: 'Elastomer', label: '彈性體-from-db', color: '#555555' },
    { id: 'Others', label: '其他-from-db', color: '#111111' },
    { id: 'Alloy', label: 'Alloy-from-db', color: '#444444' },
    { id: 'beta', label: 'Beta-from-db', color: '#222222' },
  ]);
});

test('orders known categories first and appends unknown ids deterministically', () => {
  const partial = mapCategoryIndex([
    { id: 'zeta', label: 'Z', color: '#abcdef' },
    { id: 'Plastic', label: 'P', color: '#abcdef' },
    { id: 'Alloy', label: 'A', color: '#abcdef' },
    { id: 'Metal', label: 'M', color: '#abcdef' },
  ]);
  assert.deepEqual(partial.map(category => category.id), ['Metal', 'Plastic', 'Alloy', 'zeta']);
  assert.deepEqual(mapSourceIndex(sources), ['Alpha', 'Web', 'zeta']);
});

test('converts updated_at into a valid updatedAt ISO string', () => {
  // ADC12 is stored as 07:17 UTC, the same instant as 15:17 Asia/Taipei.
  assert.equal(updatedAtFromTimestamptz('2026-09-17T07:17:00+00:00'), '2026-09-17T07:17:00.000Z');
  assert.equal(updatedAtFromTimestamptz('2026-09-17 07:17:00+00'), '2026-09-17T07:17:00.000Z');
  const material = mapMaterialRow(row());
  assert.equal(material.updatedAt, '2026-09-17T07:17:00.000Z');
  assert.equal(Number.isNaN(Date.parse(material.updatedAt)), false);
  assert.notEqual(material.updatedAt, '2026-09-17T15:17:00.000Z');
  assert.throws(() => updatedAtFromTimestamptz('not-a-timestamp'), /updated_at/);
});

test('assembled MasterDatabase passes existing validateDatabase()', () => {
  const database = assembleSupabaseDatabase({
    categories,
    sources,
    materials: [row()],
  });
  assert.equal(database.schemaVersion, 1);
  assert.equal(database.materials.length, 1);
  assert.equal(database.materials[0].name, 'ADC12');
  assert.equal(validateDatabase(database), database);
  assert.throws(() => assembleSupabaseDatabase({
    categories: [],
    sources,
    materials: [row()],
  }), /Missing index for material ADC12/);
});

test('readSupabaseDatabase uses explicit columns and surfaces query failures', async () => {
  const seen: { table: string; columns: string }[] = [];
  const failure = fakeClient(table => {
    if (table === 'categories') return { data: null, error: { message: 'permission denied for table categories' } };
    if (table === 'sources') return { data: sources, error: null };
    return { data: [row()], error: null };
  }, seen);
  await assert.rejects(
    () => readSupabaseDatabase(failure),
    /Supabase 讀取 categories 失敗：permission denied for table categories/,
  );
  assert.deepEqual(seen.map(query => query.table), ['categories', 'sources', 'materials']);
  for (const query of seen) assert.equal(query.columns.includes('*'), false);
  assert.equal(seen[0].columns, 'id,label,color');
  assert.equal(seen[1].columns, 'name');
  assert.equal(seen[2].columns, 'id,name,category_id,material_model,sub_category,density,youngs_modulus,poisson_ratio,yield_stress,etan,ultimate_stress,elongation,orthotropic,composite_strength,stress_strain_curve,source,notes,updated_at,history');

  const success = fakeClient(table => {
    if (table === 'categories') return { data: categories, error: null };
    if (table === 'sources') return { data: sources, error: null };
    return { data: [row()], error: null };
  }, []);
  const database = await readSupabaseDatabase(success);
  assert.equal(validateDatabase(database), database);
  assert.equal(database.indexes.categories[0].id, 'Metal');
  assert.equal(database.indexes.categories[0].label, '金屬-from-db');
});

function fakeClient(
  respond: (table: string) => { data: unknown[] | null; error: { message: string } | null },
  seen: { table: string; columns: string }[],
): MaterialCatalogClient {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          seen.push({ table, columns });
          return Promise.resolve(respond(table));
        },
      };
    },
  };
}
