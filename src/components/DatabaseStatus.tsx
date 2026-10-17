import type { useMaterials } from '../lib/storage';
import { SYNC_LABELS } from '../lib/githubSync';
import { UNSUPPORTED_MESSAGE } from '../lib/browserDatabase';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { downloadDeployedDatabase } from '../lib/deployedDatabaseDownload';
import { DatabaseOnboardingDialog } from './DatabaseOnboardingDialog';
import { EXAMPLE_QUERY } from '../lib/orthotropicExample';
import { SupabaseAuthDialog } from './SupabaseAuthDialog';
import type { MaterialAuthSnapshot } from '../lib/supabaseAuth';
import type { MaterialLibraryAuthController } from '../lib/useMaterialAuth';

type State = ReturnType<typeof useMaterials>;
const clock = (value: number | null) => value === null ? '' : new Date(value).toLocaleTimeString('zh-TW', { hour12: false });

// The comparison stays in the true branch so a non-supabase literal drops the auth UI.
const supabaseAuthEnabled = import.meta.env
  ? import.meta.env.VITE_MATERIAL_DATA_SOURCE === 'supabase'
  : false;
const AuthDialog = supabaseAuthEnabled ? SupabaseAuthDialog : null;
const ADMIN_STATUS_UNCONFIRMED = '無法確認 Admin 身分，目前維持唯讀。';
export function DatabaseStatus({ state, auth = null }: { state: State; auth?: MaterialLibraryAuthController | null }) {
  const { fileStatus, fileSupported, developerMode, fileError, fileName, editable, dirty, saving, saveError,
    connectFile, reloadFile, disconnectFile, lastReadAt, lastSavedAt, backupText, github, saveDatabase } = state;
  const linked = fileStatus === 'linked';
  const showOnboarding = !linked && !developerMode;
  const [helpOpen, setHelpOpen] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if ((fileError || saveError) && menu.current) menu.current.open = true; }, [fileError, saveError]);
  const label = fileStatus === 'checking' ? '連結中' : linked ? '已連結' : fileStatus === 'permission' ? '需要重新授權' : developerMode ? '本機開發模式' : '尚未連結';
  const downloadBackup = () => {
    if (!backupText) return;
    const url = URL.createObjectURL(new Blob([backupText], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'materials-before-save.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openHelp = () => { if (menu.current) menu.current.open = false; setHelpOpen(true); };
  if (state.exampleMode) return <div className="database-status">
    <span role="status">獨立範例 · {saveError ? '儲存失敗' : dirty ? '有未儲存變更' : lastSavedAt ? '已儲存在此分頁' : '僅此分頁'}</span>
    <button className="btn" disabled={!dirty || saving} onClick={() => void saveDatabase()}>儲存範例</button>
  </div>;
  if (state.dataSource === 'supabase') return <SupabaseDatabaseStatus state={state} auth={auth} />;
  return <><div className="database-status">
    <details className="database-status-menu" ref={menu} open={showOnboarding}>
      <summary>資料庫狀態 · {saving ? '儲存並驗證中' : saveError ? '儲存失敗' : dirty ? '有未儲存變更' : lastSavedAt ? '儲存成功' : label}</summary>
      <div className="database-status-panel" role="region" aria-label="資料庫狀態">
        <h3>資料庫狀態</h3>
        {showOnboarding ? <section className="database-onboarding-intro" aria-label="首次資料庫連結">
          <p className="database-unlinked">○ 尚未連結本機資料庫</p>
          <h4>第一次使用？</h4>
          <div className="database-onboarding-actions">
            <button className="btn" onClick={downloadDeployedDatabase}>下載目前材料資料庫 JSON</button>
            <button className="btn primary" disabled={!fileSupported || fileStatus === 'checking' || saving} onClick={() => void connectFile()}>{fileStatus === 'permission' ? '重新授權本機資料庫' : '連結本機資料庫'}</button>
          </div>
          <p>若只需要查看或備份資料，可直接下載目前線上資料庫。</p>
          <p><a href={`?${EXAMPLE_QUERY}`}>開啟 FR4 Orthotropic 獨立範例</a>，免選檔即可試用新增、編輯與比較。</p>
          <p>若要新增、編輯並上傳到 GitHub，請先把專案複製到電腦，再連結專案中的：<code className="database-file-path">src/data/materials.json</code>第一次設定請查看下方步驟。</p>
          <p className="muted small">下載的 JSON 是獨立備份，不會建立 Git 儲存庫，也不會自動 Commit / Push。</p>
        </section> : <dl>
          <dt>本機資料庫</dt><dd><b>{linked ? '✓ 已連結' : label}</b>{fileName && <span>{fileName}</span>}{lastReadAt && <small>最後讀取：{clock(lastReadAt)}</small>}</dd>
          <dt>本機儲存</dt><dd role="status">{saving ? '儲存並驗證中…' : saveError ? '✕ 儲存失敗' : dirty ? '● 有未儲存變更' : lastSavedAt ? '✓ 儲存成功' : editable ? '✓ 已儲存' : '尚未連結'}{lastSavedAt && <small>{clock(lastSavedAt)}</small>}</dd>
          <dt>GitHub 同步</dt><dd role="status">{github.status === 'synced' ? '✓ ' : '● '}{SYNC_LABELS[github.status]}{github.status === 'synced' && dirty && <small>僅代表上次儲存版本；草稿尚未儲存。</small>}{github.commit && <small>Commit {github.commit.slice(0, 7)}</small>}{github.checkedAt && <small>檢查時間：{clock(github.checkedAt)}</small>}</dd>
          {github.status === 'synced' && <><dt>GitHub Pages</dt><dd>{github.deployment === 'updated' ? '✓ 線上版已更新（資料庫一致）' : github.deployment === 'waiting' ? '● 等待部署' : '暫時無法確認部署'}</dd></>}
        </dl>}
        {(github.status === 'pending' || github.status === 'changed') && <p>{github.status === 'changed' && <b>GitHub 資料與本機不同。 </b>}請使用 GitHub Desktop Commit + Push；若他人已更新資料，請先確認差異，不會自動覆寫任何一方。</p>}
        {github.error && <p role="alert">{github.error}</p>}
        {!fileSupported && <p>{UNSUPPORTED_MESSAGE}</p>}
        {fileStatus === 'permission' && <p>需要重新授權本機資料庫。</p>}
        {fileError && <p role="alert">{fileError}</p>}
        {saveError && <p role="alert">{saveError} 草稿仍保留，可匯出完整 JSON 備份。</p>}
        {(linked || developerMode) && <button className="btn" disabled={github.status === 'checking' || saving} onClick={github.check}>檢查 GitHub 同步</button>}
        {(linked || fileStatus === 'permission') && <div className="database-file-actions">
          {linked && <button className="btn" disabled={dirty || saving} onClick={() => void reloadFile()}>重新讀取本機資料庫</button>}
          {fileStatus === 'permission' && <button className="btn" disabled={dirty || saving} onClick={() => void connectFile(true)}>重新選取檔案</button>}
          <button className="btn" disabled={dirty || saving} onClick={() => void disconnectFile()}>中斷連結</button>
        </div>}
        {backupText && <button className="btn" onClick={downloadBackup}>下載寫入前備份</button>}
        <button className="database-help-link" onClick={openHelp}>{showOnboarding ? '第一次使用？查看設定步驟' : '使用說明'}</button>
        {!showOnboarding && <p className="muted small">網站只更新你電腦裡的 materials.json；上傳到 GitHub 仍需在 GitHub Desktop Commit，再 Push origin。</p>}
      </div>
    </details>
    {(!linked && fileSupported && !showOnboarding) && <button className="btn" disabled={fileStatus === 'checking' || saving} onClick={() => void connectFile()}>{fileStatus === 'permission' ? '重新授權' : '連結本機資料庫'}</button>}
    {editable && <button className="btn" disabled={!dirty || saving} onClick={() => void saveDatabase()}>Save Database</button>}
  </div>{helpOpen && <DatabaseOnboardingDialog supported={fileSupported} onClose={() => setHelpOpen(false)} onConnect={() => { setHelpOpen(false); void connectFile(); }} />}</>;
}

function supabaseSourceLabel(state: State): string {
  if (state.supabaseStatus === 'ready') return '資料來源 · Supabase（唯讀）';
  if (state.supabaseStatus === 'error') return '資料來源 · Supabase（讀取失敗）';
  return '資料來源 · Supabase（讀取中）';
}

function SupabaseDatabaseStatus({ state, auth }: { state: State; auth: MaterialLibraryAuthController | null }) {
  const label = supabaseSourceLabel(state);
  const readError = state.supabaseStatus === 'error' && state.supabaseError
    ? <span role="alert">{state.supabaseError}</span>
    : null;
  if (!AuthDialog || !auth) {
    return <div className="database-status">
      <span role="status">{label}</span>
      {readError}
    </div>;
  }
  return <SupabaseAuthStatus label={label} readError={readError} auth={auth} />;
}

function SupabaseAuthStatus({
  label,
  readError,
  auth,
}: {
  label: string;
  readError: ReactNode;
  auth: MaterialLibraryAuthController;
}) {
  const [loginOpen, setLoginOpen] = useState(false);
  const Dialog = AuthDialog;
  const signOut = () => { auth.signOut(); };
  return <div className="database-status">
    <span role="status">{label}</span>
    {readError}
    <SupabaseAuthControls snapshot={auth.snapshot} onLogin={() => setLoginOpen(true)} onSignOut={signOut} />
    {loginOpen && Dialog ? <Dialog onClose={() => setLoginOpen(false)} onSignIn={(email, password) => auth.signIn(email, password)} /> : null}
  </div>;
}

function SupabaseAuthControls({
  snapshot,
  onLogin,
  onSignOut,
}: {
  snapshot: MaterialAuthSnapshot;
  onLogin: () => void;
  onSignOut: () => void;
}) {
  if (snapshot.status === 'checking') return <span className="database-auth" role="status">身分確認中…</span>;
  if (snapshot.status === 'admin') {
    return <span className="database-auth">
      <span role="status">Admin · {snapshot.email ?? '已登入'}</span>
      <button className="btn" type="button" onClick={onSignOut}>登出</button>
    </span>;
  }
  if (snapshot.status === 'non_admin') {
    return <span className="database-auth">
      <span role="status">已登入 · {snapshot.email ?? '已登入'}</span>
      <span>非 Admin</span>
      <button className="btn" type="button" onClick={onSignOut}>登出</button>
    </span>;
  }
  if (snapshot.status === 'error') {
    return <span className="database-auth">
      {snapshot.email ? <span role="status">已登入 · {snapshot.email}</span> : null}
      <span>非 Admin</span>
      <span className="database-auth-alert" role="alert">{snapshot.message ?? ADMIN_STATUS_UNCONFIRMED}</span>
      {snapshot.email
        ? <button className="btn" type="button" onClick={onSignOut}>登出</button>
        : <button className="btn" type="button" onClick={onLogin}>Admin 登入</button>}
    </span>;
  }
  return <button className="btn" type="button" onClick={onLogin}>Admin 登入</button>;
}
