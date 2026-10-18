import { validateDatabase, type MasterDatabase } from './database-schema.mjs';
import { deriveIndexes } from './indexes';

export const EXAMPLE_QUERY = 'example=fr4-orthotropic';
export const EXAMPLE_ID = 'example-fr4-orthotropic';
export const EXAMPLE_STORAGE_KEY = 'cae-material-library:fr4-example:v1';
export const isOrthotropicExample = (search: string) => new URLSearchParams(search).get('example') === 'fr4-orthotropic';

/** A separate copy: never convert or overwrite the legacy FR4 record. */
export function createOrthotropicExample(master: MasterDatabase): MasterDatabase {
  const database = JSON.parse(JSON.stringify(master)) as MasterDatabase;
  const legacy = database.materials.find(m => m.name === 'FR4');
  database.materials.push({
    id: EXAMPLE_ID, name: 'FR4 Orthotropic Example', category: 'Composite',
    subCategory: 'PCB Laminate (FR4)', materialModel: 'Orthotropic',
    density: legacy?.density ?? null,
    youngsModulus: legacy?.youngsModulus ?? null,
    poissonRatio: legacy?.poissonRatio ?? null,
    yieldStress: legacy?.yieldStress ?? null,
    etan: legacy?.etan ?? null,
    ultimateStress: legacy?.ultimateStress ?? null,
    elongation: legacy?.elongation ?? null,
    orthotropic: { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 },
    source: 'User-provided example',
    notes: '獨立操作範例，非確認的材料規格。等向性基準沿用原 FR4 資料，尚未另行確認。',
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
