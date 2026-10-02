import type { PropKey } from '../types';

export interface PropDef {
  key: PropKey;
  symbol: string;
  /** English property name — kept English everywhere in the UI. */
  label: string;
  unit: string;
  optional?: boolean;
}

// Order matches the default table columns.
export const PROPS: PropDef[] = [
  { key: 'density', symbol: 'ρ', label: 'Density', unit: 't/mm³' },
  { key: 'youngsModulus', symbol: 'E', label: "Young's Modulus", unit: 'MPa' },
  { key: 'poissonRatio', symbol: 'ν', label: "Poisson's Ratio", unit: '—' },
  { key: 'yieldStress', symbol: 'σy', label: 'Yield Stress', unit: 'MPa' },
  { key: 'etan', symbol: 'Et', label: 'ETAN', unit: 'MPa', optional: true },
  { key: 'ultimateStress', symbol: 'σu', label: 'Ultimate Stress', unit: 'MPa' },
  { key: 'elongation', symbol: 'ε', label: 'Elongation', unit: '%', optional: true },
];
