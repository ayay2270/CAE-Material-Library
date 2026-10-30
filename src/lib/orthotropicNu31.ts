import type { MaterialInput } from '../types';
import { isOrthotropic } from './materialProperties';

/** MAT9OR's default NU31 convention: ν13/E1 = ν31/E3. Never write back to ν13. */
export function calculatedNu31(material: MaterialInput): number | null {
  if (!isOrthotropic(material)) return null;
  const { e1, e3, nu13 } = material.orthotropic ?? {};
  if (typeof e1 !== 'number' || !Number.isFinite(e1) || e1 <= 0
    || typeof e3 !== 'number' || !Number.isFinite(e3) || e3 <= 0
    || typeof nu13 !== 'number' || !Number.isFinite(nu13)) return null;
  const value = nu13 * (e3 / e1);
  return Number.isFinite(value) ? value : null;
}

/** Keep small reciprocal ratios visible and remove binary floating-point noise. */
export function formatNu31(value: number): string {
  return Number(value.toPrecision(12)).toString();
}
