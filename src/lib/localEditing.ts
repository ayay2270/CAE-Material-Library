/** Visible production controls offer guidance; only a ready local editor can run the action. */
export function requestLocalEditing(editable: boolean, action: () => void, showGuidance: () => void): void {
  if (editable) action();
  else showGuidance();
}

export const LOCAL_EDITING_HINT = '請先連結本機資料庫';
export const SUPABASE_WRITE_LATER = 'Supabase 目前為唯讀模式；寫入功能將於下一階段開放。';

/** Supabase stays read-only. Legacy and example mode keep the existing local-editor gate. */
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
