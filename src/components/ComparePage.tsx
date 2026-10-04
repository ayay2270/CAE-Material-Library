import type { Material } from '../types';
import { useIndexes } from '../lib/indexes';
import { PROPS } from '../lib/props';
import { formatDateLong, formatValue, unitFor } from '../lib/format';
import type { UnitPrefs } from '../lib/format';
import { ArrowLeftIcon, CloseIcon } from './icons';

interface Props {
  materials: Material[];
  selected: string[];
  units: UnitPrefs;
  onToggle: (id: string) => void;
  onClear: () => void;
  onBack: () => void;
  onOpen: (m: Material) => void;
}

export function ComparePage({ materials, selected, units, onToggle, onClear, onBack, onOpen }: Props) {
  const indexes = useIndexes();
  const picked = selected.map((id) => materials.find((m) => m.id === id)).filter((m): m is Material => !!m);

  return (
    <main className="page compare-page">
      <div className="page-head">
        <button className="back-link" onClick={onBack}>
          <ArrowLeftIcon /> 返回材料列表
        </button>
        <h1>材料比較</h1>
        <span className="page-sub">
          {picked.length >= 2 ? `已選擇 ${picked.length} 個材料進行比較，可同時比較更多材料。` : '請選擇至少 2 個材料進行比較，可同時比較更多材料。'}
        </span>
        {picked.length > 0 && (
          <button className="btn small-btn push-right" onClick={onClear}>
            清除選取
          </button>
        )}
      </div>

      <div className="compare-picker" role="group" aria-label="選擇要比較的材料">
        <span className="picker-label">選擇材料：</span>
        {materials.map((m) => (
          <label key={m.id} className={`pick ${selected.includes(m.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => onToggle(m.id)} />
            {m.name}
          </label>
        ))}
      </div>

      {picked.length < 2 ? (
        <div className="empty-state">請在上方勾選至少 2 個材料（或在材料列表勾選多筆後按「比較材料」）。</div>
      ) : (
        <div className="table-wrap compare-wrap" data-count={picked.length} style={{ maxWidth: 210 + picked.length * 400 }}>
          <div className="table-scroll">
            <table className="mat-table compare-table" data-testid="compare-table" style={{ minWidth: 210 + picked.length * 150 }}>
              <thead>
                <tr>
                  <th className="prop-col">Property</th>
                  {picked.map((m) => (
                    <th key={m.id} className="num">
                      <span className="cmp-head">
                        <button className="link-btn" onClick={() => onOpen(m)} title="查看詳細資料">
                          {m.name}
                        </button>
                        <button className="icon-btn" onClick={() => onToggle(m.id)} aria-label={`從比較中移除 ${m.name}`} title="移除">
                          <CloseIcon size={11} />
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="prop-col">Category</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num txt">{indexes.label(m.category)}</td>
                  ))}
                </tr>
                {PROPS.map((p) => {
                  const nums = picked.map((m) => m[p.key]).filter((v): v is number => v !== null);
                  const differs = new Set(nums).size > 1;
                  const u = unitFor(p, units);
                  return (
                    <tr key={p.key}>
                      <td className="prop-col">
                        {p.label}
                        {u !== '—' && <small className="muted"> ({u})</small>}
                        {u === '—' && <small className="muted"> (—)</small>}
                      </td>
                      {picked.map((m) => {
                        const v = m[p.key];
                        return (
                          <td key={m.id} className={`num ${v === null ? 'missing' : ''} ${differs && v !== null ? 'differs' : ''}`}>
                            {formatValue(p.key, v, units)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr>
                  <td className="prop-col">Source</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num txt">{m.source || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="prop-col">Updated</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num txt">{formatDateLong(m.updatedAt).slice(0, 10)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="prop-col">備註</td>
                  {picked.map((m) => (
                    <td key={m.id} className="num txt notes-cell">{m.notes || '—'}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="table-foot">
            <span>數值不同的項目以粗體顯示；「—」表示尚無資料。欄位較多時可左右捲動。</span>
          </div>
        </div>
      )}
    </main>
  );
}
