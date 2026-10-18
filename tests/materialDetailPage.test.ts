import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { materialIdFromSearch, searchWithMaterial } from '../src/lib/detailNavigation';
import type { Material } from '../src/types';

test('detail URL keeps the example flag and does not invent a material id', () => {
  assert.equal(materialIdFromSearch(''), null);
  assert.equal(materialIdFromSearch('?example=fr4-orthotropic'), null);
  assert.equal(materialIdFromSearch('?material=seed-4'), 'seed-4');
  assert.equal(searchWithMaterial('?example=fr4-orthotropic', 'seed-4'), '?example=fr4-orthotropic&material=seed-4');
  assert.equal(materialIdFromSearch(searchWithMaterial('?example=fr4-orthotropic&material=seed-4', null)), null);
  assert.match(searchWithMaterial('?example=fr4-orthotropic&material=seed-4', null), /example=fr4-orthotropic/);
});

test('opening and closing detail does not reset list filters, model filter, or sort', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const table = await readFile(new URL('../src/components/MaterialTable.tsx', import.meta.url), 'utf8');
  const open = app.slice(app.indexOf('const openDetail'), app.indexOf('const closeDetail'));
  const close = app.slice(app.indexOf('const closeDetail'), app.indexOf('const navigate'));
  for (const source of [open, close]) {
    assert.equal(source.includes('setFilters'), false);
    assert.equal(source.includes('setSort'), false);
    assert.equal(source.includes('setQuery'), false);
    assert.equal(source.includes('setLibraryMode'), false);
  }
  assert.match(app, /<MaterialTable[\s\S]*onOpen=\{openDetail\}/);
  assert.match(app, /<MaterialCards[\s\S]*onOpen=\{openDetail\}/);
  assert.match(app, /data-testid="material-detail"|<MaterialDetailPage/);
  assert.equal(app.includes('<MaterialDrawer'), false);
  assert.match(table, /className="col-check sticky s0" onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
  assert.match(table, /className="col-actions" onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
});

const base = {
  density: 1.8e-9,
  youngsModulus: 25000,
  poissonRatio: 0.35,
  yieldStress: 196,
  etan: null,
  ultimateStress: null,
  elongation: null,
  source: 'Provided by Jennifer',
  notes: 'PCB Laminate notes',
  updatedAt: '2026-10-18T14:22:00.000Z',
  history: [{ at: '2026-10-18T14:22:00.000Z', action: 'edited' as const, summary: '更新備註' }],
};

const ortho: Material = {
  ...base,
  id: 'ortho',
  name: 'FR4',
  category: 'Composite',
  materialModel: 'Orthotropic',
  subCategory: 'PCB Laminate (FR4)',
  orthotropic: { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 },
  stressStrainCurve: { points: [{ strain: 0, stress: 0 }, { strain: 0.01, stress: 220 }], definition: 'engineering', strainKind: 'total', source: '', notes: '' },
};
const iso: Material = {
  ...base,
  id: 'sgcc',
  name: 'SGCC',
  category: 'Metal',
  density: 7.82e-9,
  youngsModulus: 200000,
  poissonRatio: 0.3,
  yieldStress: 250,
  ultimateStress: 356,
  elongation: 40,
  source: 'Web',
};

const uiBuild = buildSync({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { IndexContext } from './src/lib/indexes';
      import { MaterialDetailPage } from './src/components/MaterialDetailPage';
      const stored = { categories: [
        { id: 'Metal', label: '金屬', color: '#111111' },
        { id: 'Composite', label: '複合材料', color: '#222222' },
      ], sources: [] };
      const ortho = ${JSON.stringify(ortho)};
      const iso = ${JSON.stringify(iso)};
      const units = { density: 't/mm³', stress: 'MPa' };
      const noop = () => {};
      const page = (material, initialTab) => renderToStaticMarkup(
        <IndexContext.Provider value={stored}>
          <MaterialDetailPage editable materialCrudEnabled material={material} units={units} initialTab={initialTab} onClose={noop} onEdit={noop} onDelete={noop} onSaveCurve={() => null} />
        </IndexContext.Provider>
      );
      export const orthotropic = () => page(ortho, 'props');
      export const isotropic = () => page(iso, 'props');
      export const curve = () => page(ortho, 'curve');
      export const source = () => page(ortho, 'source');
      export const history = () => page(ortho, 'history');
    `,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl' },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.BASE_URL': '"/"',
    'process.env.NODE_ENV': '"production"',
  },
});
const compiled = { exports: {} as Record<string, () => string> };
new Function('require', 'module', 'exports', uiBuild.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;

test('detail page is an in-workspace page with model and category badges', () => {
  const html = ui.orthotropic();
  assert.match(html, /data-testid="material-detail"/);
  assert.equal(html.includes('class="overlay'), false);
  assert.equal(html.includes('drawer'), false);
  assert.match(html, /返回材料庫/);
  assert.match(html, /model-badge is-orthotropic">Orthotropic/);
  assert.match(html, /cat-tag" style="--cat:#a855f7"/);
  assert.match(html, /複合材料/);
  assert.match(html, /編輯/);
  assert.match(html, /更多動作/);
  assert.match(html, /基本性質/);
  assert.match(html, /材料曲線/);
  assert.match(html, /來源與備註/);
  assert.match(html, /歷史記錄/);
});

test('orthotropic detail shows density and nine constants, not inactive isotropic cards', () => {
  const html = ui.orthotropic();
  assert.match(html, /基本資訊/);
  assert.match(html, /1\.8E-9/);
  for (const label of ['E1', 'E2', 'E3', 'G12', 'G13', 'G23', 'ν12', 'ν13', 'ν23']) assert.match(html, new RegExp(label));
  assert.match(html, /22,000/);
  assert.match(html, /4,400/);
  assert.match(html, /8,595/);
  assert.match(html, /1,720/);
  assert.match(html, /Young(?:'|&#x27;)s Modulus \(MPa\)/);
  assert.match(html, /Shear Modulus \(MPa\)/);
  assert.match(html, /Poisson(?:'|&#x27;)s Ratio/);
  assert.equal(html.includes('Moduli'), false);
  assert.equal(html.includes('Ratios'), false);
  assert.match(html, /ν12<\/span><strong>0\.28/);
  assert.match(html, /ν13<\/span><strong>0\.28/);
  assert.match(html, /ν23<\/span><strong>0\.40/);
  assert.equal(html.includes('>v12<'), false);
  assert.equal(html.includes('>v13<'), false);
  assert.equal(html.includes('>v23<'), false);
  assert.match(html, /<img [^>]*alt="1 \(In-plane\), 2 \(In-plane\), 3 \(Through-thickness\)"/);
  assert.equal(html.includes('laminate-top'), false);
  assert.equal(html.includes('axis axis-1'), false);
  assert.match(html, /1 \(In-plane\)/);
  assert.match(html, /2 \(In-plane\)/);
  assert.match(html, /3 \(Through-thickness\)/);
  assert.equal(html.includes('材料方向說明'), false);
  assert.equal(html.includes('>Yield Stress<'), false);
  assert.equal(html.includes('>Ultimate Stress<'), false);
  assert.equal(html.includes('>Elongation<'), false);
  assert.equal(html.includes('Solver Plasticity'), false);
});

test('isotropic detail shows six properties and Solver Plasticity', () => {
  const html = ui.isotropic();
  assert.match(html, /model-badge is-isotropic">Isotropic/);
  assert.match(html, /cat-tag" style="--cat:#3b82f6"/);
  assert.match(html, /金屬/);
  for (const label of ['Density', 'Young', 'Poisson', 'Yield Stress', 'Ultimate Stress', 'Elongation']) {
    assert.ok(html.includes(label), label);
  }
  assert.match(html, /200,000/);
  assert.match(html, /Solver Plasticity/);
  assert.match(html, /data-testid="hardening-h-result"/);
  assert.match(html, /data-testid="tangent-etan-result"/);
  assert.equal(html.includes('>E1<'), false);
});

test('curve, source, and history tabs are reachable', () => {
  const curve = ui.curve();
  assert.match(curve, /Stress–strain curve 資料/);
  assert.match(curve, /應變 \(mm\/mm\)/);
  assert.match(curve, /aria-selected="true"[^>]*>材料曲線/);
  const source = ui.source();
  assert.match(source, /aria-selected="true"[^>]*>來源與備註/);
  assert.match(source, /PCB Laminate notes/);
  assert.match(source, /Provided by Jennifer/);
  const history = ui.history();
  assert.match(history, /aria-selected="true"[^>]*>歷史記錄/);
  assert.match(history, /detail-timeline/);
  assert.match(history, /更新材料資料/);
  assert.match(history, /更新備註/);
});
