import { useRef, useState } from 'react';
import type { Material, MaterialInput } from '../types';
import { csvToMaterials, downloadCsv } from '../lib/csv';
import { Modal } from './Modal';
import { DownloadIcon, UploadIcon } from './icons';
import { downloadJson } from '../lib/legacy';
import type { MasterDatabase } from '../lib/database-schema.mjs';
import { parseFileDatabase } from '../lib/browserDatabase';
import { requestLocalEditing } from '../lib/localEditing';

export function ConfirmDelete({ material, onConfirm, onClose }: { material: Material; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title="刪除材料？"
      width={440}
      onClose={onClose}
      footer={
        <>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn danger" onClick={onConfirm}>刪除</button>
        </>
      }
    >
      <p>
        <b>{material.name}</b> 及其歷史記錄將從目前草稿移除。按 Save Database 才會寫入 Git 主資料庫；寫入前可取消未儲存變更。
      </p>
    </Modal>
  );
}

export function ImportExportDialog({
  materials,
  visibleRows,
  onImport,
  onReset,
  onClose,
  editable,
  database,
  onRecover,
  onLegacy,
  onReadOnly,
  dirty = false,
}: {
  materials: Material[];
  visibleRows: Material[];
  onImport: (rows: MaterialInput[]) => { added: number; updated: number; unchanged: number };
  onReset: () => void;
  onClose: () => void;
  editable: boolean;
  database: MasterDatabase;
  onRecover: (value: unknown) => void;
  onLegacy: () => void;
  onReadOnly: () => void;
  dirty?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const recoveryRef = useRef<HTMLInputElement>(null);
  const [pendingRecovery, setPendingRecovery] = useState<unknown>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string; details?: string[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file || !editable) return;
    try {
    const text = await file.text();
    const { rows, errors } = csvToMaterials(text);
    if (rows.length === 0) {
      setMessage({ kind: 'err', text: '未匯入任何資料。', details: errors });
      return;
    }
    const r = onImport(rows);
    setMessage({
      kind: 'ok',
      text: `已匯入草稿 ${rows.length} 列：新增 ${r.added} 筆、更新 ${r.updated} 筆、未變更 ${r.unchanged} 筆（以 Material Name 比對）。請按 Save Database 寫入資料庫。`,
      details: errors,
    });
    if (fileRef.current) fileRef.current.value = '';
    } catch (error) { setMessage({ kind: 'err', text: error instanceof Error ? error.message : '無法讀取檔案。' }); }
  };

  return (
    <Modal title="匯入 / 匯出" width={540} onClose={onClose}>
      <section className="io-block">
        <h3>匯出</h3>
        <p className="muted">下載 CSV（儲存單位：t/mm³、MPa、%）。</p>
        <div className="io-actions">
          <button className="btn" onClick={() => downloadCsv(materials)}>
            <DownloadIcon /> 匯出全部（{materials.length} 筆）
          </button>
          <button className="btn" onClick={() => downloadJson(database, 'material-database.json')}>下載完整 JSON 備份</button>
          <button className="btn" onClick={() => downloadCsv(visibleRows, 'cae-materials-filtered.csv')} disabled={visibleRows.length === materials.length}>
            <DownloadIcon /> 匯出目前列表（{visibleRows.length} 筆）
          </button>
        </div>
      </section>
      <section className="io-block">
        <h3>匯入</h3>
        <p className="muted">
          請使用本工具匯出的檔案格式（欄位：Name、Category、各性質欄位、Source、Notes）。名稱相同的列會更新該材料，其餘新增；空白欄位維持「—」。
        </p>
        {editable && <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-input" onChange={(e) => onFile(e.target.files?.[0])} />}
        <button className="btn" title={editable ? '匯入 CSV' : '請先連結本機資料庫'} onClick={() => requestLocalEditing(editable, () => fileRef.current?.click(), onReadOnly)}>
          <UploadIcon /> 選擇 CSV 檔案…
        </button>
        {editable && <>
        {message && (
          <div className={`notice ${message.kind}`} role="status">
            {message.text}
            {message.details && message.details.length > 0 && (
              <ul>
                {message.details.slice(0, 6).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {message.details.length > 6 && <li>…另有 {message.details.length - 6} 則</li>}
              </ul>
            )}
          </div>
        )}
        <p className="muted small">變更先保留在記憶體中，請按頁首 Save Database。</p>
        <input ref={recoveryRef} type="file" hidden accept=".json,application/json" onChange={async e => {
          const file = e.target.files?.[0]; if (!file) return;
          try { setPendingRecovery(parseFileDatabase(await file.text())); }
          catch (error) { setPendingRecovery(null); setMessage({ kind: 'err', text: error instanceof Error ? error.message : 'JSON 檔案無法解析，未回復。' }); }
          e.target.value = '';
        }} />
        <button className="btn" onClick={() => recoveryRef.current?.click()}>匯入完整 JSON 備份…</button>
        {pendingRecovery !== null && <p>JSON 回復將取代目前草稿（包含 ID、歷史、曲線與索引）。<button className="btn danger" onClick={() => {
          try { onRecover(pendingRecovery); setPendingRecovery(null); setMessage({ kind: 'ok', text: '已回復為草稿，請按 Save Database。' }); }
          catch (error) { setMessage({ kind: 'err', text: error instanceof Error ? error.message : '資料無效，未回復。' }); }
        }}>確認回復草稿</button> <button className="btn" onClick={() => setPendingRecovery(null)}>取消</button></p>}
        </>}
      </section>
      {!editable && <p className="muted">請先連結本機 src/data/materials.json，即可匯入資料。未連結時可瀏覽及匯出資料。</p>}
      {(editable || dirty) && <section className="io-block">
        <h3>未儲存草稿</h3>
        <p className="muted">取消未儲存變更，回到本次載入或最後成功 Save Database 的資料（包含分類／SOURCE）。</p>
        {confirmReset ? (
          <span className="inline-confirm">
            確定取消未儲存草稿？{' '}
            <button
              className="btn danger"
              onClick={() => {
                onReset();
                setConfirmReset(false);
                setMessage({ kind: 'ok', text: '已取消未儲存變更。' });
              }}
            >
              確定取代
            </button>{' '}
            <button className="btn" onClick={() => setConfirmReset(false)}>取消</button>
          </span>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>取消未儲存變更…</button>
        )}
      </section>}
      <section className="io-block"><button className="btn" onClick={onLegacy}>檢查舊瀏覽器資料</button></section>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="使用說明" width={520} onClose={onClose}>
      <ul className="help-list">
        <li><b>尋找材料</b>：用上方搜尋列（名稱、關鍵字、來源），或以「材料類別 / 來源 / 更新時間」篩選；點欄位標題可排序。</li>
        <li><b>查看資料</b>：點選任一列開啟詳細資料（基本性質、材料曲線、來源與備註、歷史記錄）；連結本機資料庫後即可編輯與刪除。</li>
        <li><b>欄位設定</b>：拖曳（或用 ▲▼ 按鈕）調整欄位順序，取消勾選即可隱藏；Material Name 固定顯示。設定會儲存在此瀏覽器。</li>
        <li><b>缺少的數值</b>顯示為「—」，不會當作 0。</li>
        <li><b>比較材料</b>：勾選 2 個以上材料，按「比較材料」，數量不限。</li>
        <li><b>材料地圖</b>：Density × Young's Modulus 的輔助圖，點選 ⓘ 了解如何閱讀。</li>
        <li><b>資料儲存</b>：Git 追蹤的 src/data/materials.json 是主資料庫。使用 Chrome 或 Edge「連結本機資料庫」並授權後，編輯先保留為記憶體草稿，按 Save Database 寫入檔案，再到 GitHub Desktop Commit + Push。網站只讀取 GitHub 資料確認同步，不會推送。IndexedDB 只記住檔案控制代碼，localStorage 只保存欄位偏好與舊資料通知已讀狀態。</li>
        <li><b>快捷鍵</b>：按 <kbd>/</kbd> 跳到搜尋列。</li>
      </ul>
      <p className="muted small">
        頁首背景：<a href="https://commons.wikimedia.org/wiki/File:Lake_Tohoe_Panoramic_Kia.JPG" target="_blank" rel="noopener noreferrer">Lake Tahoe 全景</a>
        {' '}by K0ur0sh（Public Domain）。實拍照片，顯示時裁切並加上漸層。
      </p>
    </Modal>
  );
}

export function MapInfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="如何閱讀這張圖？" width={540} onClose={onClose}>
      <p>
        <b>X 軸：Density ρ（密度）</b>，越靠左代表材料密度越低、越輕。
      </p>
      <p>
        <b>Y 軸：Young's Modulus E（楊氏模數）</b>，越靠上代表材料本身的彈性剛性越高。
      </p>
      <p>
        因此，越靠近<b>左上角</b>的材料，具有較低密度與較高材料剛性的組合。
      </p>
      <svg viewBox="0 0 320 160" className="info-diagram" role="img" aria-label="左上角代表輕量且高剛性">
        <rect x="64" y="14" width="96" height="58" className="ideal-zone" />
        <text x="112" y="38" textAnchor="middle" className="ideal-text">輕量 + 高剛性</text>
        <text x="112" y="55" textAnchor="middle" className="ideal-sub">（理想區域）</text>
        <line x1="160" y1="8" x2="160" y2="152" className="axis" />
        <line x1="20" y1="80" x2="304" y2="80" className="axis" />
        <text x="164" y="14" className="tick">E 高（較剛性）</text>
        <text x="164" y="150" className="tick">E 低（較不剛性）</text>
        <text x="24" y="96" className="tick">ρ 低（較輕）</text>
        <text x="300" y="96" textAnchor="end" className="tick">ρ 高（較重）</text>
      </svg>
      <div className="note">
        <span className="note-glyph" aria-hidden="true">i</span>
        <div>
          <b>工程注意事項</b>
          <p>
            Young's Modulus 描述的是材料本身的彈性剛性，不等同於零件或最終結構的整體剛性。實際結構行為仍會受到厚度、截面幾何、邊界條件與載重等因素影響。
          </p>
        </div>
      </div>
    </Modal>
  );
}
