import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Render the real components in production mode; reuse existing tooling/dependencies.
const result = await build({
  stdin: { contents: `
    import React from 'react';
    import { renderToStaticMarkup } from 'react-dom/server';
    import { App } from './src/App';
    import { SolverPlasticityResults } from './src/components/SolverPlasticityResults';
    import { ImportExportDialog } from './src/components/Dialogs';
    import { MaterialDrawer } from './src/components/MaterialDrawer';
    import { LocalEditingDialog } from './src/components/LocalEditingDialog';
    export { requestLocalEditing } from './src/lib/localEditing';
    export { calcHardeningSlope } from './src/lib/etan';
    export { hToEtan } from './src/lib/solverPlasticity';
    export const library = () => renderToStaticMarkup(<App />);
    export const solver = inputs => renderToStaticMarkup(<SolverPlasticityResults inputs={inputs} />);
    export const imports = (database, editable, dirty = false) => renderToStaticMarkup(<ImportExportDialog editable={editable} dirty={dirty} database={database} materials={database.materials} visibleRows={database.materials} onImport={()=>({added:0,updated:0,unchanged:0})} onReset={()=>{}} onRecover={()=>{}} onLegacy={()=>{}} onReadOnly={()=>{}} onClose={()=>{}} />);
    export const drawer = material => renderToStaticMarkup(<MaterialDrawer editable={false} material={material} units={{density:'t/mm3',stress:'MPa'}} onClose={()=>{}} onEdit={()=>{}} onDelete={()=>{}} onSaveCurve={()=>null} />);
    export const guidance = supported => renderToStaticMarkup(<LocalEditingDialog supported={supported} permissionNeeded={false} onConnect={()=>{}} onClose={()=>{}} />);
  `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'tsx' },
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl' },
  define: { 'import.meta.env.DEV': 'false', 'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"', 'process.env.NODE_ENV': '"production"' },
});
const compiled = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;
const database = JSON.parse(await readFile(new URL('../src/data/materials.json', import.meta.url), 'utf8'));
const sgcc = database.materials.find(material => material.name === 'SGCC');

test('ETAN page solver results use calculated H for real SGCC, with full substituted steps', () => {
  const html = ui.solver(sgcc);
  for (const text of ['740.07 MPa', '737.34 MPa', 'Calculated from Young&#x27;s Modulus, Yield Stress, Ultimate Stress and Elongation.', 'Engineering strains', 'True stresses', 'True strains', '250 × (1 + 0.00125)', '356 × (1 + 0.4)', 'ln(1 + 0.00125)', 'ln(1 + 0.4)', '498.4 − 250.3125', 'ETAN = 737.34 MPa', 'Formula Reference']) assert.ok(html.includes(text), text);
  for (const legacy of ['Stored', 'stored', 'reference only', 'Estimate', 'H source']) assert.ok(!html.includes(legacy), legacy);
  assert.ok(!/740\.06(?!\d)|737\.33(?!\d)/.test(html), 'legacy stored H result is not shown');
});

test('ETAN page solver results explain missing inputs instead of falling back to stored H', () => {
  const incomplete = ui.solver({ ...sgcc, elongation: null });
  assert.ok(incomplete.includes('H unavailable'));
  assert.ok(incomplete.includes('ETAN unavailable'));
  assert.ok(incomplete.includes('Enter valid material values'));
  assert.ok(!incomplete.includes('etan-auto-steps'));
});

const byName = name => database.materials.find(material => material.name === name);
const testIdText = (html, id) => html.match(new RegExp(`data-testid="${id}"[^>]*>(.*?)</(?:strong|td)>`))[1].replace(/<[^>]+>/g, '');
const solverText = html => html.slice(html.indexOf('class="solver-bridge"'), html.indexOf('<details')).replace(/<[^>]+>/g, ' ');

test('drawer Basic Properties: open 3 × 2 grid without H; H and ETAN are calculated, never stored', () => {
  for (const name of ['SGCC', 'Al7050']) {
    const material = byName(name);
    const html = ui.drawer(material);
    const grid = html.slice(html.indexOf('prop-grid'), html.indexOf('</dl>'));
    assert.deepEqual([...grid.matchAll(/<dt>(.*?)<\/dt>/g)].map(m => m[1]), ['Density', 'Young&#x27;s Modulus', 'Poisson&#x27;s Ratio', 'Yield Stress', 'Ultimate Stress', 'Elongation']);
    const h = ui.calcHardeningSlope(material);
    assert.notEqual(h.toFixed(2), material.etan.toFixed(2), `${name}: the legacy stored H must differ for this check`);
    assert.equal(testIdText(html, 'hardening-h-result'), `${h.toFixed(2)} MPa`);
    assert.equal(testIdText(html, 'tangent-etan-result'), `${ui.hToEtan(material.youngsModulus, h).toFixed(2)} MPa`);
    for (const legacy of ['Stored', 'stored', 'reference only', 'Estimate', 'mismatch']) assert.ok(!html.includes(legacy), `${name}: ${legacy}`);
    assert.ok(!new RegExp(material.etan.toFixed(2).replace('.', '\\.') + '(?!\\d)').test(html), `${name}: legacy stored H value is not shown`);
    const solver = solverText(html);
    for (const text of ['Solver Plasticity', 'Calculated from material properties', 'OptiStruct', 'MAT1 + MATS1', 'LS-DYNA', '*MAT_003', 'Work hardening slope', 'Tangent modulus', 'ETAN = E × H / (E + H)']) assert.ok(solver.includes(text), text);
    assert.ok(!solver.includes('⚠') && !solver.includes('Not available'), `${name}: no warning for a normal calculation`);
    assert.equal((html.match(/class="solver-bridge-status">Calculated</g) ?? []).length, 2, `${name}: Calculated under H and ETAN`);
    assert.ok(!html.includes('<details class="etan-auto-details" open'), 'details stay collapsed');
  }
  assert.equal(testIdText(ui.drawer(byName('SGCC')), 'hardening-h-result'), '740.07 MPa');
  assert.equal(testIdText(ui.drawer(byName('Al7050')), 'hardening-h-result'), '1196.42 MPa');
  assert.equal(testIdText(ui.drawer(byName('Al7050')), 'tangent-etan-result'), '1176.59 MPa');
});

test('drawer solver mapping pairs equivalent OptiStruct and LS-DYNA fields on the same row', () => {
  const html = ui.drawer(byName('SGCC'));
  const rows = [...html.matchAll(/<tr class="[^"]*"><th scope="row">(\w+)<\/th><td class="value">([^<]*)<\/td><td class="unit">([^<]*)<\/td><td aria-hidden="true"><\/td><th scope="row">(\w+)<\/th><td class="value"[^>]*>([^<]*)<\/td>/g)]
    .map(([, os, osValue, unit, dyna, dynaValue]) => [os, osValue, unit, dyna, dynaValue]);
  assert.deepEqual(rows, [
    ['E', '200,000', 'MPa', 'E', '200,000'], ['NU', '0.3', '', 'PR', '0.3'],
    ['RHO', '7.82E-9', 't/mm³', 'RO', '7.82E-9'], ['LIMIT1', '250', 'MPa', 'SIGY', '250'],
  ]);
});

test('drawer names missing or invalid H inputs and explains that ETAN requires H', () => {
  const fr4 = ui.drawer(byName('FR4'));
  assert.equal(testIdText(fr4, 'hardening-h-result'), 'Not available');
  assert.equal(testIdText(fr4, 'tangent-etan-result'), 'Not available');
  const solver = solverText(fr4);
  assert.ok(solver.includes('Missing: Ultimate Stress, Elongation'));
  assert.ok(solver.includes('Requires H'));
  assert.ok(!fr4.includes('solver-bridge-status'), 'no Calculated status when H cannot be calculated');
  assert.ok(fr4.includes('solver-bridge-formula unavailable'));
  assert.ok(fr4.includes('H cannot be calculated. Missing: Ultimate Stress, Elongation'));
  assert.ok(solverText(ui.drawer(byName('ChipSet'))).includes('Missing: Yield Stress, Ultimate Stress, Elongation'));
  const invalid = solverText(ui.drawer({ ...byName('SGCC'), ultimateStress: 200 }));
  assert.ok(invalid.includes('Invalid: Ultimate Stress is below Yield Stress'));
  assert.ok(invalid.includes('Requires H'));
});

test('production library, detail and import dialog retain visible Add/Edit/Delete/Import controls', () => {
  const html = ui.library();
  for (const text of ['新增材料', '編輯 SGCC', '刪除 SGCC', '資料庫狀態', '尚未連結', 'Actions']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Save Database</button>'));
  const imports = ui.imports(database, false);
  assert.ok(imports.includes('選擇 CSV 檔案'));
  assert.ok(!imports.includes('type="file"'), 'production must not present an upload input');
  const drawer = ui.drawer(sgcc);
  assert.ok(drawer.includes('> 編輯</button>'));
  assert.ok(drawer.includes('> 刪除</button>'));
  assert.ok(ui.imports(database, true).includes('data-testid="csv-input"'), 'local import retains the file input');
});

test('production editing requests only show guidance, leave database unchanged and perform no mutation', () => {
  const before = JSON.stringify(database);
  let guidanceCount = 0;
  for (const action of ['add', 'edit', 'delete', 'import']) {
    ui.requestLocalEditing(false, () => { database.materials.splice(0); assert.fail(`${action} must not run`); }, () => guidanceCount++);
  }
  assert.equal(guidanceCount, 4);
  assert.equal(JSON.stringify(database), before);
  const html = ui.guidance(true);
  for (const text of ['連結本機資料庫', 'Save Database', 'src/data/materials.json', 'GitHub Desktop Commit + Push']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('npm run dev'));
  assert.ok(ui.guidance(false).includes('此瀏覽器不支援直接編輯本機資料庫'));
});

test('ready local editor executes editing and CSV import actions without read-only guidance', () => {
  let calls = 0;
  for (const action of ['add', 'edit', 'delete', 'import']) {
    ui.requestLocalEditing(true, () => calls++, () => assert.fail(`${action} must be available locally`));
  }
  assert.equal(calls, 4);
});

test('revoked file permission still allows exporting and discarding an unsaved draft', () => {
  const html = ui.imports(database, false, true);
  assert.ok(html.includes('下載完整 JSON 備份'));
  assert.ok(html.includes('取消未儲存變更…'));
  assert.ok(!html.includes('type="file"'), 'revoked permissions do not enable importing');
  assert.ok(!ui.imports(database, false).includes('取消未儲存變更…'));
});
