import type { CompositeStrength, HistoryEntry, Material, MaterialModel, OrthotropicProperties, StressStrainData } from '../types';
import { validateDatabase, type MasterDatabase } from './database-schema.mjs';
import { createMaterialLibraryClient } from './supabaseClient';

const BUILTIN_CATEGORY_ORDER = ['Metal', 'Plastic', 'Composite', 'Elastomer', 'Others'] as const;

const CATEGORY_COLUMNS = 'id,label,color';
const SOURCE_COLUMNS = 'name';
const MATERIAL_COLUMNS = 'id,name,category_id,material_model,sub_category,density,youngs_modulus,poisson_ratio,yield_stress,etan,ultimate_stress,elongation,orthotropic,composite_strength,stress_strain_curve,source,notes,updated_at,history';

export interface CategoryRow {
  id: string;
  label: string;
  color: string;
}

export interface SourceRow {
  name: string;
}

export interface MaterialRow {
  id: string;
  name: string;
  category_id: string;
  material_model: MaterialModel | null;
  sub_category: string | null;
  density: number | null;
  youngs_modulus: number | null;
  poisson_ratio: number | null;
  yield_stress: number | null;
  etan: number | null;
  ultimate_stress: number | null;
  elongation: number | null;
  orthotropic: OrthotropicProperties | null;
  composite_strength: CompositeStrength | null;
  stress_strain_curve: StressStrainData | null;
  source: string;
  notes: string;
  updated_at: string;
  history: HistoryEntry[];
}

interface SupabaseQueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface MaterialCatalogClient {
  from(table: string): {
    select(columns: string): PromiseLike<SupabaseQueryResult>;
  };
}

export function updatedAtFromTimestamptz(value: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('Supabase updated_at 不是有效時間。');
  }
  return new Date(value).toISOString();
}

/** Map one PostgREST row onto the existing Material shape. Null optional fields are omitted. */
export function mapMaterialRow(row: MaterialRow): Material {
  const material: Material = {
    id: row.id,
    name: row.name,
    category: row.category_id,
    density: row.density,
    youngsModulus: row.youngs_modulus,
    poissonRatio: row.poisson_ratio,
    yieldStress: row.yield_stress,
    etan: row.etan,
    ultimateStress: row.ultimate_stress,
    elongation: row.elongation,
    source: row.source,
    notes: row.notes,
    updatedAt: updatedAtFromTimestamptz(row.updated_at),
    history: row.history,
  };
  if (row.material_model != null) material.materialModel = row.material_model;
  if (row.sub_category != null) material.subCategory = row.sub_category;
  if (row.orthotropic != null) material.orthotropic = row.orthotropic;
  if (row.composite_strength != null) material.compositeStrength = row.composite_strength;
  if (row.stress_strain_curve != null) material.stressStrainCurve = row.stress_strain_curve;
  return material;
}

/** Known category ids stay in application order. Unknown ids follow, sorted by id. */
export function mapCategoryIndex(rows: CategoryRow[]): { id: string; label: string; color: string }[] {
  const builtin = new Set<string>(BUILTIN_CATEGORY_ORDER);
  const known: { id: string; label: string; color: string }[] = [];
  for (const id of BUILTIN_CATEGORY_ORDER) {
    for (const row of rows) {
      if (row.id === id) known.push({ id: row.id, label: row.label, color: row.color });
    }
  }
  const unknown = rows
    .filter(row => !builtin.has(row.id))
    .map(row => ({ id: row.id, label: row.label, color: row.color }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...known, ...unknown];
}

export function mapSourceIndex(rows: SourceRow[]): string[] {
  return rows.map(row => row.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function assembleSupabaseDatabase(input: {
  categories: CategoryRow[];
  sources: SourceRow[];
  materials: MaterialRow[];
}): MasterDatabase {
  return validateDatabase({
    schemaVersion: 1,
    materials: input.materials.map(mapMaterialRow),
    indexes: {
      categories: mapCategoryIndex(input.categories),
      sources: mapSourceIndex(input.sources),
    },
  });
}

function rowsOrThrow(table: string, result: SupabaseQueryResult): unknown[] {
  if (result.error) throw new Error(`Supabase 讀取 ${table} 失敗：${result.error.message}`);
  if (!Array.isArray(result.data)) throw new Error(`Supabase 讀取 ${table} 失敗：沒有回傳資料列。`);
  return result.data;
}

export async function readSupabaseDatabase(client?: MaterialCatalogClient): Promise<MasterDatabase> {
  const supabase = client ?? createMaterialLibraryClient();
  let categories: SupabaseQueryResult;
  let sources: SupabaseQueryResult;
  let materials: SupabaseQueryResult;
  try {
    [categories, sources, materials] = await Promise.all([
      supabase.from('categories').select(CATEGORY_COLUMNS),
      supabase.from('sources').select(SOURCE_COLUMNS),
      supabase.from('materials').select(MATERIAL_COLUMNS),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知錯誤';
    if (message.startsWith('Supabase ')) throw error;
    throw new Error(`Supabase 讀取失敗：${message}`);
  }
  return assembleSupabaseDatabase({
    categories: rowsOrThrow('categories', categories) as CategoryRow[],
    sources: rowsOrThrow('sources', sources) as SourceRow[],
    materials: rowsOrThrow('materials', materials) as MaterialRow[],
  });
}
