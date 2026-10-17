/** Visible production controls offer guidance; only a ready local editor can run the action. */
export function requestLocalEditing(editable: boolean, action: () => void, showGuidance: () => void): void {
  if (editable) action();
  else showGuidance();
}

export const LOCAL_EDITING_HINT = '請先連結本機資料庫';
export const SUPABASE_WRITE_LATER = '此功能在 Supabase 模式目前為唯讀，尚未開放寫入。';

/** CSV, JSON, and other deferred Supabase writes stay closed. Material, curve, and index writes use their own gates. */
export function requestMaterialMutation(
  dataSource: 'supabase' | 'legacy',
  editable: boolean,
  action: () => void,
  showLocalGuidance: () => void,
  showSupabaseReadOnly: () => void,
): void {
  if (dataSource === 'supabase') {
    showSupabaseReadOnly();
    return;
  }
  requestLocalEditing(editable, action, showLocalGuidance);
}

export const SUPABASE_MATERIAL_CRUD_DENIED = '目前帳號沒有材料寫入權限。';

/**
 * Legacy/example keeps storage `editable`.
 * Supabase material add/edit/delete follows confirmed Admin only.
 */
export function materialCrudEnabledFor(
  dataSource: 'supabase' | 'legacy',
  legacyEditable: boolean,
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' ? supabaseAdmin : legacyEditable;
}

/**
 * Legacy/example follows storage `editable`.
 * Supabase curve writes follow confirmed Admin only.
 */
export function curveWriteEnabledFor(
  dataSource: 'supabase' | 'legacy',
  legacyEditable: boolean,
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' ? supabaseAdmin : legacyEditable;
}

/**
 * Legacy/example follows storage `editable`.
 * Supabase category and source add/rename follow confirmed Admin only.
 */
export function indexWriteEnabledFor(
  dataSource: 'supabase' | 'legacy',
  legacyEditable: boolean,
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' ? supabaseAdmin : legacyEditable;
}

/** The source filter follows a successful rename only when it is selecting that source. */
export function renamedSourceFilter(active: string, oldName: string, newName: string): string | null {
  if (active !== oldName) return null;
  return newName.trim();
}

export interface SupabaseIndexMutations {
  addCategory(name: string): Promise<unknown>;
  renameCategory(id: string, name: string): Promise<unknown>;
  addSource(name: string): Promise<unknown>;
  renameSource(oldName: string, newName: string): Promise<unknown>;
}

export interface IndexWriteResult {
  message: string | null;
  notice: string | null;
  sourceFilter: string | null;
}

/** A source rename already committed remotely. The caller must rethrow it and must not retry. */
export function isRemoteCommittedError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { remoteCommitted?: boolean }).remoteCommitted === true;
}

export function supabaseIndexNotice(kind: 'category' | 'source', id: string | null, name: string): string {
  const label = name.trim();
  if (kind === 'category') return id === null ? `已新增 Supabase 分類：${label}。` : `已更新 Supabase 分類名稱：${label}。`;
  return id === null ? `已新增 Supabase 來源：${label}。` : `已更新 Supabase 來源：${label}。`;
}

/**
 * Supabase category/source add and rename.
 * Reads the active source filter only after a source rename resolves.
 * A remote-committed error is rethrown unchanged.
 */
export async function commitSupabaseIndexWrite(input: {
  stale: boolean;
  kind: 'category' | 'source';
  id: string | null;
  name: string;
  readActiveSource: () => string;
  mutations: SupabaseIndexMutations | null;
}): Promise<IndexWriteResult> {
  if (input.stale) return { message: '索引狀態無法確認，請重新整理頁面。', notice: null, sourceFilter: null };
  if (!input.mutations) return { message: 'Supabase 索引寫入未啟用。', notice: null, sourceFilter: null };
  const { kind, id, name, mutations } = input;
  try {
    if (kind === 'category') {
      if (id === null) await mutations.addCategory(name);
      else await mutations.renameCategory(id, name);
    } else if (id === null) {
      await mutations.addSource(name);
    } else {
      await mutations.renameSource(id, name);
    }
    return {
      message: null,
      notice: supabaseIndexNotice(kind, id, name),
      sourceFilter: kind === 'source' && id !== null ? renamedSourceFilter(input.readActiveSource(), id, name) : null,
    };
  } catch (error) {
    if (isRemoteCommittedError(error)) throw error;
    return {
      message: error instanceof Error && error.message ? error.message : '索引儲存失敗。',
      notice: null,
      sourceFilter: null,
    };
  }
}

/** Add, edit, and delete. This gate does not open index, curve, CSV, or Save Database. */
export function requestMaterialCrud(
  materialCrudEnabled: boolean,
  dataSource: 'supabase' | 'legacy',
  action: () => void,
  showLocalGuidance: () => void,
  showSupabaseDenied: () => void,
): void {
  if (materialCrudEnabled) {
    action();
    return;
  }
  if (dataSource === 'supabase') {
    showSupabaseDenied();
    return;
  }
  requestLocalEditing(false, action, showLocalGuidance);
}

/** Close a Supabase add/edit/delete dialog when Admin capability is no longer confirmed. */
export function supabaseCrudDialogsShouldClose(
  dataSource: 'supabase' | 'legacy',
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' && !supabaseAdmin;
}

export function supabaseCommittedNotice(kind: 'add' | 'edit' | 'delete', name: string): string {
  if (kind === 'delete') return `已從 Supabase 刪除 ${name}。`;
  if (kind === 'edit') return `已更新 Supabase 材料 ${name}。`;
  return `已新增 Supabase 材料 ${name}。`;
}

/** Close the form or delete dialog only after the direct write resolves. */
export async function closeAfterDirectWrite(write: () => Promise<void>, close: () => void): Promise<void> {
  await write();
  close();
}
