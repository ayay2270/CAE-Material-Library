import type { Material } from '../types';
import { displayedModel } from './materialProperties';
import { matchesQuery, matchesUpdated, type UpdatedFilter } from './sort';

export type ModelFilter = 'all' | 'Isotropic' | 'Orthotropic';
export { displayedModel };

export function matchesModel(material: Pick<Material, 'category' | 'materialModel'>, filter: ModelFilter): boolean {
  return filter === 'all' || displayedModel(material) === filter;
}

export interface ContextFilters {
  category: string;
  source: string;
  updated: UpdatedFilter;
  query: string;
}

/** Search, category, source, and updated filters. The Model filter is applied afterwards. */
export function materialsBeforeModelFilter(
  materials: readonly Material[],
  filters: ContextFilters,
  labels?: Record<string, string>,
): Material[] {
  return materials.filter(
    (material) =>
      (filters.category === 'all' || material.category === filters.category) &&
      (filters.source === 'all' || material.source === filters.source) &&
      matchesUpdated(material, filters.updated) &&
      matchesQuery(material, filters.query, labels),
  );
}

export function countDisplayedModels(materials: readonly Pick<Material, 'category' | 'materialModel'>[]) {
  let isotropic = 0;
  let orthotropic = 0;
  for (const material of materials) {
    if (displayedModel(material) === 'Orthotropic') orthotropic += 1;
    else isotropic += 1;
  }
  return { all: materials.length, Isotropic: isotropic, Orthotropic: orthotropic };
}
