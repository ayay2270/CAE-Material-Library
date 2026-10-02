import { useCallback, useEffect, useRef, useState } from 'react';
import { seedMaterials } from '../data/seed';
import { PROPS } from './props';
import { formatValue } from './format';
import type { HistoryEntry, Material, MaterialInput } from '../types';

// Versioned key so a future schema change can migrate instead of clobber.
const KEY = 'cae-material-library:v1';

function load(): Material[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Material[];
    }
  } catch {
    /* fall through to seed */
  }
  return seedMaterials();
}

function save(list: Material[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode / quota) — keep working in memory */
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const NO_CHANGES = '無欄位變更';

/** Human-readable diff of two records for the history log. */
function describeChanges(before: Material, after: MaterialInput): string {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`名稱: ${before.name} → ${after.name}`);
  if (before.category !== after.category) changes.push(`Category: ${before.category} → ${after.category}`);
  for (const p of PROPS) {
    if (before[p.key] !== after[p.key]) {
      changes.push(`${p.label}: ${formatValue(p.key, before[p.key])} → ${formatValue(p.key, after[p.key])}`);
    }
  }
  if (before.source !== after.source) changes.push('Source');
  if (before.notes !== after.notes) changes.push('備註');
  return changes.length ? changes.join('; ') : NO_CHANGES;
}

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>(load);
  const latest = useRef(materials);
  latest.current = materials;

  useEffect(() => save(materials), [materials]);

  const add = useCallback((input: MaterialInput): Material => {
    const now = new Date().toISOString();
    const m: Material = {
      ...input,
      id: newId(),
      updatedAt: now,
      history: [{ at: now, action: 'created', summary: '建立記錄' }],
    };
    setMaterials((list) => [...list, m]);
    return m;
  }, []);

  const update = useCallback((id: string, input: MaterialInput) => {
    setMaterials((list) =>
      list.map((m) => {
        if (m.id !== id) return m;
        const now = new Date().toISOString();
        const entry: HistoryEntry = { at: now, action: 'edited', summary: describeChanges(m, input) };
        return { ...m, ...input, updatedAt: now, history: [entry, ...m.history] };
      }),
    );
  }, []);

  const remove = useCallback((id: string) => {
    setMaterials((list) => list.filter((m) => m.id !== id));
  }, []);

  /** Adds imported rows; a row whose name already exists updates that record. */
  const importMany = useCallback((rows: MaterialInput[]): { added: number; updated: number; unchanged: number } => {
    // Computed synchronously from the latest list so the caller gets real counts.
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    const next = [...latest.current];
    const now = new Date().toISOString();
    for (const row of rows) {
      const idx = next.findIndex((m) => m.name.toLowerCase() === row.name.toLowerCase());
      if (idx >= 0) {
        const m = next[idx];
        const diff = describeChanges(m, row);
        if (diff === NO_CHANGES) {
          unchanged++;
          continue;
        }
        next[idx] = {
          ...m,
          ...row,
          updatedAt: now,
          history: [{ at: now, action: 'imported', summary: `CSV 匯入 — ${diff}` }, ...m.history],
        };
        updated++;
      } else {
        next.push({
          ...row,
          id: newId(),
          updatedAt: now,
          history: [{ at: now, action: 'imported', summary: '由 CSV 匯入建立' }],
        });
        added++;
      }
    }
    latest.current = next;
    setMaterials(next);
    return { added, updated, unchanged };
  }, []);

  const resetToSamples = useCallback(() => setMaterials(seedMaterials()), []);

  return { materials, add, update, remove, importMany, resetToSamples };
}
