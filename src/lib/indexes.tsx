import { createContext, useContext } from 'react';
import { CATEGORIES, CATEGORY_LABEL, type Material } from '../types';

export const INDEX_KEY = 'cae-material-library:indexes:v1';
export interface MaterialIndexes {
  categories: { id: string; label: string; color: string }[];
  sources: string[];
}
export type IndexKind = 'category' | 'source';
/** Built-in presentation colors. Stored index colors stay unchanged. */
export const CATEGORY_PRESENTATION_COLORS: Record<string, string> = {
  Metal: '#3b82f6',
  Plastic: '#f59e0b',
  Composite: '#a855f7',
  Elastomer: '#22c55e',
  Others: '#94a3b8',
};

/** One color for sidebar, table, map, cards, and the drawer badge. */
export function categoryPresentationColor(id: string, stored?: string | null): string {
  const builtin = CATEGORY_PRESENTATION_COLORS[id];
  if (builtin) return builtin;
  if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) return stored;
  return '#94a3b8';
}

const storedDefaultColors = ['#2563eb', '#df8105', '#813ef4', '#0d9488', '#6b7b92'];
export function defaultIndexes(): MaterialIndexes {
  return {
    categories: CATEGORIES.map((id, i) => ({
      id,
      label: CATEGORY_LABEL[id],
      color: storedDefaultColors[i],
    })),
    sources: [],
  };
}
export function deriveIndexes(
  materials: Material[],
  saved: MaterialIndexes,
): MaterialIndexes {
  const categories = [...saved.categories];
  for (const material of materials)
    if (!categories.some((c) => c.id === material.category))
      categories.push({
        id: material.category,
        label: material.category,
        color: '#6b7b92',
      });
  return {
    categories,
    sources: [
      ...new Set([
        ...saved.sources,
        ...materials.map((m) => m.source).filter(Boolean),
      ]),
    ].sort((a, b) => a.localeCompare(b)),
  };
}
export function changeIndex(
  indexes: MaterialIndexes,
  kind: IndexKind,
  id: string | null,
  rawName: string,
): { next?: MaterialIndexes; error?: string } {
  const name = rawName.trim();
  if (!name) return { error: '請輸入名稱。' };
  if (name.length > 120) return { error: '名稱最多 120 個字元。' };
  if (name.toLowerCase() === 'all')
    return { error: 'all 是系統保留名稱，請使用其他名稱。' };
  if (kind === 'category') {
    if (id !== null && !indexes.categories.some((c) => c.id === id))
      return { error: '分類已不存在，請重新開啟管理。' };
    if (
      indexes.categories.some(
        (c) =>
          c.id !== id &&
          (c.label.toLowerCase() === name.toLowerCase() ||
            c.id.toLowerCase() === name.toLowerCase()),
      )
    )
      return { error: '已有相同名稱的分類。' };
    return {
      next: {
        ...indexes,
        categories:
          id === null
            ? [
                ...indexes.categories,
                { id: name, label: name, color: '#6b7b92' },
              ]
            : indexes.categories.map((c) =>
                c.id === id ? { ...c, label: name } : c,
              ),
      },
    };
  }
  if (id !== null && !indexes.sources.includes(id))
    return { error: '來源已不存在，請重新開啟管理。' };
  if (
    indexes.sources.some(
      (s) => s !== id && s.toLowerCase() === name.toLowerCase(),
    )
  )
    return { error: '已有相同名稱的來源。' };
  return {
    next: {
      ...indexes,
      sources:
        id === null
          ? [...indexes.sources, name]
          : indexes.sources.map((s) => (s === id ? name : s)),
    },
  };
}

export const IndexContext = createContext<MaterialIndexes>(defaultIndexes());
export function useIndexes() {
  const indexes = useContext(IndexContext);
  return {
    ...indexes,
    label: (id: string) =>
      indexes.categories.find((c) => c.id === id)?.label ?? id,
    color: (id: string) =>
      categoryPresentationColor(id, indexes.categories.find((c) => c.id === id)?.color),
  };
}
