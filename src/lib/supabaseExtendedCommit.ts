import type { Material, StressStrainData } from '../types';
import type { MasterDatabase } from './database-schema.mjs';
import { validateDatabase } from './database-schema.mjs';
import { isStressStrainData } from './curveData';
import { changeIndex, deriveIndexes } from './indexes';
import type { CategoryRow, SourceRow } from './supabaseDatabase';
import {
  SupabaseSourceRenameRemoteCommittedError,
  type SourceRenameResult,
} from './supabaseExtendedWrites';

export { SupabaseSourceRenameRemoteCommittedError };

function sameCurve(submitted: StressStrainData, returned: StressStrainData): boolean {
  return submitted.definition === returned.definition
    && submitted.strainKind === returned.strainKind
    && submitted.source === returned.source
    && submitted.notes === returned.notes
    && submitted.points.length === returned.points.length
    && submitted.points.every((point, index) => point.strain === returned.points[index].strain && point.stress === returned.points[index].stress);
}

function requireIndexChange(database: MasterDatabase, kind: 'category' | 'source', id: string | null, name: string): void {
  const result = changeIndex(database.indexes, kind, id, name);
  if (!result.next) throw new Error(result.error ?? '無法儲存索引。');
}

export async function commitSupabaseCurve(
  database: MasterDatabase,
  id: string,
  curve: StressStrainData,
  write: (id: string, curve: StressStrainData) => Promise<Material>,
): Promise<MasterDatabase> {
  if (!isStressStrainData(curve)) throw new Error('Supabase 更新曲線失敗：曲線資料不正確。');
  if (!database.materials.some(row => row.id === id)) throw new Error('材料不存在或目前帳號沒有更新權限。');
  const returned = await write(id, curve);
  if (returned.id !== id) throw new Error('Supabase 更新曲線失敗：回傳的材料 id 不正確。');
  if (!isStressStrainData(returned.stressStrainCurve) || !sameCurve(curve, returned.stressStrainCurve)) {
    throw new Error('Supabase 更新曲線失敗：回傳的曲線與送出的曲線不一致。');
  }
  return validateDatabase({
    ...database,
    materials: database.materials.map(row => row.id === id ? returned : row),
  });
}

export async function commitSupabaseCurveClear(
  database: MasterDatabase,
  id: string,
  write: (id: string) => Promise<Material>,
): Promise<MasterDatabase> {
  const existing = database.materials.find(row => row.id === id);
  if (!existing) throw new Error('材料不存在或目前帳號沒有更新權限。');
  if (!isStressStrainData(existing.stressStrainCurve)) throw new Error('Supabase 移除曲線失敗：目前沒有已儲存的完整曲線。');
  const returned = await write(id);
  if (returned.id !== id) throw new Error('Supabase 移除曲線失敗：回傳的材料 id 不正確。');
  if (isStressStrainData(returned.stressStrainCurve)) throw new Error('Supabase 移除曲線失敗：回傳的材料仍包含完整曲線。');
  return validateDatabase({
    ...database,
    materials: database.materials.map(row => row.id === id ? returned : row),
  });
}

export async function commitSupabaseCategoryAdd(
  database: MasterDatabase,
  name: string,
  write: (name: string) => Promise<CategoryRow>,
): Promise<MasterDatabase> {
  requireIndexChange(database, 'category', null, name);
  const returned = await write(name);
  if (database.indexes.categories.some(row => row.id === returned.id)) {
    throw new Error('Supabase 新增分類失敗：回傳的分類 id 已存在。');
  }
  return validateDatabase({
    ...database,
    indexes: {
      ...database.indexes,
      categories: [...database.indexes.categories, { id: returned.id, label: returned.label, color: returned.color }],
    },
  });
}

export async function commitSupabaseCategoryRename(
  database: MasterDatabase,
  id: string,
  label: string,
  write: (id: string, label: string) => Promise<CategoryRow>,
): Promise<MasterDatabase> {
  requireIndexChange(database, 'category', id, label);
  const returned = await write(id, label);
  if (returned.id !== id) throw new Error('Supabase 重新命名分類失敗：回傳的分類 id 與要求不一致。');
  if (!database.indexes.categories.some(row => row.id === id)) throw new Error('分類已不存在，請重新開啟管理。');
  return validateDatabase({
    ...database,
    indexes: {
      ...database.indexes,
      categories: database.indexes.categories.map(row => row.id === id
        ? { id: returned.id, label: returned.label, color: returned.color }
        : row),
    },
  });
}

export async function commitSupabaseSourceAdd(
  database: MasterDatabase,
  name: string,
  write: (name: string) => Promise<SourceRow>,
): Promise<MasterDatabase> {
  requireIndexChange(database, 'source', null, name);
  const returned = await write(name);
  if (database.indexes.sources.some(source => source.toLowerCase() === returned.name.toLowerCase())) {
    throw new Error('Supabase 新增來源失敗：回傳的來源已存在。');
  }
  return validateDatabase({
    ...database,
    indexes: deriveIndexes(database.materials, {
      ...database.indexes,
      sources: [...database.indexes.sources, returned.name],
    }),
  });
}

export async function commitSupabaseSourceRename(
  database: MasterDatabase,
  oldName: string,
  newName: string,
  rename: (oldName: string, newName: string) => Promise<SourceRenameResult>,
  reread: () => Promise<MasterDatabase>,
): Promise<MasterDatabase> {
  requireIndexChange(database, 'source', oldName, newName);
  const renamed = await rename(oldName, newName);
  if (renamed.oldName !== oldName || renamed.newName !== newName.trim()) {
    throw new SupabaseSourceRenameRemoteCommittedError();
  }
  try {
    return validateDatabase(await reread());
  } catch (error) {
    if (error instanceof SupabaseSourceRenameRemoteCommittedError) throw error;
    throw new SupabaseSourceRenameRemoteCommittedError();
  }
}
