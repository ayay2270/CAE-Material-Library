export const CATEGORIES = ['Metal', 'Plastic', 'Composite', 'Elastomer', 'Others'] as const;
export type Category = string;

/** Traditional Chinese UI label for each stored category value (stored values are unchanged). */
export const CATEGORY_LABEL: Record<Category, string> = {
  Metal: '金屬',
  Plastic: '塑膠',
  Composite: '複合材料',
  Elastomer: '彈性體',
  Others: '其他',
};

export type PropKey =
  | 'density'
  | 'youngsModulus'
  | 'poissonRatio'
  | 'yieldStress'
  | 'etan'
  | 'ultimateStress'
  | 'elongation';

export interface HistoryEntry {
  at: string; // ISO timestamp
  action: 'created' | 'edited' | 'imported';
  summary: string;
}

export interface StressStrainData {
  /** All supplied points, in their original order; base units mm/mm and MPa. */
  points: { strain: number; stress: number }[];
  definition: 'engineering' | 'true' | 'unspecified';
  strainKind: 'total' | 'plastic' | 'unspecified';
  source: string;
  notes: string;
}

export interface Material {
  id: string;
  name: string;
  category: Category;
  density: number | null; // t/mm³
  youngsModulus: number | null; // MPa
  poissonRatio: number | null;
  yieldStress: number | null; // MPa
  etan: number | null; // MPa (tangent modulus)
  ultimateStress: number | null; // MPa
  elongation: number | null; // %
  source: string;
  notes: string;
  updatedAt: string; // ISO timestamp
  history: HistoryEntry[];
  /** Optional for backward compatibility with existing records and CSV files. */
  stressStrainCurve?: StressStrainData | null;
}

export type MaterialInput = Omit<Material, 'id' | 'updatedAt' | 'history'>;

export type View = 'materials' | 'etan' | 'map' | 'compare';
