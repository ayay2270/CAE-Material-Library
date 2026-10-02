import type { Material } from '../types';

type Row = Omit<Material, 'id' | 'history' | 'updatedAt' | 'notes'> & { at: string; notes?: string };

// Values transcribed from the selected design mockup. Cells that were empty
// in the mockup stay null (rendered as "—"); nothing is estimated.
const rows: Row[] = [
  { name: 'ADC12', category: 'Metal', density: 2.82e-9, youngsModulus: 71000, poissonRatio: 0.3, yieldStress: 165, etan: 8002.05, ultimateStress: 336, elongation: 2.5, source: 'Web', at: '2026-09-17T15:17:00' },
  { name: 'Al7050', category: 'Metal', density: 2.7e-9, youngsModulus: 71000, poissonRatio: 0.33, yieldStress: 393, etan: 1205.42, ultimateStress: 468, elongation: 12, source: 'Web', at: '2026-09-18T14:37:00' },
  { name: 'ChipSet', category: 'Others', density: 1.2e-9, youngsModulus: 30000, poissonRatio: 0.3, yieldStress: null, etan: null, ultimateStress: null, elongation: null, source: 'Provided by Jennifer', at: '2026-09-17T16:08:00' },
  { name: 'FR4', category: 'Composite', density: 1.8e-9, youngsModulus: 25000, poissonRatio: 0.35, yieldStress: 196, etan: null, ultimateStress: null, elongation: null, source: 'Legacy data', at: '2026-09-18T14:38:00' },
  { name: 'PC-ABS', category: 'Plastic', density: 1.18e-9, youngsModulus: 2700, poissonRatio: 0.3, yieldStress: 64, etan: 107.17, ultimateStress: 70, elongation: 80, source: 'Web', at: '2026-09-17T15:51:00' },
  { name: 'Rubber', category: 'Elastomer', density: 5e-10, youngsModulus: 500, poissonRatio: 0.3, yieldStress: null, etan: null, ultimateStress: null, elongation: null, source: 'Provided by Jennifer', at: '2026-09-17T16:06:00' },
  { name: 'SGCC', category: 'Metal', density: 7.82e-9, youngsModulus: 200000, poissonRatio: 0.3, yieldStress: 250, etan: 740.06, ultimateStress: 356, elongation: 40, source: 'Web', at: '2026-09-18T14:37:00' },
  { name: 'SUS304 0H', category: 'Metal', density: 7.82e-9, youngsModulus: 193000, poissonRatio: 0.3, yieldStress: 205, etan: 1558.63, ultimateStress: 520, elongation: 40, source: 'Web', at: '2026-09-17T15:18:00' },
  { name: 'SUS304 1/2H', category: 'Metal', density: 7.89e-9, youngsModulus: 193000, poissonRatio: 0.29, yieldStress: 760, etan: 5405.07, ultimateStress: 1035, elongation: 7, source: 'Web', at: '2026-09-17T15:50:00' },
  { name: 'ZAMAK3', category: 'Metal', density: 6.6e-9, youngsModulus: 96000, poissonRatio: 0.3, yieldStress: 221, etan: 965.38, ultimateStress: 283, elongation: 10, source: 'Web', at: '2026-09-17T15:50:00' },
  { name: 'ZAMAK5', category: 'Metal', density: 6.6e-9, youngsModulus: 96000, poissonRatio: 0.3, yieldStress: 295, etan: 902.04, ultimateStress: 331, elongation: 7, source: 'Web', at: '2026-09-17T15:51:00' },
];

export function seedMaterials(): Material[] {
  return rows.map(({ at, notes, ...rest }, i) => ({
    ...rest,
    id: `seed-${i + 1}`,
    notes: notes ?? '',
    updatedAt: at,
    history: [{ at, action: 'created', summary: 'Sample record seeded from design mockup' }],
  }));
}
