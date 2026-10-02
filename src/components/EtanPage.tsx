import { useMemo, useState } from 'react';
import type { Material } from '../types';
import { calcEtan, ETAN_FORMULA_READY } from '../lib/etan';
import type { EtanInputs } from '../lib/etan';
import { formatValue } from '../lib/format';

interface Props {
  materials: Material[];
}

type Field = keyof EtanInputs;
const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'youngsModulus', label: "Young's Modulus", unit: 'MPa' },
  { key: 'yieldStress', label: 'Yield Stress', unit: 'MPa' },
  { key: 'ultimateStress', label: 'Ultimate Stress', unit: 'MPa' },
  { key: 'elongation', label: 'Elongation', unit: '%' },
];

const toText = (v: number | null) => (v === null ? '' : String(v));

/** ETAN 算法: pick a material (or type values) and compute ETAN once the formula is provided. */
export function EtanPage({ materials }: Props) {
  const [matId, setMatId] = useState<string>('');
  const [vals, setVals] = useState<Record<Field, string>>({ youngsModulus: '', yieldStress: '', ultimateStress: '', elongation: '' });

  const material = materials.find((m) => m.id === matId) ?? null;

  const pick = (id: string) => {
    setMatId(id);
    const m = materials.find((x) => x.id === id);
    setVals(
      m
        ? { youngsModulus: toText(m.youngsModulus), yieldStress: toText(m.yieldStress), ultimateStress: toText(m.ultimateStress), elongation: toText(m.elongation) }
        : { youngsModulus: '', yieldStress: '', ultimateStress: '', elongation: '' },
    );
  };

  const inputs: EtanInputs = useMemo(() => {
    const n = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : null);
    return { youngsModulus: n(vals.youngsModulus), yieldStress: n(vals.yieldStress), ultimateStress: n(vals.ultimateStress), elongation: n(vals.elongation) };
  }, [vals]);

  const result = calcEtan(inputs);

  return (
    <main className="page etan-page">
      <div className="page-head">
        <h1>ETAN 算法</h1>
        <span className="page-sub">由材料的 Young's Modulus、Yield Stress、Ultimate Stress、Elongation 計算 ETAN。</span>
      </div>

      <div className="etan-card">
        <label className="etan-pick">
          <span>選擇材料</span>
          <select value={matId} onChange={(e) => pick(e.target.value)}>
            <option value="">— 手動輸入 —</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>

        <div className="etan-inputs">
          {FIELDS.map((f) => (
            <label key={f.key}>
              <span>
                {f.label} <small className="muted">({f.unit})</small>
              </span>
              <input inputMode="decimal" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} placeholder="—" />
            </label>
          ))}
        </div>

        <div className="etan-result" role="status">
          <div>
            <span className="muted small">計算結果 ETAN (MPa)</span>
            <b data-testid="etan-result">{result === null ? '—' : result.toLocaleString('en-US', { maximumFractionDigits: 2 })}</b>
          </div>
          {!ETAN_FORMULA_READY && <p className="etan-note">ETAN 計算公式尚未提供，提供後會補上於此。目前僅顯示輸入欄位。</p>}
          {material && (
            <div className="etan-stored">
              <span className="muted small">資料庫中儲存的 ETAN</span>
              <b>{formatValue('etan', material.etan)}</b>
              <span className="muted small">MPa</span>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
