export const CATEGORIES = ['Metal', 'Plastic', 'Composite', 'Elastomer', 'Others'] as const;
export type Category = (typeof CATEGORIES)[number];

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
}

export type MaterialInput = Omit<Material, 'id' | 'updatedAt' | 'history'>;

export type View = 'materials' | 'compare' | 'map';
