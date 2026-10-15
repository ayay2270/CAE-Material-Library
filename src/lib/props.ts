import type { CompositeStrengthKey, MaterialPropertyKey, OrthotropicKey, PropKey } from '../types';

export interface PropDef<K extends MaterialPropertyKey = PropKey> {
  key: K;
  symbol: string;
  /** English property name — kept English everywhere in the UI. */
  label: string;
  unit: string;
  optional?: boolean;
  /** Displayed value is calculated (see materialValue); the stored field is legacy data only. */
  calculated?: boolean;
}

// Order matches the default table columns.
export const PROPS: PropDef[] = [
  { key: 'density', symbol: 'ρ', label: 'Density', unit: 't/mm³' },
  { key: 'youngsModulus', symbol: 'E', label: "Young's Modulus", unit: 'MPa' },
  { key: 'poissonRatio', symbol: 'ν', label: "Poisson's Ratio", unit: '—' },
  { key: 'yieldStress', symbol: 'σy', label: 'Yield Stress', unit: 'MPa' },
  { key: 'etan', symbol: 'H', label: 'H (MATS1)', unit: 'MPa', calculated: true },
  { key: 'ultimateStress', symbol: 'σu', label: 'Ultimate Stress', unit: 'MPa' },
  { key: 'elongation', symbol: 'ε', label: 'Elongation', unit: '%', optional: true },
];

export const ORTHOTROPIC_GROUPS: { label: string; props: PropDef<OrthotropicKey>[] }[] = [
  { label: "Young's Modulus", props: ['e1', 'e2', 'e3'].map(key => ({ key: key as OrthotropicKey, symbol: key.toUpperCase(), label: key.toUpperCase(), unit: 'MPa' })) },
  { label: 'Shear Modulus', props: ['g12', 'g13', 'g23'].map(key => ({ key: key as OrthotropicKey, symbol: key.toUpperCase(), label: key.toUpperCase(), unit: 'MPa' })) },
  { label: "Poisson's Ratio", props: ['nu12', 'nu13', 'nu23'].map(key => ({ key: key as OrthotropicKey, symbol: key.replace('nu', 'ν'), label: key.replace('nu', 'ν'), unit: '—' })) },
];
export const ORTHOTROPIC_PROPS = ORTHOTROPIC_GROUPS.flatMap(group => group.props);
export const COMPOSITE_STRENGTH_PROPS: PropDef<CompositeStrengthKey>[] = [
  { key: 'xt', symbol: 'Xt', label: 'Xt — 1-direction tensile strength', unit: 'MPa', optional: true },
  { key: 'xc', symbol: 'Xc', label: 'Xc — 1-direction compressive strength', unit: 'MPa', optional: true },
  { key: 'yt', symbol: 'Yt', label: 'Yt — 2-direction tensile strength', unit: 'MPa', optional: true },
  { key: 'yc', symbol: 'Yc', label: 'Yc — 2-direction compressive strength', unit: 'MPa', optional: true },
  { key: 's12', symbol: 'S12', label: 'S12 — in-plane shear strength', unit: 'MPa', optional: true },
];
export const COMPOSITE_SUBCATEGORIES = ['PCB Laminate (FR4)', 'GFRP', 'CFRP', 'Other Composite'] as const;
