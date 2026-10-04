import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seedMaterials } from '../data/seed';
import { PROPS } from './props';
import { formatValue } from './format';
import type { HistoryEntry, Material, MaterialInput, StressStrainData } from '../types';
import { isStressStrainData } from './curveData';
import { changeIndex, deriveIndexes, INDEX_KEY, loadIndexes, persistTogether, type IndexKind } from './indexes';

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
  if (after.stressStrainCurve !== undefined && JSON.stringify(before.stressStrainCurve ?? null) !== JSON.stringify(after.stressStrainCurve)) changes.push('Stress–strain curve');
  return changes.length ? changes.join('; ') : NO_CHANGES;
}

export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>(load);
  const latest = useRef(materials);
  latest.current = materials;
  const [savedIndexes, setSavedIndexes] = useState(loadIndexes);
  const latestIndexes = useRef(savedIndexes);
  latestIndexes.current = savedIndexes;
  const indexes = useMemo(() => deriveIndexes(materials, savedIndexes), [materials, savedIndexes]);

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

  const setCurve = useCallback((id: string, curve: StressStrainData): string | null => {
    if (!isStressStrainData(curve)) return '曲線資料無效，未儲存。';
    const current = latest.current;
    if (!current.some(m => m.id === id)) return '材料已不存在，未儲存。';
    const now = new Date().toISOString();
    const next = current.map(m => m.id !== id ? m : {
      ...m, stressStrainCurve: curve, updatedAt: now,
      history: [{ at: now, action: 'edited' as const, summary: `Stress–strain curve：${curve.points.length} 個完整資料點` }, ...m.history],
    });
    try {
      // Report quota/storage failures before changing state or claiming success.
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return '瀏覽器儲存空間不足或無法使用，曲線未儲存。請先匯出備份或減少其他儲存資料。';
    }
    latest.current = next;
    setMaterials(next);
    return null;
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

  const editIndex = useCallback((kind: IndexKind, id: string | null, name: string): string | null => {
    const current = latest.current;
    const result = changeIndex(deriveIndexes(current,latestIndexes.current),kind,id,name);
    if (!result.next) return result.error ?? '無法儲存索引。';
    const now = new Date().toISOString();
    const nextMaterials = kind === 'source' && id !== null && id !== name.trim()
      ? current.map(m => m.source !== id ? m : {...m,source:name.trim(),updatedAt:now,history:[{at:now,action:'edited' as const,summary:`Source：${id} → ${name.trim()}（來源索引重新命名）`},...m.history]})
      : current;
    const entries: [string,string][] = [[INDEX_KEY,JSON.stringify(result.next)]];
    if (nextMaterials !== current) entries.push([KEY,JSON.stringify(nextMaterials)]);
    if (!persistTogether(entries)) return '瀏覽器儲存失敗，索引與材料未變更。請檢查儲存空間。';
    latestIndexes.current = result.next;
    latest.current = nextMaterials;
    setSavedIndexes(result.next);
    if (nextMaterials !== current) setMaterials(nextMaterials);
    return null;
  }, []);

  return { materials, add, update, remove, importMany, resetToSamples, setCurve, indexes, editIndex };
}
