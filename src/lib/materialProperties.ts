import type { MaterialInput, MaterialPropertyKey } from '../types';
import { calcHardeningSlope } from './etan';
import { COMPOSITE_STRENGTH_PROPS, ORTHOTROPIC_PROPS, PROPS } from './props';

export function isOrthotropic(material: Pick<MaterialInput, 'category' | 'materialModel'>): boolean {
  return material.category === 'Composite' && material.materialModel === 'Orthotropic';
}

/** Table label. Missing or non-orthotropic models stay Isotropic without writing the record. */
export function displayedModel(material: Pick<MaterialInput, 'category' | 'materialModel'>): 'Isotropic' | 'Orthotropic' {
  return isOrthotropic(material) ? 'Orthotropic' : 'Isotropic';
}

/**
 * Isotropic work hardening slope H (MPa), always calculated from E, Yield Stress, Ultimate Stress
 * and Elongation. The legacy stored `etan` field is kept in the data but never used as H.
 */
export function calculatedH(material: MaterialInput): number | null {
  return isOrthotropic(material) ? null : calcHardeningSlope(material);
}

/** Retained inactive-model data must never masquerade as active engineering properties. */
export function materialValue(material: MaterialInput, key: MaterialPropertyKey): number | null {
  const orthotropic = ORTHOTROPIC_PROPS.find(p => p.key === key);
  if (orthotropic) return isOrthotropic(material) ? material.orthotropic?.[orthotropic.key] ?? null : null;
  const strength = COMPOSITE_STRENGTH_PROPS.find(p => p.key === key);
  if (strength) return isOrthotropic(material) ? material.compositeStrength?.[strength.key] ?? null : null;
  const prop = PROPS.find(p => p.key === key)!;
  if (isOrthotropic(material) && key !== 'density') return null;
  return prop.calculated ? calculatedH(material) : material[prop.key];
}
