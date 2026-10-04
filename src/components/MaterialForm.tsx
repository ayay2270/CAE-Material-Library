import { useMemo, useState } from 'react';
import { useIndexes } from '../lib/indexes';
import type { Category, Material, MaterialInput } from '../types';
import { PROPS } from '../lib/props';
import { Modal } from './Modal';

interface Props {
  initial: Material | null; // null = new material
  existing: Material[];
  onSave: (input: MaterialInput) => void;
  onClose: () => void;
}

const RULES: Partial<Record<(typeof PROPS)[number]['key'], { min?: number; max?: number; positive?: boolean }>> = {
  density: { positive: true },
  youngsModulus: { positive: true },
  poissonRatio: { min: 0, max: 0.5 },
  yieldStress: { positive: true },
  etan: { min: 0 },
  ultimateStress: { positive: true },
  elongation: { min: 0 },
};

const toText = (v: number | null) => (v === null ? '' : String(v));

export function MaterialForm({ initial, existing, onSave, onClose }: Props) {
  const indexes = useIndexes();
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'Metal');
  const [source, setSource] = useState(initial?.source ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(PROPS.map((p) => [p.key, toText(initial?.[p.key] ?? null)])),
  );
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!n) e.name = '請輸入材料名稱。';
    else if (existing.some((m) => m.id !== initial?.id && m.name.toLowerCase() === n.toLowerCase()))
      e.name = '已有相同名稱的材料。';
    for (const p of PROPS) {
      const raw = vals[p.key].trim();
      if (raw === '') continue;
      const num = Number(raw);
      const r = RULES[p.key];
      if (!Number.isFinite(num)) e[p.key] = '請輸入數字（例如 2.82E-9）。';
      else if (r?.positive && num <= 0) e[p.key] = '必須大於 0。';
      else if (r?.min !== undefined && num < r.min) e[p.key] = `必須 ≥ ${r.min}。`;
      else if (r?.max !== undefined && num > r.max) e[p.key] = `必須 ≤ ${r.max}。`;
    }
    return e;
  }, [name, vals, existing, initial]);

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const input: MaterialInput = {
      name: name.trim(),
      category,
      source: source.trim(),
      notes: notes.trim(),
      density: null,
      youngsModulus: null,
      poissonRatio: null,
      yieldStress: null,
      etan: null,
      ultimateStress: null,
      elongation: null,
    };
    for (const p of PROPS) {
      const raw = vals[p.key].trim();
      input[p.key] = raw === '' ? null : Number(raw);
    }
    onSave(input);
  };

  const err = (k: string) => (submitted || touchedHint(k)) && errors[k];
  // Live-validate property fields only once the user typed something.
  const touchedHint = (k: string) => k !== 'name' && vals[k]?.trim() !== '';

  return (
    <Modal
      title={initial ? `編輯 ${initial.name}` : '新增材料'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn primary" onClick={submit}>{initial ? '儲存變更' : '新增'}</button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="form-row two">
          <label className={err('name') ? 'invalid' : ''}>
            <span>Material Name *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 SUS304 1/2H" />
            {err('name') && <em>{errors.name}</em>}
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {indexes.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>性質 <small>（未知請留空，將顯示為「—」，不會存成 0）</small></legend>
          <div className="form-grid">
            {PROPS.map((p) => (
              <label key={p.key} className={err(p.key) ? 'invalid' : ''}>
                <span>
                  {p.label}
                  <small> {p.unit !== '—' ? `(${p.unit})` : ''}{p.optional ? ' · optional' : ''}</small>
                </span>
                <input
                  inputMode="decimal"
                  value={vals[p.key]}
                  onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })}
                  placeholder="—"
                />
                {err(p.key) && <em>{errors[p.key]}</em>}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <span>Source</span>
          <input list="material-source-options" value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：供應商資料表、網路、提供者姓名" />
          <datalist id="material-source-options">{indexes.sources.map(s => <option key={s} value={s}/>)}</datalist>
        </label>
        <label>
          <span>備註</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="試驗條件、熱處理狀態、參考連結…" />
        </label>
        <p className="form-hint">數值以 mm–t–N–s 單位制儲存（密度 t/mm³、應力 MPa）。</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
