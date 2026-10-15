import { useMemo, useState } from 'react';
import { useIndexes } from '../lib/indexes';
import type { Category, CompositeStrength, Material, MaterialInput, MaterialModel, MaterialPropertyKey, OrthotropicProperties } from '../types';
import { COMPOSITE_STRENGTH_PROPS, COMPOSITE_SUBCATEGORIES, ORTHOTROPIC_GROUPS, ORTHOTROPIC_PROPS, PROPS, type PropDef } from '../lib/props';
import { isOrthotropic } from '../lib/materialProperties';
import { OrthotropicInfo } from './OrthotropicProperties';
import { Modal } from './Modal';

interface Props {
  initial: Material | null; // null = new material
  existing: Material[];
  onSave: (input: MaterialInput) => void;
  onClose: () => void;
}

const RULES: Partial<Record<MaterialPropertyKey, { min?: number; max?: number; positive?: boolean }>> = {
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
  const [materialModel, setMaterialModel] = useState<MaterialModel>(initial?.materialModel ?? 'Isotropic');
  const [subCategory, setSubCategory] = useState(initial?.subCategory ?? '');
  const orthotropic = isOrthotropic({ category, materialModel });
  // Calculated properties (H) are not entered by hand.
  const mechanicalProps = orthotropic ? PROPS.filter(p => p.key === 'density') : PROPS.filter(p => !p.calculated);
  const activeProps: PropDef<MaterialPropertyKey>[] = orthotropic
    ? [...mechanicalProps, ...ORTHOTROPIC_PROPS, ...COMPOSITE_STRENGTH_PROPS] : mechanicalProps;
  const [source, setSource] = useState(initial?.source ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries([
      ...PROPS.map(p => [p.key, toText(initial?.[p.key] ?? null)]),
      ...ORTHOTROPIC_PROPS.map(p => [p.key, toText(initial?.orthotropic?.[p.key] ?? null)]),
      ...COMPOSITE_STRENGTH_PROPS.map(p => [p.key, toText(initial?.compositeStrength?.[p.key] ?? null)]),
    ]),
  );
  const [submitted, setSubmitted] = useState(false);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!n) e.name = '請輸入材料名稱。';
    else if (existing.some((m) => m.id !== initial?.id && m.name.toLowerCase() === n.toLowerCase()))
      e.name = '已有相同名稱的材料。';
    for (const p of activeProps) {
      const raw = vals[p.key].trim();
      if (raw === '') continue;
      const num = Number(raw);
      const r = RULES[p.key] ?? (p.unit === 'MPa' ? { positive: true } : undefined);
      if (!Number.isFinite(num)) e[p.key] = '請輸入數字（例如 2.82E-9）。';
      else if (r?.positive && num <= 0) e[p.key] = '必須大於 0。';
      else if (r?.min !== undefined && num < r.min) e[p.key] = `必須 ≥ ${r.min}。`;
      else if (r?.max !== undefined && num > r.max) e[p.key] = `必須 ≤ ${r.max}。`;
    }
    return e;
  }, [name, vals, existing, initial, orthotropic]);

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
      // Hidden fields keep the existing stored value unchanged (legacy H stays as-is; new materials get null).
      input[p.key] = (orthotropic && p.key !== 'density') || p.calculated ? initial?.[p.key] ?? null : raw === '' ? null : Number(raw);
    }
    // Optional keys are omitted on untouched legacy records. Inactive data is retained
    // for reversible model switching, while all views use the explicit active model.
    if (category === 'Composite' || initial?.materialModel !== undefined) input.materialModel = materialModel;
    if (subCategory || initial?.subCategory !== undefined) input.subCategory = subCategory;
    if (orthotropic) {
      input.orthotropic = { ...initial?.orthotropic, ...Object.fromEntries(ORTHOTROPIC_PROPS.map(p => [p.key, vals[p.key].trim() === '' ? null : Number(vals[p.key])])) } as OrthotropicProperties;
      input.compositeStrength = { ...initial?.compositeStrength, ...Object.fromEntries(COMPOSITE_STRENGTH_PROPS.map(p => [p.key, vals[p.key].trim() === '' ? null : Number(vals[p.key])])) } as CompositeStrength;
    }
    onSave(input);
  };

  const err = (k: string) => (submitted || touchedHint(k)) && errors[k];
  // Live-validate property fields only once the user typed something.
  const touchedHint = (k: string) => k !== 'name' && vals[k]?.trim() !== '';

  const field = (p: PropDef<MaterialPropertyKey>) => (
    <label key={p.key} className={err(p.key) ? 'invalid' : ''}>
      <span>{p.label}<small> {p.unit !== '—' ? `(${p.unit})` : ''}{p.optional ? ' · optional' : ''}</small></span>
      <input inputMode="decimal" aria-invalid={!!err(p.key)} value={vals[p.key]} onChange={e => setVals({ ...vals, [p.key]: e.target.value })} placeholder="—" />
      {err(p.key) && <em>{errors[p.key]}</em>}
    </label>
  );

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
        <h3 className="form-section-title">Basic Information</h3>
        <div className="form-row two">
          <label className={err('name') ? 'invalid' : ''}>
            <span>Material Name *</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="例如 SUS304 1/2H" />
            {err('name') && <em>{errors.name}</em>}
          </label>
          <label>
            <span>Category</span>
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {indexes.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>
        </div>

        {category === 'Composite' && <div className="form-row two">
          <label>
            <span>Sub Category</span>
            <select aria-label="Sub Category" value={subCategory} onChange={e => setSubCategory(e.target.value)}>
              <option value="">—</option>
              {subCategory && !(COMPOSITE_SUBCATEGORIES as readonly string[]).includes(subCategory) && <option value={subCategory}>{subCategory}</option>}
              {COMPOSITE_SUBCATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            <span>Material Model</span>
            <select aria-label="Material Model" value={materialModel} onChange={e => setMaterialModel(e.target.value as MaterialModel)}>
              <option value="Orthotropic">Orthotropic</option>
              <option value="Isotropic">Isotropic Equivalent</option>
            </select>
          </label>
        </div>}

        <fieldset>
          <legend>Mechanical Properties <small>（未知請留空，將顯示為「—」，不會存成 0）</small></legend>
          <div className="form-grid">
            {mechanicalProps.map(field)}
          </div>
        </fieldset>

        {orthotropic && <>
          <fieldset>
            <legend>Orthotropic Elastic Properties <OrthotropicInfo /></legend>
            <div className="orthotropic-groups">
              {ORTHOTROPIC_GROUPS.map(group => <section className="orthotropic-group" key={group.label} aria-label={group.label}>
                <h4>{group.label}</h4>
                {group.props.map(field)}
              </section>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Strength / Failure Properties <small>(Optional)</small></legend>
            <div className="form-grid composite-strength-fields">{COMPOSITE_STRENGTH_PROPS.map(field)}</div>
          </fieldset>
        </>}

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
