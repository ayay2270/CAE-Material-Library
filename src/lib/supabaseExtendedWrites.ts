import type { Material, StressStrainData } from '../types';
import { isStressStrainData } from './curveData';
import { createMaterialLibraryClient } from './supabaseClient';
import { mapMaterialRow, type CategoryRow, type MaterialRow, type SourceRow } from './supabaseDatabase';

/** Narrow RPC client used by tests. The runtime default is the existing singleton. */
export interface SupabaseRpcClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface SourceRenameResult {
  oldName: string;
  newName: string;
  affectedCount: number;
}

export const SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED = '來源已在 Supabase 更新，但本機狀態無法確認；請重新整理頁面確認最新資料。';

/**
 * The rename RPC returned without an error, so PostgreSQL has committed.
 * The local catalog was not updated. Reload instead of retrying the RPC.
 */
export class SupabaseSourceRenameRemoteCommittedError extends Error {
  readonly remoteCommitted = true;

  constructor() {
    super(SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED);
    this.name = 'SupabaseSourceRenameRemoteCommittedError';
  }
}

function runtimeClient(): SupabaseRpcClient {
  const client = createMaterialLibraryClient();
  return {
    rpc(fn, args) {
      return client.rpc(fn, args);
    },
  };
}

/** Same credential redaction as material CRUD writes. Server text is never shown raw. */
function detail(message: string): string {
  return message
    .replace(/bearer\s+\S+/gi, '[redacted]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[redacted]');
}

function fail(label: string, message: string): Error {
  return new Error(`${label}${detail(message)}`);
}

function oneRow(data: unknown, label: string): Record<string, unknown> {
  if (!Array.isArray(data) || data.length === 0) throw fail(label, '沒有回傳寫入後的資料。');
  if (data.length !== 1) throw fail(label, '回傳資料列數量不正確。');
  const row = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw fail(label, '回傳資料列不正確。');
  return row as Record<string, unknown>;
}

function categoryRow(data: unknown, label: string): CategoryRow {
  const row = oneRow(data, label);
  if (typeof row.id !== 'string' || !row.id || typeof row.label !== 'string' || typeof row.color !== 'string') {
    throw fail(label, '回傳的分類資料不正確。');
  }
  return { id: row.id, label: row.label, color: row.color };
}

async function callRpc(client: SupabaseRpcClient | undefined, fn: string, args: Record<string, unknown>, label: string) {
  try {
    const result = await (client ?? runtimeClient()).rpc(fn, args);
    if (result.error) throw fail(label, result.error.message);
    return result.data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) throw error;
    const message = error instanceof Error ? error.message : '未知錯誤';
    throw fail(label, message);
  }
}

export async function updateSupabaseMaterialCurve(
  id: string,
  curve: StressStrainData,
  client?: SupabaseRpcClient,
): Promise<Material> {
  const label = 'Supabase 更新曲線失敗：';
  if (!id.trim()) throw fail(label, '缺少材料 id。');
  if (!isStressStrainData(curve)) throw fail(label, '曲線資料不正確。');
  const data = await callRpc(client, 'update_material_curve', {
    p_material_id: id,
    p_curve: curve,
  }, label);
  if (!Array.isArray(data) || data.length === 0) throw fail(label, '沒有回傳寫入後的材料。');
  if (data.length !== 1) throw fail(label, '回傳資料列數量不正確。');
  const material = mapMaterialRow(data[0] as MaterialRow);
  if (material.id !== id) throw fail(label, '回傳的材料 id 不正確。');
  return material;
}

export async function addSupabaseCategory(name: string, client?: SupabaseRpcClient): Promise<CategoryRow> {
  const label = 'Supabase 新增分類失敗：';
  if (!name.trim()) throw fail(label, '缺少分類名稱。');
  const data = await callRpc(client, 'add_material_category', { p_name: name }, label);
  return categoryRow(data, label);
}

export async function renameSupabaseCategoryLabel(
  id: string,
  label: string,
  client?: SupabaseRpcClient,
): Promise<CategoryRow> {
  const errorLabel = 'Supabase 重新命名分類失敗：';
  if (!id.trim()) throw fail(errorLabel, '缺少分類 id。');
  const data = await callRpc(client, 'rename_material_category_label', { p_id: id, p_label: label }, errorLabel);
  const row = categoryRow(data, errorLabel);
  if (row.id !== id) throw fail(errorLabel, '回傳的分類 id 與要求不一致。');
  return row;
}

export async function addSupabaseSource(name: string, client?: SupabaseRpcClient): Promise<SourceRow> {
  const label = 'Supabase 新增來源失敗：';
  if (!name.trim()) throw fail(label, '缺少來源名稱。');
  const data = await callRpc(client, 'add_material_source', { p_name: name }, label);
  const row = oneRow(data, label);
  if (typeof row.name !== 'string' || !row.name) throw fail(label, '回傳的來源資料不正確。');
  return { name: row.name };
}

function committedSourceCount(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^[0-9]+$/.test(value)
      ? Number(value)
      : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new SupabaseSourceRenameRemoteCommittedError();
  return parsed;
}

export async function renameSupabaseSource(
  oldName: string,
  newName: string,
  client?: SupabaseRpcClient,
): Promise<SourceRenameResult> {
  const label = 'Supabase 重新命名來源失敗：';
  if (!oldName.trim() || !newName.trim()) throw fail(label, '缺少來源名稱。');
  let data: unknown;
  try {
    const result = await (client ?? runtimeClient()).rpc('rename_material_source', {
      p_old_name: oldName,
      p_new_name: newName,
    });
    if (result.error) throw fail(label, result.error.message);
    data = result.data;
  } catch (error) {
    if (error instanceof SupabaseSourceRenameRemoteCommittedError) throw error;
    if (error instanceof Error && error.message.startsWith(label)) throw error;
    const message = error instanceof Error ? error.message : '未知錯誤';
    throw fail(label, message);
  }
  // error == null means the remote transaction has committed. Do not retry.
  if (!Array.isArray(data) || data.length !== 1) throw new SupabaseSourceRenameRemoteCommittedError();
  const row = data[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new SupabaseSourceRenameRemoteCommittedError();
  const record = row as Record<string, unknown>;
  if (typeof record.old_name !== 'string' || typeof record.new_name !== 'string') {
    throw new SupabaseSourceRenameRemoteCommittedError();
  }
  return {
    oldName: record.old_name,
    newName: record.new_name,
    affectedCount: committedSourceCount(record.affected_count),
  };
}
