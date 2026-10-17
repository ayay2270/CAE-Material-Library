import { useEffect, useMemo, useRef, useState } from 'react';
import type { Material, StressStrainData } from '../types';
import type { UnitPrefs } from '../lib/format';
import {
  CURVE_DEFINITIONS,
  STRAIN_KINDS,
  downloadCurve,
  isStressStrainData,
  parseCurvePoints,
  type StrainUnit,
  type StressUnit,
} from '../lib/curveData';
import { FullStressStrainPlot } from './FullStressStrainPlot';
import { StressStrainCurve } from './StressStrainCurve';
import { UploadIcon, DownloadIcon, EditIcon, PlusIcon, TrashIcon } from './icons';

export function StressStrainSection({
  material,
  units,
  onSave,
  onDelete,
  editable,
  pending = false,
}: {
  material: Material;
  units: UnitPrefs;
  onSave: (data: StressStrainData) => string | null | Promise<string | null>;
  /** Removes only the stored full curve. Absent callers keep the previous read-only curve view. */
  onDelete?: () => string | null | Promise<string | null>;
  editable: boolean;
  /** Another shared Supabase write is already in flight. */
  pending?: boolean;
}) {
  const stored = isStressStrainData(material.stressStrainCurve)
    ? material.stressStrainCurve
    : null;
  const [mode, setMode] = useState(stored ? 'full' : 'idealized');
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [strainUnit, setStrainUnit] = useState<StrainUnit>('mm/mm');
  const [stressUnit, setStressUnit] = useState<StressUnit>('MPa');
  const [definition, setDefinition] =
    useState<StressStrainData['definition']>('unspecified');
  const [strainKind, setStrainKind] =
    useState<StressStrainData['strainKind']>('total');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [plotStrainUnit, setPlotStrainUnit] = useState<StrainUnit>('mm/mm');
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRequest = useRef(0);
  const saveLock = useRef(false);
  const deleteLock = useRef(false);
  const busy = saving || pending;
  const deleteBusy = deleting || pending;
  const activeMode = stored ? mode : 'idealized';
  const parsed = useMemo(
    () => parseCurvePoints(text, strainUnit, stressUnit),
    [text, strainUnit, stressUnit],
  );
  const draft: StressStrainData = {
    points: parsed.points,
    definition,
    strainKind,
    source,
    notes,
  };
  useEffect(() => {
    if (editable || busy || !editing) return;
    fileRequest.current++;
    setEditing(false);
    setMessage(null);
  }, [editable, busy, editing]);
  useEffect(() => {
    if (stored) return;
    setMode('idealized');
    setConfirmingDelete(false);
    setDeleteMessage(null);
  }, [stored]);
  const beginEdit = () => {
    if (!editable || busy || deleting) return;
    setConfirmingDelete(false);
    setDeleteMessage(null);
    fileRequest.current++;
    setText(
      stored
        ? stored.points.map((p) => `${p.strain},${p.stress}`).join('\n')
        : '',
    );
    setStrainUnit('mm/mm');
    setStressUnit('MPa');
    setDefinition(stored?.definition ?? 'unspecified');
    setStrainKind(stored?.strainKind ?? 'total');
    setSource(stored?.source ?? '');
    setNotes(stored?.notes ?? '');
    setMessage(null);
    setEditing(true);
  };
  const cancel = () => {
    if (busy) return;
    fileRequest.current++;
    setEditing(false);
    setMessage(null);
  };
  const save = async () => {
    if (saveLock.current || busy || !editable) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const error = await Promise.resolve(onSave(draft));
      if (error) setMessage(error);
      else {
        fileRequest.current++;
        setEditing(false);
        setMode('full');
        setMessage(null);
      }
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : '曲線儲存失敗。');
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  const askDelete = () => {
    if (!onDelete || !stored || !editable || editing || deleteBusy || confirmingDelete) return;
    setDeleteMessage(null);
    setConfirmingDelete(true);
  };
  const cancelDelete = () => {
    if (deleteLock.current || deleteBusy) return;
    setConfirmingDelete(false);
    setDeleteMessage(null);
  };
  const confirmDelete = async () => {
    if (!onDelete || deleteLock.current || deleteBusy || !stored) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const error = await Promise.resolve(onDelete());
      if (error) setDeleteMessage(error);
      else {
        setConfirmingDelete(false);
        setDeleteMessage(null);
        setMode('idealized');
      }
    } catch (error) {
      setDeleteMessage(error instanceof Error && error.message ? error.message : '曲線刪除失敗。');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };
  const readFile = async (file?: File) => {
    if (!file) return;
    const request = ++fileRequest.current;
    try {
      const content = await file.text();
      if (request !== fileRequest.current) return;
      setText(content);
      setMessage(null);
    } catch {
      if (request === fileRequest.current)
        setMessage('無法讀取檔案，請重新選擇 CSV 或直接貼上數據。');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <section
      className="stress-strain-section"
      aria-label="Stress–strain curve 資料"
    >
      <div className="curve-toolbar">
        <label>
          曲線資料來源
          <select
            aria-label="曲線資料來源"
            value={activeMode}
            disabled={editing || deleting}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="idealized">材料性質推算曲線</option>
            <option value="full" disabled={!stored}>
              完整 Stress–strain 數據
              {stored ? ` (${stored.points.length} points)` : ''}
            </option>
          </select>
        </label>
        {!editing && editable && (
          <button className="btn" disabled={pending || deleting || confirmingDelete} onClick={beginEdit}>
            {stored ? <EditIcon /> : <PlusIcon />}
            {stored ? '編輯完整曲線' : '加入完整曲線'}
          </button>
        )}
        {stored && !editing && editable && onDelete && (
          <button
            className="btn danger-outline"
            disabled={pending || deleting || confirmingDelete}
            onClick={askDelete}
          >
            <TrashIcon /> 刪除完整曲線
          </button>
        )}
      </div>
      {confirmingDelete && stored && !editing && (
        <div className="curve-delete-confirm" role="alertdialog" aria-label="刪除完整曲線">
          <p>只會刪除這筆材料儲存的完整 Stress–strain 曲線，材料本身與其他材料性質不會刪除。</p>
          {deleteMessage && <div className="notice err" role="alert">{deleteMessage}</div>}
          <div className="curve-save-actions">
            <button className="btn" disabled={deleteBusy} onClick={cancelDelete}>取消</button>
            <button className="btn danger" disabled={deleteBusy} onClick={() => void confirmDelete()}>
              {deleting ? '刪除中…' : '刪除完整曲線'}
            </button>
          </div>
        </div>
      )}
      {editing ? (
        <div className="form curve-editor">
          <h3>完整 Stress–strain 數據</h3>
          <p className="form-hint">
            貼上兩欄數據，或匯入 CSV／TSV。每列為 Strain,
            Stress，可包含表頭；數值使用小數點及科學記號。
          </p>
          <div className="form-grid">
            <label>
              Strain 輸入單位
              <select
                value={strainUnit}
                disabled={busy}
                onChange={(event) =>
                  setStrainUnit(event.target.value as StrainUnit)
                }
              >
                <option>mm/mm</option>
                <option>%</option>
              </select>
            </label>
            <label>
              Stress 輸入單位
              <select
                value={stressUnit}
                disabled={busy}
                onChange={(event) =>
                  setStressUnit(event.target.value as StressUnit)
                }
              >
                <option>MPa</option>
                <option>GPa</option>
              </select>
            </label>
            <label>
              曲線定義
              <select
                value={definition}
                disabled={busy}
                onChange={(event) =>
                  setDefinition(
                    event.target.value as StressStrainData['definition'],
                  )
                }
              >
                {Object.entries(CURVE_DEFINITIONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Strain 定義
              <select
                value={strainKind}
                disabled={busy}
                onChange={(event) =>
                  setStrainKind(
                    event.target.value as StressStrainData['strainKind'],
                  )
                }
              >
                {Object.entries(STRAIN_KINDS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            type="file"
            ref={fileRef}
            hidden
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <div className="curve-file-actions">
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <UploadIcon /> 匯入曲線 CSV
            </button>
            <span className="muted small">匯入後先預覽，再儲存。</span>
          </div>
          <label>
            Strain / Stress 數據
            <textarea
              rows={9}
              spellCheck={false}
              value={text}
              disabled={busy}
              placeholder={'Strain,Stress\n0,0\n0.001,71\n0.005,170\n0.02,220'}
              onChange={(event) => {
                fileRequest.current++;
                setText(event.target.value);
                setMessage(null);
              }}
            />
          </label>
          {text.trim() &&
            (parsed.errors.length ? (
              <div className="notice err" role="alert">
                <b>資料有誤，未儲存：</b>
                <ul>
                  {parsed.errors.slice(0, 5).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
                {parsed.errors.length > 5 && (
                  <span>另有 {parsed.errors.length - 5} 個錯誤。</span>
                )}
              </div>
            ) : (
              <>
                <div className="curve-valid" role="status">
                  已讀取 {parsed.points.length.toLocaleString()} 個完整資料點
                </div>
                <FullStressStrainPlot
                  data={draft}
                  name={material.name}
                  stressUnit={stressUnit}
                  strainUnit={strainUnit}
                />
              </>
            ))}
          <label>
            曲線 Source
            <input
              value={source}
              disabled={busy}
              onChange={(event) => setSource(event.target.value)}
              placeholder="試驗報告、供應商資料或量測來源"
            />
          </label>
          <label>
            曲線備註
            <textarea
              rows={2}
              value={notes}
              disabled={busy}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="試驗條件、溫度、應變率等"
            />
          </label>
          <p className="form-hint">
            以 mm/mm、MPa
            儲存完整資料；保留原始順序，支援降伏後軟化、卸載及負值。不轉換
            engineering／true 定義，也不回算材料性質。
          </p>
          {message && (
            <div className="notice err" role="alert">
              {message}
            </div>
          )}
          <div className="curve-save-actions">
            <button className="btn" disabled={busy} onClick={cancel}>
              取消曲線編輯
            </button>
            <button
              className="btn primary"
              disabled={busy || !text.trim() || parsed.errors.length > 0}
              onClick={() => void save()}
            >
              {busy ? '儲存中…' : '儲存完整曲線'}
            </button>
          </div>
        </div>
      ) : activeMode === 'full' && stored ? (
        <>
          <div className="curve-display-tools">
            <label>
              Strain 顯示單位
              <select
                value={plotStrainUnit}
                onChange={(event) =>
                  setPlotStrainUnit(event.target.value as StrainUnit)
                }
              >
                <option>mm/mm</option>
                <option>%</option>
              </select>
            </label>
            <button
              className="btn"
              onClick={() => downloadCurve(stored, material.name)}
            >
              <DownloadIcon /> 匯出曲線 CSV
            </button>
          </div>
          <FullStressStrainPlot
            data={stored}
            name={material.name}
            stressUnit={units.stress}
            strainUnit={plotStrainUnit}
          />
          <dl className="meta-grid curve-meta">
            <dt>Curve definition</dt>
            <dd>{CURVE_DEFINITIONS[stored.definition]}</dd>
            <dt>Strain definition</dt>
            <dd>{STRAIN_KINDS[stored.strainKind]}</dd>
            <dt>Source</dt>
            <dd>{stored.source || '—'}</dd>
            <dt>備註</dt>
            <dd className="notes">{stored.notes || '—'}</dd>
          </dl>
        </>
      ) : (
        <StressStrainCurve m={material} />
      )}
    </section>
  );
}
