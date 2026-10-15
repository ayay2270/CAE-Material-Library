import { validateDatabase, type MasterDatabase } from './database-schema.mjs';
import { deriveIndexes } from './indexes';

export const EXAMPLE_QUERY = 'example=fr4-orthotropic';
export const EXAMPLE_ID = 'example-fr4-orthotropic';
export const EXAMPLE_STORAGE_KEY = 'cae-material-library:fr4-example:v1';
export const isOrthotropicExample = (search: string) => new URLSearchParams(search).get('example') === 'fr4-orthotropic';

/** A separate copy: never convert or overwrite the legacy FR4 record. */
export function createOrthotropicExample(master: MasterDatabase): MasterDatabase {
  const database = JSON.parse(JSON.stringify(master)) as MasterDatabase;
  database.materials.push({
    id: EXAMPLE_ID, name: 'FR4 Orthotropic Example', category: 'Composite',
    subCategory: 'PCB Laminate (FR4)', materialModel: 'Orthotropic',
    density: master.materials.find(m => m.name === 'FR4')?.density ?? null,
    youngsModulus: null, poissonRatio: null, yieldStress: null, etan: null,
    ultimateStress: null, elongation: null,
    orthotropic: { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 },
    compositeStrength: { xt: null, xc: null, yt: null, yc: null, s12: null },
    source: 'User-provided example',
    notes: '獨立操作範例，非確認的材料規格。Density 沿用原 FR4 資料，尚未另行確認。',
    updatedAt: '2026-10-15T00:00:00Z',
    history: [{ at: '2026-10-15T00:00:00Z', action: 'created', summary: '使用者提供的 Orthotropic 範例；原 FR4 保留不變。' }],
  });
  database.indexes = deriveIndexes(database.materials, database.indexes);
  return validateDatabase(database);
}

type ExampleStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readOrthotropicExample(master: MasterDatabase, storage: ExampleStorage): MasterDatabase {
  try {
    const text = storage.getItem(EXAMPLE_STORAGE_KEY);
    if (text) return validateDatabase(JSON.parse(text));
  } catch { /* A blocked/corrupt sandbox never prevents opening the supplied example. */ }
  return createOrthotropicExample(master);
}
export function saveOrthotropicExample(database: MasterDatabase, storage: ExampleStorage): void {
  storage.setItem(EXAMPLE_STORAGE_KEY, JSON.stringify(validateDatabase(database)));
}
