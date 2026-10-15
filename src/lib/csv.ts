import { CATEGORIES } from '../types';
import type { Category, CompositeStrength, Material, MaterialInput, OrthotropicProperties } from '../types';
import { COMPOSITE_STRENGTH_PROPS, ORTHOTROPIC_PROPS, PROPS } from './props';
import { isStressStrainData } from './curveData';

// Export always uses base units (t/mm³, MPa, %) regardless of display prefs.
const HEADERS = [
  'Name',
  'Category',
  ...PROPS.map((p) => `${p.label} ${p.symbol} (${p.unit})`),
  'Source',
  'Notes',
  'Last Updated',
  'Stress-Strain Curve JSON',
  'Material Model',
  'Sub Category',
  ...ORTHOTROPIC_PROPS.map(p => p.key.toUpperCase()),
  ...COMPOSITE_STRENGTH_PROPS.map(p => p.symbol),
];

function esc(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(list: Material[]): string {
  const lines = [HEADERS.map(esc).join(',')];
  for (const m of list) {
    lines.push(
      [
        m.name,
        m.category,
        ...PROPS.map((p) => (m[p.key] === null ? '' : String(m[p.key]))),
        m.source,
        m.notes,
        m.updatedAt,
        m.stressStrainCurve ? JSON.stringify(m.stressStrainCurve) : '',
        m.materialModel ?? '',
        m.subCategory ?? '',
        ...ORTHOTROPIC_PROPS.map(p => String(m.orthotropic?.[p.key] ?? '')),
        ...COMPOSITE_STRENGTH_PROPS.map(p => String(m.compositeStrength?.[p.key] ?? '')),
      ]
        .map(esc)
        .join(','),
    );
  }
  // BOM so Excel opens UTF-8 correctly.
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadCsv(list: Material[], filename = 'cae-materials.csv') {
  const blob = new Blob([toCsv(list)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Minimal RFC-4180 parser (quoted fields, escaped quotes, CRLF/LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

export interface ImportResult {
  rows: MaterialInput[];
  errors: string[];
}

export function csvToMaterials(text: string): ImportResult {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) return { rows: [], errors: ['檔案沒有資料列。'] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix.toLowerCase()));
  const nameIdx = col('name');
  if (nameIdx < 0) return { rows: [], errors: ['缺少必要的 "Name" 欄位。'] };
  const catIdx = col('category');
  const srcIdx = col('source');
  const notesIdx = col('notes');
  const curveIdx = col('stress-strain curve json');
  const modelIdx = col('material model');
  const subCategoryIdx = col('sub category');
  // Exact tokens avoid collisions such as E1/E12 or Xt/other prefixed headers.
  const constantCol = (key: string) => header.findIndex(h => h === key || h.startsWith(`${key} (`));
  // Accept the former ETAN header for the existing stored H field in older exports.
  const propIdx = PROPS.map((p) => p.key === 'etan'
    ? (col(p.label) >= 0 ? col(p.label) : col('etan'))
    : col(p.label));

  const rows: MaterialInput[] = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = (r[nameIdx] ?? '').trim();
    if (!name) {
      errors.push(`第 ${line} 行：缺少 Name，已略過。`);
      return;
    }
    const rawCat = (r[catIdx] ?? '').trim();
    const category = (CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? (rawCat || 'Others')) as Category;
    const m: MaterialInput = {
      name,
      category,
      density: null,
      youngsModulus: null,
      poissonRatio: null,
      yieldStress: null,
      etan: null,
      ultimateStress: null,
      elongation: null,
      source: (r[srcIdx] ?? '').trim(),
      notes: (r[notesIdx] ?? '').trim(),
    };
    PROPS.forEach((p, k) => {
      const raw = (r[propIdx[k]] ?? '').trim();
      if (raw === '' || raw === '—') return;
      const n = Number(raw);
      if (Number.isFinite(n)) m[p.key] = n;
      else errors.push(`第 ${line} 行：${p.label} 的「${raw}」不是數字，已留空。`);
    });
    const rawModel = (r[modelIdx] ?? '').trim();
    if (rawModel && rawModel !== '—') {
      if (/^orthotropic$/i.test(rawModel)) m.materialModel = 'Orthotropic';
      else if (/^isotropic( equivalent)?$/i.test(rawModel)) m.materialModel = 'Isotropic';
      else {
        errors.push(`第 ${line} 行：Material Model 無效，整列已略過以保護原資料。`);
        return;
      }
    }
    // Absent columns do not remove existing extension data on same-name imports.
    if (subCategoryIdx >= 0) m.subCategory = (r[subCategoryIdx] ?? '').trim();
    let invalid = false;
    for (const [group, properties] of [
      ['orthotropic', ORTHOTROPIC_PROPS],
      ['compositeStrength', COMPOSITE_STRENGTH_PROPS],
    ] as const) {
      if (!properties.some(p => constantCol(p.key) >= 0)) continue;
      const values: Record<string, number | null> = {};
      for (const p of properties) {
        const raw = (r[constantCol(p.key)] ?? '').trim();
        const value = raw === '' || raw === '—' ? null : Number(raw);
        if (value !== null && (!Number.isFinite(value) || (p.unit === 'MPa' && value <= 0))) {
          errors.push(`第 ${line} 行：${p.symbol} 無效，整列已略過以保護原資料。`);
          invalid = true;
        }
        values[p.key] = value;
      }
      if (group === 'orthotropic') m.orthotropic = values as OrthotropicProperties;
      else m.compositeStrength = values as CompositeStrength;
    }
    if (invalid) return;
    if (curveIdx >= 0 && r[curveIdx]?.trim()) {
      try {
        const curve = JSON.parse(r[curveIdx]);
        if (!isStressStrainData(curve)) throw new Error('invalid curve');
        m.stressStrainCurve = curve;
      } catch {
        errors.push(`第 ${line} 行：Stress-Strain Curve JSON 無效，整列已略過以保護原資料。`);
        return;
      }
    }
    rows.push(m);
  });
  return { rows, errors };
}
