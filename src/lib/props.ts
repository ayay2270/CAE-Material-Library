import type { Material, PropKey } from '../types';

export interface PropDef {
  key: PropKey;
  symbol: string;
  label: string;
  unit: string;
  optional?: boolean;
  /** Short note shown in the header when the property is optional. */
  group: 'basic' | 'supplemental';
}

// Order matches the table columns.
export const PROPS: PropDef[] = [
  { key: 'density', symbol: 'ρ', label: 'Density', unit: 't/mm³', group: 'basic' },
  { key: 'youngsModulus', symbol: 'E', label: "Young's Modulus", unit: 'MPa', group: 'basic' },
  { key: 'poissonRatio', symbol: 'ν', label: "Poisson's Ratio", unit: '—', group: 'basic' },
  { key: 'yieldStress', symbol: 'σy', label: 'Yield Stress', unit: 'MPa', group: 'basic' },
  { key: 'etan', symbol: 'Et', label: 'ETAN', unit: 'MPa', optional: true, group: 'supplemental' },
  { key: 'ultimateStress', symbol: 'σu', label: 'Ultimate Stress', unit: 'MPa', group: 'basic' },
  { key: 'elongation', symbol: 'ε', label: 'Elongation', unit: '%', optional: true, group: 'supplemental' },
];

export const PROP_COUNT = PROPS.length;

export function filledCount(m: Material): number {
  return PROPS.filter((p) => m[p.key] !== null).length;
}
