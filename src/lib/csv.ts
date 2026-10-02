import { CATEGORIES } from '../types';
import type { Category, Material, MaterialInput } from '../types';
import { PROPS } from './props';

// Export always uses base units (t/mm³, MPa, %) regardless of display prefs.
const HEADERS = [
  'Name',
  'Category',
  ...PROPS.map((p) => `${p.label} ${p.symbol} (${p.unit})`),
  'Source',
  'Notes',
  'Last Updated',
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
  if (table.length < 2) return { rows: [], errors: ['The file has no data rows.'] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix.toLowerCase()));
  const nameIdx = col('name');
  if (nameIdx < 0) return { rows: [], errors: ['Missing required "Name" column.'] };
  const catIdx = col('category');
  const srcIdx = col('source');
  const notesIdx = col('notes');
  const propIdx = PROPS.map((p) => col(p.label.toLowerCase()));

  const rows: MaterialInput[] = [];
  table.slice(1).forEach((r, i) => {
    const line = i + 2;
    const name = (r[nameIdx] ?? '').trim();
    if (!name) {
      errors.push(`Line ${line}: missing name — skipped.`);
      return;
    }
    const rawCat = (r[catIdx] ?? '').trim();
    const category = (CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? 'Others') as Category;
    if (rawCat && category === 'Others' && rawCat.toLowerCase() !== 'others') {
      errors.push(`Line ${line}: unknown category "${rawCat}" — set to Others.`);
    }
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
      else errors.push(`Line ${line}: "${raw}" is not a number for ${p.label} — left empty.`);
    });
    rows.push(m);
  });
  return { rows, errors };
}
