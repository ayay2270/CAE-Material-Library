import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { displayedModel } from '../src/lib/materialProperties';
import { countDisplayedModels, matchesModel, materialsBeforeModelFilter } from '../src/lib/modelView';
import { sortMaterials } from '../src/lib/sort';
import type { Material } from '../src/types';

function material(patch: Partial<Material> & Pick<Material, 'id' | 'name' | 'category'>): Material {
  return {
    density: 1,
    youngsModulus: 1,
    poissonRatio: 0.3,
    yieldStress: 1,
    etan: null,
    ultimateStress: null,
    elongation: null,
    source: 'Web',
    notes: '',
    updatedAt: '2026-09-17T00:00:00.000Z',
    history: [],
    ...patch,
  };
}

const legacy = material({ id: 'legacy', name: 'FR4', category: 'Composite', source: 'Legacy data' });
const explicitIso = material({ id: 'iso', name: 'PCB Iso', category: 'Composite', materialModel: 'Isotropic', source: 'Web' });
const ortho = material({
  id: 'ortho',
  name: 'FR4 Orthotropic Example',
  category: 'Composite',
  materialModel: 'Orthotropic',
  source: 'User-provided example',
  youngsModulus: 25000,
});
const metal = material({ id: 'metal', name: 'ADC12', category: 'Metal', source: 'Web' });
const catalog = [legacy, explicitIso, ortho, metal];

test('model badges resolve legacy and explicit models without writing records', () => {
  const before = structuredClone(catalog);
  assert.equal(displayedModel(legacy), 'Isotropic');
  assert.equal(legacy.materialModel, undefined);
  assert.equal(displayedModel(explicitIso), 'Isotropic');
  assert.equal(displayedModel(ortho), 'Orthotropic');
  assert.equal(displayedModel({ ...metal, materialModel: 'Orthotropic' }), 'Isotropic');
  assert.deepEqual(catalog, before);
});

test('model counts are derived and the model filter composes with search, category, and source', () => {
  const context = { category: 'all', source: 'all', updated: 'all' as const, query: '' };
  const all = materialsBeforeModelFilter(catalog, context);
  assert.deepEqual(countDisplayedModels(all), { all: 4, Isotropic: 3, Orthotropic: 1 });

  const composites = materialsBeforeModelFilter(catalog, { ...context, category: 'Composite' });
  assert.deepEqual(countDisplayedModels(composites), { all: 3, Isotropic: 2, Orthotropic: 1 });
  assert.deepEqual(composites.filter((item) => matchesModel(item, 'Orthotropic')).map((item) => item.id), ['ortho']);
  assert.deepEqual(composites.filter((item) => matchesModel(item, 'Isotropic')).map((item) => item.id), ['legacy', 'iso']);
  assert.deepEqual(composites.filter((item) => matchesModel(item, 'all')).map((item) => item.id), ['legacy', 'iso', 'ortho']);

  const searched = materialsBeforeModelFilter(catalog, { ...context, query: 'FR4' });
  assert.deepEqual(countDisplayedModels(searched), { all: 2, Isotropic: 1, Orthotropic: 1 });
  assert.deepEqual(searched.filter((item) => matchesModel(item, 'Isotropic')).map((item) => item.name), ['FR4']);

  const web = materialsBeforeModelFilter(catalog, { ...context, source: 'Web' });
  assert.deepEqual(countDisplayedModels(web), { all: 2, Isotropic: 2, Orthotropic: 0 });
  assert.deepEqual(web.filter((item) => matchesModel(item, 'Orthotropic')), []);

  const snapshot = structuredClone(catalog);
  sortMaterials(catalog.filter((item) => matchesModel(item, 'Orthotropic')), { key: 'model', dir: 'asc' });
  assert.deepEqual(catalog, snapshot);
  assert.equal(legacy.materialModel, undefined);
  assert.equal(ortho.youngsModulus, 25000);
});

const uiBuild = buildSync({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { IndexContext } from './src/lib/indexes';
      import { MaterialTable } from './src/components/MaterialTable';
      const stored = { categories: [
        { id: 'Metal', label: '金屬', color: '#2563eb' },
        { id: 'Composite', label: '複合材料', color: '#813ef4' },
      ], sources: [] };
      const rows = ${JSON.stringify([legacy, explicitIso, ortho, metal])};
      const noop = () => {};
      const units = { density: 't/mm³', stress: 'MPa' };
      export const table = () => renderToStaticMarkup(
        <IndexContext.Provider value={stored}>
          <MaterialTable editable={false} rows={rows} total={rows.length} columns={['name','model','category','youngsModulus']} sort={{key:'name',dir:'asc'}} onSort={noop} selected={[]} onToggle={noop} onClearSelection={noop} onOpen={noop} onEdit={noop} onDelete={noop} units={units} activeId={null} />
        </IndexContext.Provider>
      );
    `,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.BASE_URL': '"/"',
    'process.env.NODE_ENV': '"production"',
  },
});
const compiled = { exports: {} as { table: () => string } };
new Function('require', 'module', 'exports', uiBuild.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);

test('table renders model badges and the orthotropic row class without changing values', () => {
  const html = compiled.exports.table();
  assert.equal(html.match(/model-badge is-isotropic">Isotropic/g)?.length, 3);
  assert.equal(html.match(/model-badge is-orthotropic">Orthotropic/g)?.length, 1);
  assert.equal(html.match(/class="[^"]*row-orthotropic[^"]*"/g)?.length, 1);
  assert.match(html, /FR4 Orthotropic Example/);
  assert.equal(html.includes('row-orthotropic'), true);
  const orthoRow = html.split('row-orthotropic')[1] ?? '';
  assert.match(orthoRow, /class="num missing"/);
  assert.equal(legacy.materialModel, undefined);
});
