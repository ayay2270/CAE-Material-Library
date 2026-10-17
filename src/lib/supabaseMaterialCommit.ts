import type { HistoryEntry, Material, MaterialInput } from '../types';
import type { MasterDatabase } from './database-schema.mjs';
import { validateDatabase } from './database-schema.mjs';
import { deriveIndexes } from './indexes';

export const SUPABASE_EXISTING_SOURCE_REQUIRED = '請選擇現有的 Source。Supabase 目前不能新增來源。';
export const SUPABASE_EXISTING_CATEGORY_REQUIRED = '請選擇現有的 Category。Supabase 目前不能新增分類。';
export const SUPABASE_WRITE_IN_PROGRESS = '材料寫入進行中，請稍候。';
export const SUPABASE_SOURCE_DISABLED = 'Supabase 資料來源未啟用。';

/** Supabase material rows reference an existing source. This does not insert a source. */
export function assertExistingSource(source: string, sources: readonly string[]): void {
  const value = source.trim();
  if (!value || !sources.includes(value)) throw new Error(SUPABASE_EXISTING_SOURCE_REQUIRED);
}

/** Category rows stay read-only, so a material must use a category already in the index. */
export function assertExistingCategory(category: string, categories: readonly { id: string }[]): void {
  if (!category || !categories.some(row => row.id === category)) throw new Error(SUPABASE_EXISTING_CATEGORY_REQUIRED);
}

export function materialFromInput(input: MaterialInput, now: string, id: string): Material {
  if (!id.trim()) throw new Error('Supabase 新增材料失敗：缺少材料 id。');
  return {
    ...input,
    source: input.source.trim(),
    id,
    updatedAt: now,
    history: [{ at: now, action: 'created', summary: '建立記錄' }],
  };
}

export function editedMaterial(
  before: Material,
  input: MaterialInput,
  now: string,
  describe: (before: Material, after: MaterialInput) => string,
): Material {
  const entry: HistoryEntry = { at: now, action: 'edited', summary: describe(before, input) };
  return {
    ...before,
    ...input,
    source: input.source.trim(),
    id: before.id,
    updatedAt: now,
    history: [entry, ...before.history],
  };
}

function databaseWithMaterials(database: MasterDatabase, materials: Material[]): MasterDatabase {
  return {
    ...database,
    materials,
    indexes: deriveIndexes(materials, deriveIndexes(database.materials, database.indexes)),
  };
}

/** The same database object is stored as both draft and saved, so the screen is not dirty. */
export function replaceCommittedDatabase(database: MasterDatabase): MasterDatabase {
  const indexes = deriveIndexes(database.materials, database.indexes);
  return validateDatabase({ ...database, indexes });
}

/** Publish only the database returned after the remote write resolves. */
export async function runSupabaseMaterialMutation(
  database: MasterDatabase,
  mutate: (database: MasterDatabase) => Promise<MasterDatabase>,
): Promise<MasterDatabase> {
  return replaceCommittedDatabase(await mutate(database));
}

function assertReferencedIndexes(input: MaterialInput, database: MasterDatabase): void {
  assertExistingCategory(input.category, database.indexes.categories);
  assertExistingSource(input.source, database.indexes.sources);
}

export async function commitSupabaseInsert(
  database: MasterDatabase,
  input: MaterialInput,
  write: (material: Material) => Promise<Material>,
  now: string,
  id: string,
): Promise<MasterDatabase> {
  assertReferencedIndexes(input, database);
  const prepared = materialFromInput(input, now, id);
  const returned = await write(prepared);
  if (!returned?.id) throw new Error('Supabase 新增材料失敗：沒有回傳寫入後的材料。');
  const exists = database.materials.some(row => row.id === returned.id);
  if (exists) throw new Error('Supabase 新增材料失敗：材料 id 已存在。');
  return databaseWithMaterials(database, [...database.materials, returned]);
}

export async function commitSupabaseUpdate(
  database: MasterDatabase,
  id: string,
  input: MaterialInput,
  write: (material: Material) => Promise<Material>,
  now: string,
  describe: (before: Material, after: MaterialInput) => string,
): Promise<MasterDatabase> {
  assertReferencedIndexes(input, database);
  const before = database.materials.find(row => row.id === id);
  if (!before) throw new Error('材料不存在或目前帳號沒有更新權限。');
  const prepared = editedMaterial(before, input, now, describe);
  const returned = await write(prepared);
  if (!returned?.id || returned.id !== id) throw new Error('Supabase 更新材料失敗：回傳的材料 id 不正確。');
  return databaseWithMaterials(database, database.materials.map(row => row.id === id ? returned : row));
}

export async function commitSupabaseDelete(
  database: MasterDatabase,
  id: string,
  write: (id: string) => Promise<string>,
): Promise<MasterDatabase> {
  if (!id.trim()) throw new Error('Supabase 刪除材料失敗：缺少材料 id。');
  if (!database.materials.some(row => row.id === id)) throw new Error('材料不存在或目前帳號沒有刪除權限。');
  // The local schema refuses an empty material list. Refuse before the remote delete.
  if (database.materials.length < 2) throw new Error('至少需要保留一筆材料，因此尚未刪除。');
  const returned = await write(id);
  if (returned !== id) throw new Error('Supabase 刪除材料失敗：回傳的刪除結果不正確。');
  return databaseWithMaterials(database, database.materials.filter(row => row.id !== id));
}

export function createWriteLock() {
  let pending = false;
  return {
    get pending() { return pending; },
    async exclusive<T>(run: () => Promise<T>): Promise<T> {
      if (pending) throw new Error(SUPABASE_WRITE_IN_PROGRESS);
      pending = true;
      try {
        return await run();
      } finally {
        pending = false;
      }
    },
  };
}
