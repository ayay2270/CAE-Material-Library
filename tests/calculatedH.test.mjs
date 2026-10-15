import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Isotropic H is calculated everywhere; the legacy stored `etan` field is kept but not used as H.
const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { App } from './src/App';
    import { MaterialCards } from './src/components/MaterialCards';
    import { ComparePage } from './src/components/ComparePage';
    export { calculatedH, materialValue } from './src/lib/materialProperties';
    export { calcHardeningSlope } from './src/lib/etan';
    export { sortMaterials } from './src/lib/sort';
    export { curvePoints } from './src/components/StressStrainCurve';
    export { toCsv, csvToMaterials } from './src/lib/csv';
    const noop = () => {};
    const units = { density: 't/mm³', stress: 'MPa' };
    export const library = () => renderToStaticMarkup(<App />);
    export const cards = rows => renderToStaticMarkup(<MaterialCards rows={rows} total={rows.length} selected={[]} units={units} activeId={null} onOpen={noop} onToggle={noop} />);
    export const compare = materials => renderToStaticMarkup(<ComparePage materials={materials} selected={materials.map(m => m.id)} units={units} onToggle={noop} onClear={noop} onBack={noop} onOpen={noop} />);
  `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"', 'process.env.NODE_ENV': '"production"' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;
const raw = await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8');
const database = JSON.parse(raw);
const byName = name => structuredClone(database.materials.find(material => material.name === name));
const sgcc = byName('SGCC');
const al7050 = byName('Al7050');
const fr4 = byName('FR4');
const orthotropic = { ...fr4, ultimateStress: 300, elongation: 2, materialModel: 'Orthotropic', subCategory: 'PCB Laminate (FR4)',
  orthotropic: { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 } };
const shows = (html, number) => new RegExp(number.replace(/[.,]/g, m => `\\${m}`) + '(?!\\d)').test(html);

test('calculatedH reuses the existing bilinear calculation and ignores the legacy stored etan', () => {
  const before = structuredClone(database.materials);
  for (const material of database.materials) {
    assert.equal(ui.calculatedH(material), ui.calcHardeningSlope(material), material.name);
    assert.equal(ui.materialValue(material, 'etan'), ui.calculatedH(material), material.name);
  }
  assert.deepEqual(database.materials, before, 'calculation never writes material data');
  assert.equal(ui.calculatedH(sgcc).toFixed(2), '740.07');
  assert.equal(ui.calculatedH(al7050).toFixed(2), '1196.42');
  assert.equal(al7050.etan, 1205.42, 'legacy stored value is still present in the data');
  assert.equal(ui.calculatedH(fr4), null);
  assert.equal(ui.calculatedH({ ...sgcc, elongation: null }), null, 'stored H is never a fallback');
  assert.equal(ui.calculatedH({ ...sgcc, etan: 99999 }), ui.calculatedH(sgcc));
});

test('Orthotropic composites never get H, even when isotropic fields are present', () => {
  assert.equal(ui.calculatedH(orthotropic), null);
  assert.equal(ui.materialValue(orthotropic, 'etan'), null);
  assert.equal(ui.materialValue(orthotropic, 'yieldStress'), null);
  assert.equal(ui.materialValue(orthotropic, 'e1'), 22000);
  assert.equal(ui.curvePoints(orthotropic), null);
});

test('table, cards and compare display calculated H; the table marks the column as calculated', () => {
  const table = ui.library();
  assert.ok(table.includes('MPa · calculated'));
  for (const html of [table, ui.cards([sgcc, al7050, fr4]), ui.compare([sgcc, al7050, fr4])]) {
    assert.ok(shows(html, '740.07') && shows(html, '1,196.42'), 'calculated H shown');
    assert.ok(!shows(html, '740.06') && !shows(html, '1,205.42'), 'legacy stored H not shown');
  }
});

test('sorting by H uses calculated H, not the stored value', () => {
  const a = { ...sgcc, etan: 99999 };   // calculated 740.07
  const b = { ...al7050, etan: 1 };     // calculated 1196.42
  assert.deepEqual(ui.sortMaterials([b, a], { key: 'etan', dir: 'asc' }).map(m => m.name), ['SGCC', 'Al7050']);
  assert.deepEqual(ui.sortMaterials([a, fr4, b], { key: 'etan', dir: 'desc' }).map(m => m.name), ['Al7050', 'SGCC', 'FR4']);
});

test('simplified stress-strain curve uses calculated H', () => {
  const h = ui.calculatedH(al7050);
  const ey = al7050.yieldStress / al7050.youngsModulus;
  assert.deepEqual(ui.curvePoints(al7050), [{ e: 0, s: 0 }, { e: ey, s: al7050.yieldStress }, { e: ey + (al7050.ultimateStress - al7050.yieldStress) / h, s: al7050.ultimateStress }]);
  assert.deepEqual(ui.curvePoints({ ...al7050, etan: 1 }), ui.curvePoints(al7050), 'stored value has no effect');
  assert.equal(ui.curvePoints({ ...sgcc, elongation: null }), null, 'no curve without the inputs for H');
  assert.equal(ui.curvePoints(fr4), null);
});

test('Phase 1 keeps CSV export semantics: the stored legacy H column round-trips unchanged', () => {
  const csv = ui.toCsv([al7050]);
  assert.ok(csv.includes('H (MATS1) H (MPa)'));
  assert.ok(csv.includes('1205.42'), 'export still carries the stored value');
  assert.equal(ui.csvToMaterials(csv).rows[0].etan, 1205.42);
});
