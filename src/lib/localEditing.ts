/** Visible production controls offer guidance; only a ready local editor can run the action. */
export function requestLocalEditing(editable: boolean, action: () => void, showGuidance: () => void): void {
  if (editable) action();
  else showGuidance();
}

export const LOCAL_EDITING_HINT = '請先連結本機資料庫';
export const SUPABASE_WRITE_LATER = '此功能在 Supabase 模式目前為唯讀，尚未開放寫入。';

/** Deferred Supabase writes stay closed. Material add, edit, and delete use a separate gate. */
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
 * Curve writes stay closed in the UI.
 * Legacy/example follows storage `editable`. Supabase follows confirmed Admin only.
 */
export function curveWriteEnabledFor(
  dataSource: 'supabase' | 'legacy',
  legacyEditable: boolean,
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' ? supabaseAdmin : legacyEditable;
}

/**
 * Category and source management stay closed in the UI.
 * Legacy/example follows storage `editable`. Supabase follows confirmed Admin only.
 */
export function indexWriteEnabledFor(
  dataSource: 'supabase' | 'legacy',
  legacyEditable: boolean,
  supabaseAdmin: boolean,
): boolean {
  return dataSource === 'supabase' ? supabaseAdmin : legacyEditable;
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
