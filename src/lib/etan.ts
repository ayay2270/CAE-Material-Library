/**
 * ETAN (tangent modulus) calculation.
 *
 * The formula has not been supplied yet. Implement it in `calcEtan` and the
 * ETAN 算法 page will show the result automatically — no UI changes needed.
 * Return `null` while the formula is missing / the inputs are insufficient.
 */
export interface EtanInputs {
  youngsModulus: number | null; // MPa
  yieldStress: number | null; // MPa
  ultimateStress: number | null; // MPa
  elongation: number | null; // %
}

export const ETAN_FORMULA_READY = false;

export function calcEtan(_inputs: EtanInputs): number | null {
  // TODO: formula to be provided.
  return null;
}
