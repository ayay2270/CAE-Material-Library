import type { MaterialInput, MaterialPropertyKey } from '../types';
import { COMPOSITE_STRENGTH_PROPS, ORTHOTROPIC_PROPS, PROPS } from './props';

export function isOrthotropic(material: Pick<MaterialInput, 'category' | 'materialModel'>): boolean {
  return material.category === 'Composite' && material.materialModel === 'Orthotropic';
}

/** Retained inactive-model data must never masquerade as active engineering properties. */
export function materialValue(material: MaterialInput, key: MaterialPropertyKey): number | null {
  const orthotropic = ORTHOTROPIC_PROPS.find(p => p.key === key);
  if (orthotropic) return isOrthotropic(material) ? material.orthotropic?.[orthotropic.key] ?? null : null;
  const strength = COMPOSITE_STRENGTH_PROPS.find(p => p.key === key);
  if (strength) return isOrthotropic(material) ? material.compositeStrength?.[strength.key] ?? null : null;
  const prop = PROPS.find(p => p.key === key)!;
  return isOrthotropic(material) && key !== 'density' ? null : material[prop.key];
}
