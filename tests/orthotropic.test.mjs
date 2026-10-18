import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
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
  assert.equal(legacyFR4.id, 'seed-4');
  assert.equal(legacyFR4.category, 'Composite');
  assert.equal(legacyFR4.materialModel, undefined);
  assert.equal(legacyFR4.subCategory, undefined);
  assert.equal(legacyFR4.orthotropic, undefined);
  assert.equal(legacyFR4.compositeStrength, undefined);
  assert.equal(Object.hasOwn(legacyFR4, 'materialModel'), false);
  assert.equal(Object.hasOwn(legacyFR4, 'orthotropic'), false);
  assert.equal(Object.hasOwn(legacyFR4, 'compositeStrength'), false);
  assert.equal(legacyFR4.density, 1.8e-9);
  assert.equal(legacyFR4.youngsModulus, 25000);
  assert.equal(legacyFR4.poissonRatio, 0.35);
  assert.equal(legacyFR4.yieldStress, 196);
  assert.match(ui.form(legacyFR4), /<option value="Isotropic" selected="">Isotropic<\/option><option value="Orthotropic">Orthotropic<\/option>/);
  assert.doesNotMatch(ui.form(legacyFR4), /Isotropic Equivalent/);
  assert.match(ui.drawer(legacyFR4), />Isotropic</);
  assert.doesNotMatch(ui.drawer(legacyFR4), /Isotropic Equivalent/);
  const formHtml = ui.form(legacyFR4);
  assert.ok(formHtml.indexOf('Sub Category') < formHtml.indexOf('Material Model'));
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

test('Orthotropic Form shows density and nine elastic constants without strength or Yield/H/ETAN', () => {
  const html = ui.form(fr4);
  for (const label of ['Density', 'Orthotropic Elastic Properties', 'Shear Modulus', 'PCB Laminate (FR4)', 'through-thickness', 'transverse shear', 'E1', 'E2', 'E3', 'G12', 'G13', 'G23', 'ν12', 'ν13', 'ν23']) assert.ok(html.includes(label), label);
  for (const p of ORTHOTROPIC_PROPS) assert.ok(html.includes(`value="${constants[p.key]}"`), p.key);
  for (const label of ['Yield Stress', 'H (MATS1)', 'Ultimate Stress', 'Elongation', 'ETAN', 'Strength / Failure Properties', 'Xt —', 'Xc —', 'Yt —', 'Yc —', 'S12 —']) assert.ok(!html.includes(label), label);
  assert.equal((html.match(/inputMode="decimal"/g) ?? []).length, 10); // density + 9 elastic constants
  assert.doesNotMatch(ui.form({ ...fr4, category: 'Plastic' }), /Orthotropic Elastic Properties/);
});

test('Metal form keeps Yield/Ultimate/Elongation inputs without manual H; drawer shows calculated H and ETAN', () => {
  const form = ui.form(metal);
  for (const label of ['Yield Stress', 'Ultimate Stress', 'Elongation']) assert.ok(form.includes(label), label);
  assert.ok(!form.includes('H (MATS1)'), 'manual H input is hidden for isotropic materials');
  assert.ok(!ui.form(undefined).includes('H (MATS1)'), 'new materials do not ask for H');
  const drawer = ui.drawer(metal);
  assert.match(drawer, /data-testid="hardening-h-result">740.07<small> MPa/);
  assert.match(drawer, /data-testid="tangent-etan-result">737.34<small> MPa/);
  assert.doesNotMatch(drawer, /740\.06(?!\d)|Stored H/); // Legacy stored H is not used by the drawer.
});

test('Orthotropic Drawer shows density and nine elastic constants and hides stored strengths', () => {
  const html = ui.drawer(fr4);
  for (const text of ['Density', '1.8E-9', '22,000', '4,400', '8,595', '1,720', '0.4', 'E1', 'E2', 'E3', 'G12', 'G13', 'G23', 'ν12', 'ν13', 'ν23']) assert.ok(html.includes(text), text);
  for (const text of ['Yield Stress', 'H (MATS1)', 'ETAN', 'Ultimate Stress', 'Elongation', 'Strength / Failure Properties', 'Xt —', 'Xc —', 'Yt —', 'Yc —', 'S12 —']) assert.ok(!html.includes(text), text);
  assert.doesNotMatch(ui.drawer({ ...fr4, compositeStrength: { xt: null, xc: null, yt: null, yc: null, s12: null } }), /Strength \/ Failure Properties|Xt —|S12 —/);
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
  for (const label of ['Xt —', 'Xc —', 'Yt —', 'Yc —', 'S12 —', 'Strength / Failure Properties']) {
    assert.ok(!all.includes(label), label);
    assert.ok(!mixed.includes(label), label);
  }
  assert.doesNotMatch(html, /Xt —|Strength \/ Failure Properties/);
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

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
  const win = dom.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: win.document });
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: win.HTMLElement });
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: win.Element });
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: win.Node });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  win.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  win.cancelAnimationFrame = (id) => clearTimeout(id);
  return win.document.getElementById('root');
}

function setNativeValue(element, value) {
  const view = element.ownerDocument.defaultView;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  const eventName = element instanceof view.HTMLSelectElement ? 'change' : 'input';
  element.dispatchEvent(new view.Event(eventName, { bubbles: true }));
}

async function saveForm(initial, edit) {
  const rootElement = installDom();
  const { createElement } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const { MaterialForm } = await import('../src/components/MaterialForm.tsx');
  const root = createRoot(rootElement);
  let saved;
  await act(async () => {
    root.render(createElement(MaterialForm, {
      initial,
      existing: [initial],
      onSave: (input) => { saved = input; },
      onClose: () => {},
    }));
  });
  if (edit) await act(async () => { edit(rootElement); });
  await act(async () => {
    const button = [...rootElement.querySelectorAll('button')].find(node => node.textContent === '儲存變更');
    if (!button) throw new Error('save button missing');
    button.click();
  });
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  root.unmount();
  if (!saved) throw new Error('form did not save');
  return saved;
}

test('an Orthotropic edit omits compositeStrength and leaves the stored object unchanged', async () => {
  const { editedMaterial } = await import('../src/lib/supabaseMaterialCommit.ts');
  const { materialToDatabaseRow } = await import('../src/lib/supabaseMaterialWrites.ts');
  const before = structuredClone(fr4);
  const input = await saveForm(before, (root) => {
    const notes = root.querySelector('textarea');
    setNativeValue(notes, 'phase-1 note');
  });
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.equal(input.notes, 'phase-1 note');
  assert.deepEqual(input.orthotropic, constants);
  const saved = editedMaterial(before, input, '2026-10-17T00:00:00.000Z', ui.describeChanges);
  assert.equal(saved.compositeStrength, before.compositeStrength);
  assert.deepEqual(saved.compositeStrength, strength);
  assert.equal(materialToDatabaseRow(saved).composite_strength, before.compositeStrength);
  assert.doesNotMatch(saved.history[0].summary, /Xt|Xc|Yt|Yc|S12/);
  assert.equal(({ ...before, ...input }).compositeStrength, before.compositeStrength);
});

test('switching material model does not clear a hidden compositeStrength object', async () => {
  const { editedMaterial } = await import('../src/lib/supabaseMaterialCommit.ts');
  const { materialToDatabaseRow } = await import('../src/lib/supabaseMaterialWrites.ts');
  const persist = (before, input) => editedMaterial(before, input, '2026-10-17T00:00:00.000Z', ui.describeChanges);
  const before = structuredClone(fr4);
  const selectModel = (root, value) => {
    const model = root.querySelector('select[aria-label="Material Model"]');
    setNativeValue(model, value);
  };
  const toIsotropic = await saveForm(before, (root) => selectModel(root, 'Isotropic'));
  assert.equal(Object.hasOwn(toIsotropic, 'compositeStrength'), false);
  assert.equal(Object.hasOwn(toIsotropic, 'orthotropic'), false);
  assert.equal(toIsotropic.materialModel, 'Isotropic');
  const isotropic = persist(before, toIsotropic);
  assert.equal(isotropic.compositeStrength, before.compositeStrength);
  assert.deepEqual(isotropic.orthotropic, constants);
  assert.equal(isotropic.youngsModulus, before.youngsModulus);
  assert.equal(isotropic.poissonRatio, before.poissonRatio);
  assert.equal(isotropic.yieldStress, before.yieldStress);
  assert.equal(isotropic.ultimateStress, before.ultimateStress);
  assert.equal(isotropic.elongation, before.elongation);
  assert.match(isotropic.history[0].summary, /Material Model: Orthotropic → Isotropic/);

  const isotropicEdit = await saveForm(isotropic, (root) => {
    setNativeValue(root.querySelector('textarea'), 'still hidden');
  });
  assert.equal(Object.hasOwn(isotropicEdit, 'compositeStrength'), false);
  assert.equal(isotropicEdit.materialModel, 'Isotropic');
  const isotropicSaved = persist(isotropic, isotropicEdit);
  assert.equal(isotropicSaved.compositeStrength, before.compositeStrength);
  assert.doesNotMatch(isotropicSaved.history[0].summary, /Material Model/);

  const back = await saveForm(isotropicSaved, (root) => selectModel(root, 'Orthotropic'));
  assert.equal(Object.hasOwn(back, 'compositeStrength'), false);
  assert.equal(back.materialModel, 'Orthotropic');
  assert.deepEqual(back.orthotropic, constants);
  const restored = persist(isotropicSaved, back);
  assert.equal(restored.compositeStrength, before.compositeStrength);
  assert.deepEqual(restored.orthotropic, constants);
  assert.equal(restored.youngsModulus, before.youngsModulus);
  assert.equal(restored.poissonRatio, before.poissonRatio);
  assert.equal(restored.yieldStress, before.yieldStress);
  assert.match(restored.history[0].summary, /Material Model: Isotropic → Orthotropic/);
  assert.equal(materialToDatabaseRow(restored).composite_strength, before.compositeStrength);
  assert.doesNotMatch(restored.history.map(entry => entry.summary).join('\n'), /Xt:|Xc:|Yt:|Yc:|S12:/);
});

test('saved isotropic values survive Orthotropic and return on the way back', async () => {
  const { editedMaterial } = await import('../src/lib/supabaseMaterialCommit.ts');
  const persist = (before, input) => editedMaterial(before, input, '2026-10-17T00:00:00.000Z', ui.describeChanges);
  const selectModel = (root, value) => setNativeValue(root.querySelector('select[aria-label="Material Model"]'), value);
  const before = structuredClone(fr4);
  before.materialModel = 'Isotropic';
  before.youngsModulus = 25100;
  before.poissonRatio = 0.33;
  before.yieldStress = 180;
  before.ultimateStress = 210;
  before.elongation = 1.2;
  const toOrthotropic = await saveForm(before, (root) => selectModel(root, 'Orthotropic'));
  assert.equal(toOrthotropic.youngsModulus, 25100);
  assert.equal(toOrthotropic.poissonRatio, 0.33);
  assert.equal(toOrthotropic.yieldStress, 180);
  assert.equal(toOrthotropic.ultimateStress, 210);
  assert.equal(toOrthotropic.elongation, 1.2);
  assert.deepEqual(toOrthotropic.orthotropic, constants);
  assert.equal(Object.hasOwn(toOrthotropic, 'compositeStrength'), false);
  const orthotropic = persist(before, toOrthotropic);
  const back = await saveForm(orthotropic, (root) => selectModel(root, 'Isotropic'));
  assert.equal(back.youngsModulus, 25100);
  assert.equal(back.poissonRatio, 0.33);
  assert.equal(back.yieldStress, 180);
  assert.equal(Object.hasOwn(back, 'orthotropic'), false);
  const restored = persist(orthotropic, back);
  assert.equal(restored.youngsModulus, 25100);
  assert.equal(restored.poissonRatio, 0.33);
  assert.equal(restored.yieldStress, 180);
  assert.deepEqual(restored.orthotropic, constants);
  assert.equal(restored.compositeStrength, before.compositeStrength);
  assert.notEqual(restored.youngsModulus, restored.orthotropic.e1);
});

test('a legacy Composite edit omits materialModel and does not invent an Isotropic history line', async () => {
  const before = structuredClone(legacyFR4);
  const input = await saveForm(before, (root) => {
    setNativeValue(root.querySelector('textarea'), 'legacy note');
  });
  assert.equal(Object.hasOwn(input, 'materialModel'), false);
  assert.equal(Object.hasOwn(input, 'orthotropic'), false);
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.equal(isOrthotropic(input), false);
  const summary = ui.describeChanges(before, input);
  assert.equal(summary.includes('Material Model'), false);
  assert.doesNotMatch(summary, /Isotropic → Isotropic/);
  const saved = { ...before, ...input };
  assert.equal(Object.hasOwn(saved, 'materialModel'), false);
  assert.equal(isOrthotropic(saved), false);
  assert.equal(Object.hasOwn(legacyFR4, 'materialModel'), false);
});

test('changing a legacy Composite to Orthotropic records a real model change', async () => {
  const before = structuredClone(legacyFR4);
  const input = await saveForm(before, (root) => {
    setNativeValue(root.querySelector('select[aria-label="Material Model"]'), 'Orthotropic');
  });
  assert.equal(input.materialModel, 'Orthotropic');
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.ok(input.orthotropic);
  assert.match(ui.describeChanges(before, input), /Material Model: Isotropic → Orthotropic/);
  const saved = { ...before, ...input };
  assert.equal(saved.materialModel, 'Orthotropic');
  assert.equal(saved.youngsModulus, before.youngsModulus);
  assert.equal(Object.hasOwn(saved, 'compositeStrength'), false);
});
