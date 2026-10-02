import { useRef, useState } from 'react';
import type { Material, MaterialInput } from '../types';
import { csvToMaterials, downloadCsv } from '../lib/csv';
import { Modal } from './Modal';
import { DownloadIcon, UploadIcon } from './icons';

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
        <b>{material.name}</b> 及其歷史記錄將從此瀏覽器的材料庫中永久移除。如日後可能需要，請先匯出 CSV 備份。
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
}: {
  materials: Material[];
  visibleRows: Material[];
  onImport: (rows: MaterialInput[]) => { added: number; updated: number; unchanged: number };
  onReset: () => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string; details?: string[] } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { rows, errors } = csvToMaterials(text);
    if (rows.length === 0) {
      setMessage({ kind: 'err', text: '未匯入任何資料。', details: errors });
      return;
    }
    const r = onImport(rows);
    setMessage({
      kind: 'ok',
      text: `已匯入 ${rows.length} 列：新增 ${r.added} 筆、更新 ${r.updated} 筆、未變更 ${r.unchanged} 筆（以 Material Name 比對）。`,
      details: errors,
    });
    if (fileRef.current) fileRef.current.value = '';
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
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden data-testid="csv-input" onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> 選擇 CSV 檔案…
        </button>
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
      </section>
      <section className="io-block">
        <h3>範例資料</h3>
        <p className="muted">還原 11 筆範例材料。此動作會取代此瀏覽器中目前儲存的所有資料。</p>
        {confirmReset ? (
          <span className="inline-confirm">
            確定取代所有資料？{' '}
            <button
              className="btn danger"
              onClick={() => {
                onReset();
                setConfirmReset(false);
                setMessage({ kind: 'ok', text: '已還原範例資料。' });
              }}
            >
              確定取代
            </button>{' '}
            <button className="btn" onClick={() => setConfirmReset(false)}>取消</button>
          </span>
        ) : (
          <button className="btn" onClick={() => setConfirmReset(true)}>還原範例資料…</button>
        )}
      </section>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="使用說明" width={520} onClose={onClose}>
      <ul className="help-list">
        <li><b>尋找材料</b>：用上方搜尋列（名稱、關鍵字、來源），或以「材料類別 / 來源 / 更新時間」篩選；點欄位標題可排序。</li>
        <li><b>查看資料</b>：點選任一列開啟詳細資料（基本性質、材料曲線、來源與備註、歷史記錄），可在其中編輯或刪除。</li>
        <li><b>欄位設定</b>：拖曳（或用 ▲▼ 按鈕）調整欄位順序，取消勾選即可隱藏；Material Name 固定顯示。設定會儲存在此瀏覽器。</li>
        <li><b>缺少的數值</b>顯示為「—」，不會當作 0。</li>
        <li><b>比較材料</b>：勾選 2 個以上材料，按「比較材料」，數量不限。</li>
        <li><b>材料地圖</b>：Density × Young's Modulus 的輔助圖，點選 ⓘ 了解如何閱讀。</li>
        <li><b>資料儲存</b>：資料保存在此瀏覽器的 localStorage，請定期匯出 CSV 備份；清除網站資料會一併移除。</li>
        <li><b>快捷鍵</b>：按 <kbd>/</kbd> 跳到搜尋列。</li>
      </ul>
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
