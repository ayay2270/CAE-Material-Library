import { useMemo, useState } from 'react';
import { CATEGORIES } from '../types';
import type { Category, Material, MaterialInput } from '../types';
import { PROPS, PROP_COUNT } from '../lib/props';
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
    if (!n) e.name = 'Name is required.';
    else if (existing.some((m) => m.id !== initial?.id && m.name.toLowerCase() === n.toLowerCase()))
      e.name = 'A material with this name already exists.';
    for (const p of PROPS) {
      const raw = vals[p.key].trim();
      if (raw === '') continue;
      const num = Number(raw);
      const r = RULES[p.key];
      if (!Number.isFinite(num)) e[p.key] = 'Enter a number (e.g. 2.82E-9).';
      else if (r?.positive && num <= 0) e[p.key] = 'Must be greater than 0.';
      else if (r?.min !== undefined && num < r.min) e[p.key] = `Must be ≥ ${r.min}.`;
      else if (r?.max !== undefined && num > r.max) e[p.key] = `Must be ≤ ${r.max}.`;
    }
    return e;
  }, [name, vals, existing, initial]);

  const filled = PROPS.filter((p) => vals[p.key].trim() !== '' && !errors[p.key]).length;

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
      title={initial ? `Edit ${initial.name}` : 'Add Material'}
      width={600}
      onClose={onClose}
      footer={
        <>
          <span className="form-count">
            {filled}/{PROP_COUNT} properties filled
          </span>
          <span className="toolbar-spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit}>{initial ? 'Save changes' : 'Add material'}</button>
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
            <span>Material name *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SUS304 1/2H" />
            {err('name') && <em>{errors.name}</em>}
          </label>
          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend>Properties <small>(leave blank when unknown — it is stored as “—”, never as 0)</small></legend>
          <div className="form-grid">
            {PROPS.map((p) => (
              <label key={p.key} className={err(p.key) ? 'invalid' : ''}>
                <span>
                  <b className="sym">{p.symbol}</b> {p.label}
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
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Supplier datasheet, Web, Provided by …" />
        </label>
        <label>
          <span>Notes</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Test condition, temper, reference link…" />
        </label>
        <p className="form-hint">Values are stored in the mm–t–N–s unit system (density t/mm³, stress MPa).</p>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
