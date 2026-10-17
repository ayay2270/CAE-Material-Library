import type { Material } from '../types';
import { createMaterialLibraryClient } from './supabaseClient';
import { MATERIAL_COLUMNS, mapMaterialRow, type MaterialRow } from './supabaseDatabase';

const DELETE_RETURNING_COLUMNS = 'id';

interface WriteResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

export interface MaterialWriteQuery {
  eq(column: string, value: string): MaterialWriteQuery;
  select(columns: string): PromiseLike<WriteResult>;
}

export interface MaterialWriteTable {
  insert(payload: MaterialRow): MaterialWriteQuery;
  update(payload: Omit<MaterialRow, 'id'>): MaterialWriteQuery;
  delete(): MaterialWriteQuery;
}

/** Narrow client used by tests. The runtime default is the existing singleton. */
export interface MaterialWriteClient {
  from(table: string): MaterialWriteTable;
}

/** Explicit material_library.materials payload. Optional Material fields become null. */
export function materialToDatabaseRow(material: Material): MaterialRow {
  return {
    id: material.id,
    name: material.name,
    category_id: material.category,
    material_model: material.materialModel ?? null,
    sub_category: material.subCategory ?? null,
    density: material.density ?? null,
    youngs_modulus: material.youngsModulus ?? null,
    poisson_ratio: material.poissonRatio ?? null,
    yield_stress: material.yieldStress ?? null,
    etan: material.etan ?? null,
    ultimate_stress: material.ultimateStress ?? null,
    elongation: material.elongation ?? null,
    orthotropic: material.orthotropic ?? null,
    composite_strength: material.compositeStrength ?? null,
    stress_strain_curve: material.stressStrainCurve ?? null,
    source: material.source,
    notes: material.notes,
    updated_at: material.updatedAt,
    history: material.history,
  };
}

function writableColumns(material: Material): Omit<MaterialRow, 'id'> {
  const row = materialToDatabaseRow(material);
  return {
    name: row.name,
    category_id: row.category_id,
    material_model: row.material_model,
    sub_category: row.sub_category,
    density: row.density,
    youngs_modulus: row.youngs_modulus,
    poisson_ratio: row.poisson_ratio,
    yield_stress: row.yield_stress,
    etan: row.etan,
    ultimate_stress: row.ultimate_stress,
    elongation: row.elongation,
    orthotropic: row.orthotropic,
    composite_strength: row.composite_strength,
    stress_strain_curve: row.stress_strain_curve,
    source: row.source,
    notes: row.notes,
    updated_at: row.updated_at,
    history: row.history,
  };
}

function runtimeClient(): MaterialWriteClient {
  return createMaterialLibraryClient() as unknown as MaterialWriteClient;
}

function detail(message: string): string {
  return message
    .replace(/bearer\s+\S+/gi, '[redacted]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]');
}

function failure(label: string, error: unknown): Error {
  if (error instanceof Error && (error.message.startsWith('Supabase ') || error.message.startsWith('材料不存在'))) return error;
  const message = error instanceof Error ? error.message : '未知錯誤';
  return new Error(`${label}${detail(message)}`);
}

function oneMaterial(result: WriteResult, label: string, zeroRows: Error): Material {
  if (result.error) throw new Error(`${label}${detail(result.error.message)}`);
  if (!Array.isArray(result.data) || result.data.length === 0) throw zeroRows;
  if (result.data.length !== 1) throw new Error(`${label}回傳資料列數量不正確。`);
  return mapMaterialRow(result.data[0] as MaterialRow);
}

export async function insertSupabaseMaterial(material: Material, client?: MaterialWriteClient): Promise<Material> {
  const supabase = client ?? runtimeClient();
  const label = 'Supabase 新增材料失敗：';
  if (!material.id) throw new Error(`${label}缺少材料 id。`);
  try {
    const result = await supabase.from('materials').insert(materialToDatabaseRow(material)).select(MATERIAL_COLUMNS);
    return oneMaterial(result, label, new Error(`${label}沒有回傳寫入後的材料。`));
  } catch (error) {
    throw failure(label, error);
  }
}

export async function updateSupabaseMaterial(material: Material, client?: MaterialWriteClient): Promise<Material> {
  const supabase = client ?? runtimeClient();
  const label = 'Supabase 更新材料失敗：';
  if (!material.id) throw new Error(`${label}缺少材料 id。`);
  try {
    // A non-admin UPDATE can match zero rows and still return no error.
    const result = await supabase.from('materials').update(writableColumns(material)).eq('id', material.id).select(MATERIAL_COLUMNS);
    return oneMaterial(result, label, new Error('材料不存在或目前帳號沒有更新權限。'));
  } catch (error) {
    throw failure(label, error);
  }
}

export async function deleteSupabaseMaterial(id: string, client?: MaterialWriteClient): Promise<string> {
  const supabase = client ?? runtimeClient();
  const label = 'Supabase 刪除材料失敗：';
  if (!id) throw new Error(`${label}缺少材料 id。`);
  try {
    // A non-admin DELETE can match zero rows and still return no error.
    const result = await supabase.from('materials').delete().eq('id', id).select(DELETE_RETURNING_COLUMNS);
    if (result.error) throw new Error(`${label}${detail(result.error.message)}`);
    const rows = Array.isArray(result.data) ? result.data as { id?: string }[] : [];
    if (rows.length === 0) throw new Error('材料不存在或目前帳號沒有刪除權限。');
    if (rows.length !== 1 || rows[0]?.id !== id) throw new Error(`${label}回傳的刪除結果不正確。`);
    return id;
  } catch (error) {
    throw failure(label, error);
  }
}
