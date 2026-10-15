import { useMemo, useState } from 'react';
import type { Material } from '../types';
import { isOrthotropic } from '../lib/materialProperties';
import type { HardeningInputs } from '../lib/etan';
import { SolverPlasticityResults } from './SolverPlasticityResults';

interface Props {
  materials: Material[];
}

type Field = keyof HardeningInputs;
const FIELDS: { key: Field; label: string; unit: string }[] = [
  { key: 'youngsModulus', label: "Young's Modulus", unit: 'MPa' },
  { key: 'yieldStress', label: 'Yield Stress', unit: 'MPa' },
  { key: 'ultimateStress', label: 'Ultimate Stress', unit: 'MPa' },
  { key: 'elongation', label: 'Elongation', unit: '%' },
];

const toText = (v: number | null) => (v === null ? '' : String(v));

/** Existing workspace calculator; shared solver outputs with material Properties. */
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

  const inputs: HardeningInputs = useMemo(() => {
    const n = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : null);
    return { youngsModulus: n(vals.youngsModulus), yieldStress: n(vals.yieldStress), ultimateStress: n(vals.ultimateStress), elongation: n(vals.elongation) };
  }, [vals]);

  return (
    <main className="page etan-page">
      <div className="page-head">
        <h1>Solver Plasticity Parameters</h1>
        <span className="page-sub">OptiStruct MATS1 使用 H；LS-DYNA MAT_003 使用轉換後的 ETAN。Elongation 以 % 輸入。</span>
      </div>

      <div className="etan-card">
        <label className="etan-pick">
          <span>選擇材料</span>
          <select value={matId} onChange={(e) => pick(e.target.value)}>
            <option value="">— 手動輸入 —</option>
            {materials.filter(m => !isOrthotropic(m)).map((m) => (
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

        <SolverPlasticityResults inputs={inputs} density={material?.density} poissonRatio={material?.poissonRatio} />
      </div>
    </main>
  );
}
