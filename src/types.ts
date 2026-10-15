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

export type OrthotropicKey = 'e1' | 'e2' | 'e3' | 'g12' | 'g13' | 'g23' | 'nu12' | 'nu13' | 'nu23';
export type CompositeStrengthKey = 'xt' | 'xc' | 'yt' | 'yc' | 's12';
export type MaterialPropertyKey = PropKey | OrthotropicKey | CompositeStrengthKey;
export type OrthotropicProperties = Record<OrthotropicKey, number | null>;
export type CompositeStrength = Record<CompositeStrengthKey, number | null>;
export type MaterialModel = 'Isotropic' | 'Orthotropic';

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
  /** Omitted on legacy records: use the existing isotropic workflow. */
  materialModel?: MaterialModel;
  subCategory?: string;
  /** Complete 3D constants, independent of any future solver card mapping. */
  orthotropic?: OrthotropicProperties;
  compositeStrength?: CompositeStrength;
  density: number | null; // t/mm³
  youngsModulus: number | null; // MPa
  poissonRatio: number | null;
  yieldStress: number | null; // MPa
  etan: number | null; // MPa: supplied MATS1 H. Legacy storage key retained for compatibility.
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

export type View = 'materials' | 'etan' | 'map' | 'compare' | 'density-tuner';
