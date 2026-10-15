import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { validateDatabase } from '../src/lib/database-schema.mjs';
import { parseFileDatabase, readDatabaseFile, saveDatabaseFile } from '../src/lib/browserDatabase.ts';
import { csvToMaterials, parseCsv, toCsv } from '../src/lib/csv.ts';
import { materialValue, isOrthotropic } from '../src/lib/materialProperties.ts';
import { formatValue, unitFor } from '../src/lib/format.ts';
import { ORTHOTROPIC_PROPS } from '../src/lib/props.ts';
import { createDatabaseStore } from '../server/database-store.mjs';

const raw = await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8');
const database = validateDatabase(JSON.parse(raw));
const legacyFR4 = database.materials.find(m => m.name === 'FR4');
const metal = database.materials.find(m => m.name === 'SGCC');
const constants = { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 };
const strength = { xt: 300, xc: 400, yt: 250, yc: null, s12: 100 };
const fr4 = { ...legacyFR4, materialModel: 'Orthotropic', subCategory: 'PCB Laminate (FR4)', orthotropic: constants, compositeStrength: strength };
const withFR4 = m => ({ ...structuredClone(database), materials: [structuredClone(m)] });
const units = { density: 't/mm³', stress: 'MPa' };

const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup as render } from 'react-dom/server';
    import { MaterialForm } from './src/components/MaterialForm';
    import { MaterialDrawer } from './src/components/MaterialDrawer';
    import { MaterialCards } from './src/components/MaterialCards';
    import { ComparePage } from './src/components/ComparePage';
    import { EtanPage } from './src/components/EtanPage';
    export { describeChanges } from './src/lib/storage';
    const noop = () => {};
    const units = {density:'t/mm³',stress:'MPa'};
    export const form = material => render(<MaterialForm initial={material} existing={[material]} onSave={noop} onClose={noop} />);
    export const drawer = material => render(<MaterialDrawer editable material={material} units={units} onSaveCurve={()=>null} onClose={noop} onEdit={noop} onDelete={noop} />);
    export const cards = rows => render(<MaterialCards rows={rows} total={rows.length} selected={[]} units={units} activeId={null} onOpen={noop} onToggle={noop} />);
    export const compare = materials => render(<ComparePage materials={materials} selected={materials.map(m=>m.id)} units={units} onToggle={noop} onClear={noop} onBack={noop} onOpen={noop} />);
    export const etan = materials => render(<EtanPage materials={materials} />);
  `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"', 'process.env.NODE_ENV': '"production"' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;

test('legacy Metal and FR4 load schema v1 unchanged; Composite alone never implies Orthotropic', () => {
  assert.deepEqual(parseFileDatabase(raw), database);
  assert.equal(isOrthotropic(metal), false);
  assert.equal(isOrthotropic(legacyFR4), false);
  assert.equal(legacyFR4.materialModel, undefined);
  assert.equal(legacyFR4.density, 1.8e-9);
  assert.equal(legacyFR4.youngsModulus, 25000);
  assert.equal(legacyFR4.poissonRatio, 0.35);
  assert.equal(legacyFR4.yieldStress, 196);
  assert.match(ui.form(legacyFR4), /Isotropic Equivalent/);
  assert.match(ui.form(legacyFR4), /Yield Stress/);
  assert.doesNotMatch(ui.form(legacyFR4), /Orthotropic Elastic Properties/);
});

test('all nine FR4 constants and optional strengths survive validated JSON serialize/reload', () => {
  const reloaded = parseFileDatabase(JSON.stringify(withFR4(fr4)));
  assert.deepEqual(reloaded.materials[0], fr4);
  assert.equal(reloaded.schemaVersion, 1);
  assert.equal(reloaded.materials[0].density, legacyFR4.density);
});

test('unknown constants are nullable, not zero; ν may exceed isotropic bounds or be negative', () => {
  const m = { ...fr4, orthotropic: { ...constants, e3: null, nu12: -0.2, nu13: 0.8 }, compositeStrength: undefined };
  delete m.compositeStrength;
  assert.deepEqual(validateDatabase(withFR4(m)).materials[0], m);
  assert.equal(materialValue(m, 'e3'), null);
  assert.equal(formatValue('e3', null, units), '—');
});

test('invalid E/G, nonfinite ν, malformed groups/models are rejected without tightening stability constraints', () => {
  for (const [key, value] of [['e1', 0], ['e3', -1], ['g12', -10], ['nu23', Infinity], ['nu13', '0.2']]) {
    assert.throws(() => validateDatabase(withFR4({ ...fr4, orthotropic: { ...constants, [key]: value } })));
  }
  for (const bad of [{ ...fr4, orthotropic: null }, { ...fr4, materialModel: 'unknown' }, { ...fr4, orthotropic: { e1: 22000 } }]) {
    assert.throws(() => validateDatabase(withFR4(bad)));
  }
});

test('old CSV including legacy ETAN header still imports without creating extension data', () => {
  const imported = csvToMaterials('Name,Category,Young\'s Modulus,Yield Stress,ETAN,Poisson\'s Ratio\nSGCC,Metal,200000,250,740.06,0.3\nFR4,Composite,25000,196,,0.35');
  assert.deepEqual(imported.errors, []);
  assert.equal(imported.rows.length, 2);
  assert.equal(imported.rows[0].etan, 740.06);
  assert.equal(imported.rows[1].youngsModulus, 25000);
  for (const row of imported.rows) {
    assert.equal(row.materialModel, undefined);
    assert.equal(row.orthotropic, undefined);
    assert.equal(row.compositeStrength, undefined);
  }
});

test('Orthotropic CSV exports flat columns and imports all constants, strengths, metadata and density', () => {
  const csv = toCsv([{ ...fr4, notes: 'PCB, laminate\nFull 3D data' }]);
  const header = parseCsv(csv)[0];
  for (const name of ['Material Model', 'Sub Category', 'E1', 'E2', 'E3', 'G12', 'G13', 'G23', 'NU12', 'NU13', 'NU23', 'Xt', 'Xc', 'Yt', 'Yc', 'S12']) assert.ok(header.includes(name), name);
  const { rows, errors } = csvToMaterials(csv);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows[0].orthotropic, constants);
  assert.deepEqual(rows[0].compositeStrength, strength);
  assert.equal(rows[0].materialModel, 'Orthotropic');
  assert.equal(rows[0].subCategory, 'PCB Laminate (FR4)');
  assert.equal(rows[0].density, legacyFR4.density);
  assert.equal(rows[0].notes, 'PCB, laminate\nFull 3D data');
});

test('new CSV accepts blanks and Isotropic Equivalent alias; invalid constants cannot overwrite a row', () => {
  const blank = csvToMaterials('Name,Category,Material Model,E1,G13,NU23,Xt\nFR4,Composite,Orthotropic,22000,,0.4,');
  assert.equal(blank.rows[0].orthotropic.g13, null);
  assert.equal(blank.rows[0].compositeStrength.xt, null);
  assert.equal(csvToMaterials('Name,Material Model\nFR4,Isotropic Equivalent').rows[0].materialModel, 'Isotropic');
  for (const value of ['0', '-2', 'Infinity', 'bad']) {
    const invalid = csvToMaterials(`Name,Category,Material Model,G13\nFR4,Composite,Orthotropic,${value}`);
    assert.equal(invalid.rows.length, 0);
    assert.equal(invalid.errors.length, 1);
  }
});

test('E1-only and strength-only edits are detected by the actual CSV update change detector', () => {
  assert.match(ui.describeChanges(fr4, { ...fr4, orthotropic: { ...constants, e1: 23000 } }), /E1: 22,000 → 23,000/);
  assert.match(ui.describeChanges(fr4, { ...fr4, compositeStrength: { ...strength, xt: 350 } }), /Xt: 300 → 350/);
  const { materialModel, subCategory, orthotropic, compositeStrength, ...oldCsvRow } = fr4;
  assert.equal(ui.describeChanges(fr4, oldCsvRow), '無欄位變更');
});

test('Orthotropic Form has nine constants and optional strengths without E/ν or Yield/H/ETAN', () => {
  const html = ui.form(fr4);
  for (const label of ['Orthotropic Elastic Properties', 'Shear Modulus', 'Strength / Failure Properties', 'PCB Laminate (FR4)', 'through-thickness', 'transverse shear']) assert.ok(html.includes(label), label);
  for (const p of ORTHOTROPIC_PROPS) assert.ok(html.includes(`value="${constants[p.key]}"`), p.key);
  for (const label of ['Yield Stress', 'H (MATS1)', 'Ultimate Stress', 'Elongation', 'ETAN']) assert.ok(!html.includes(label), label);
  assert.equal((html.match(/inputMode="decimal"/g) ?? []).length, 15); // density + 9 constants + 5 strengths
  assert.doesNotMatch(ui.form({ ...fr4, category: 'Plastic' }), /Orthotropic Elastic Properties/);
});

test('Metal keeps original Yield/H inputs and drawer ETAN results', () => {
  const form = ui.form(metal);
  for (const label of ['Yield Stress', 'H (MATS1)', 'Ultimate Stress', 'Elongation']) assert.ok(form.includes(label));
  assert.match(ui.drawer(metal), /737.33 MPa/);
  assert.match(ui.drawer(metal), /740.06 MPa/);
});

test('Orthotropic Drawer shows density and complete constants, conditionally shows strengths', () => {
  const html = ui.drawer(fr4);
  for (const text of ['Density', '1.8E-9', '22,000', '4,400', '8,595', '1,720', '0.4', 'ν13', 'ν23', 'Strength / Failure Properties']) assert.ok(html.includes(text), text);
  for (const text of ['Yield Stress', 'H (MATS1)', 'ETAN', 'Ultimate Stress', 'Elongation']) assert.ok(!html.includes(text), text);
  assert.doesNotMatch(ui.drawer({ ...fr4, compositeStrength: { xt: null, xc: null, yt: null, yc: null, s12: null } }), /Strength \/ Failure Properties/);
});

test('Cards stay compact and compare supports all-Orthotropic and mixed materials with missing values', () => {
  const html = ui.cards([fr4]);
  for (const symbol of ['ρ', 'E1', 'E2', 'E3', 'G12']) assert.ok(html.includes(`<dt>${symbol}</dt>`));
  assert.doesNotMatch(html, /<dt>G13<\/dt>|Yield Stress/);
  const all = ui.compare([fr4, { ...fr4, id: 'fr4-2' }]);
  const mixed = ui.compare([metal, fr4]);
  for (const p of ORTHOTROPIC_PROPS) {
    assert.ok(all.includes(p.label));
    assert.ok(mixed.includes(p.label));
  }
  assert.doesNotMatch(all, /Yield Stress/);
  assert.match(mixed, /Yield Stress/);
  assert.match(mixed, /missing/);
  assert.equal(materialValue(fr4, 'youngsModulus'), null);
  assert.equal(materialValue(metal, 'e1'), null);
  assert.doesNotMatch(ui.etan([metal, fr4]), /<option value="seed-4">/);
});

test('Orthotropic display obeys MPa/GPa preferences while ν remains dimensionless', () => {
  const gpa = { ...units, stress: 'GPa' };
  assert.equal(formatValue('e1', 22000, gpa), '22');
  assert.equal(formatValue('g12', 8595, gpa), '8.595');
  assert.equal(formatValue('nu23', 0.4, gpa), '0.4');
  assert.equal(unitFor(ORTHOTROPIC_PROPS[0], gpa), 'GPa');
  assert.equal(unitFor(ORTHOTROPIC_PROPS[6], gpa), '—');
});

test('real local server store saves and reloads complete Orthotropic groups with unknown metadata', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cae-orthotropic-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src/data'), { recursive: true });
  await writeFile(join(root, 'src/data/materials.json'), raw);
  const store = createDatabaseStore(root);
  const { revision } = await store.read();
  const modified = withFR4({ ...fr4, orthotropic: { ...constants, futureMetadata: 'preserved' } });
  await store.save(modified, revision);
  assert.deepEqual((await store.read()).database, modified);
});

test('browser file save, edit, serialize/re-read round-trip preserves all nine constants and strengths', async () => {
  let text = raw;
  const handle = { kind: 'file', name: 'materials.json', queryPermission: async () => 'granted',
    getFile: async () => ({ text: async () => text }),
    createWritable: async () => { let pending; return { write: async value => { pending = value; }, close: async () => { text = pending; }, abort: async () => {} }; },
  };
  const created = await saveDatabaseFile(await readDatabaseFile(handle), withFR4(fr4));
  assert.deepEqual(created.database.materials[0], fr4);
  const edited = withFR4({ ...fr4, orthotropic: { ...constants, e3: 4500 } });
  await saveDatabaseFile(created, edited);
  assert.deepEqual((await readDatabaseFile(handle)).database, edited);
});
