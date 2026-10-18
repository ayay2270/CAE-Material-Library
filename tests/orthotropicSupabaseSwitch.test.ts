import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement } from 'react';
import { validateDatabase } from '../src/lib/database-schema.mjs';
import { commitSupabaseUpdate } from '../src/lib/supabaseMaterialCommit';
import { mapMaterialRow } from '../src/lib/supabaseDatabase';
import { materialToDatabaseRow, updateSupabaseMaterial, type MaterialWriteClient } from '../src/lib/supabaseMaterialWrites';
import { isOrthotropic } from '../src/lib/materialProperties';
import { MaterialForm } from '../src/components/MaterialForm';
import type { MasterDatabase } from '../src/lib/database-schema.mjs';
import type { CompositeStrength, Material, MaterialInput, OrthotropicProperties } from '../src/types';

const NOW = '2026-10-17T08:00:00.000Z';
const REMOTE_UPDATED_AT = '2026-10-17T09:30:00+00:00';
const REMOTE_UPDATED_ISO = '2026-10-17T09:30:00.000Z';
const constants: OrthotropicProperties = {
  e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4,
};
const strength: CompositeStrength = { xt: 300, xc: 400, yt: 250, yc: 180, s12: 100 };

const describeBuild = buildSync({
  stdin: {
    contents: `export { describeChanges } from './src/lib/storage';`,
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"',
    'process.env.NODE_ENV': '"production"',
  },
});
const compiled = { exports: {} as { describeChanges?: (before: Material, after: MaterialInput) => string } };
new Function('require', 'module', 'exports', describeBuild.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const describeChanges = compiled.exports.describeChanges;
if (!describeChanges) throw new Error('describeChanges export missing');

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
  const win = dom.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: win.document });
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: win.HTMLElement });
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: win.Element });
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: win.Node });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  win.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0) as unknown as number;
  win.cancelAnimationFrame = (id: number) => clearTimeout(id);
  return win.document.getElementById('root')!;
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const view = element.ownerDocument.defaultView!;
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  const eventName = element instanceof view.HTMLSelectElement ? 'change' : 'input';
  element.dispatchEvent(new view.Event(eventName, { bubbles: true }));
}

function labeledInput(root: ParentNode, prefix: string) {
  const label = [...root.querySelectorAll('label')].find(node => node.querySelector('span')?.textContent?.startsWith(prefix));
  const input = label?.querySelector('input');
  if (!input) throw new Error(`missing field ${prefix}`);
  return input;
}

async function saveForm(initial: Material, edits: Array<(root: HTMLElement) => void> = []): Promise<MaterialInput> {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let saved: MaterialInput | undefined;
  await act(async () => {
    root.render(createElement(MaterialForm, {
      initial,
      existing: [initial],
      onSave: (input) => { saved = input; },
      onClose: () => {},
    }));
  });
  for (const edit of edits) await act(async () => { edit(rootElement); });
  await act(async () => {
    const button = [...rootElement.querySelectorAll('button')].find(node => node.textContent === '儲存變更');
    if (!button) throw new Error('save button missing');
    button.click();
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  root.unmount();
  if (!saved) throw new Error('form did not save');
  return saved;
}

function composite(model?: Material['materialModel']): Material {
  const row: Material = {
    id: 'switch-composite',
    name: 'Switch Composite',
    category: 'Composite',
    subCategory: 'PCB Laminate (FR4)',
    density: 1.8e-9,
    youngsModulus: 25000,
    poissonRatio: 0.35,
    yieldStress: 196,
    etan: null,
    ultimateStress: 210,
    elongation: 1.5,
    orthotropic: { ...constants },
    compositeStrength: { ...strength },
    source: 'Legacy data',
    notes: '',
    updatedAt: '2026-09-18T14:38:00.000Z',
    history: [{ at: '2026-09-18T14:38:00.000Z', action: 'created', summary: '建立記錄' }],
  };
  if (model) row.materialModel = model;
  return row;
}

function database(row: Material): MasterDatabase {
  const keeper: Material = {
    id: 'keeper',
    name: 'Keeper',
    category: 'Metal',
    density: 2.82e-9,
    youngsModulus: 71000,
    poissonRatio: 0.3,
    yieldStress: 165,
    etan: null,
    ultimateStress: 336,
    elongation: 2.5,
    source: 'Legacy data',
    notes: '',
    updatedAt: '2026-09-17T07:17:00.000Z',
    history: [{ at: '2026-09-17T07:17:00.000Z', action: 'created', summary: '建立記錄' }],
  };
  return validateDatabase({
    schemaVersion: 1,
    materials: [row, keeper],
    indexes: {
      categories: [
        { id: 'Metal', label: '金屬', color: '#2563eb' },
        { id: 'Composite', label: '複合材料', color: '#0d9488' },
      ],
      sources: ['Legacy data'],
    },
  });
}

interface Call { payload?: unknown; eq?: { column: string; value: string } }

function echoingClient(mutate: (row: Record<string, unknown>) => void): { client: MaterialWriteClient; calls: Call[] } {
  const calls: Call[] = [];
  const client: MaterialWriteClient = {
    from() {
      return {
        insert() { throw new Error('insert is unused'); },
        delete() { throw new Error('delete is unused'); },
        update(payload) {
          const call: Call = { payload };
          calls.push(call);
          return {
            eq(column, value) {
              call.eq = { column, value };
              return this;
            },
            select() {
              const row = { id: call.eq?.value, ...(payload as object) } as Record<string, unknown>;
              mutate(row);
              return Promise.resolve({ data: [row], error: null });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

test('Supabase Isotropic to Orthotropic keeps inactive isotropic values, strength, and the returned row', async () => {
  const before = composite('Isotropic');
  const input = await saveForm(before, [
    (root) => {
      const model = root.querySelector('select[aria-label="Material Model"]');
      if (!(model instanceof root.ownerDocument.defaultView!.HTMLSelectElement)) throw new Error('model select missing');
      setNativeValue(model, 'Orthotropic');
    },
    (root) => setNativeValue(labeledInput(root, 'E1'), '23000'),
  ]);
  assert.equal(input.materialModel, 'Orthotropic');
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.equal(input.youngsModulus, 25000);
  assert.equal(input.orthotropic?.e1, 23000);
  const db = database(before);
  let prepared: Material | undefined;
  const { client, calls } = echoingClient((row) => {
    row.notes = 'remote-notes';
    row.updated_at = REMOTE_UPDATED_AT;
    row.history = [{ at: REMOTE_UPDATED_ISO, action: 'edited', summary: 'remote history' }];
    row.orthotropic = { ...(row.orthotropic as OrthotropicProperties), e3: 1111 };
  });
  const next = await commitSupabaseUpdate(db, before.id, input, async (row) => {
    prepared = row;
    return updateSupabaseMaterial(row, client);
  }, NOW, describeChanges);
  assert.ok(prepared);
  assert.equal(prepared.youngsModulus, 25000);
  assert.equal(prepared.poissonRatio, 0.35);
  assert.equal(prepared.yieldStress, 196);
  assert.equal(prepared.ultimateStress, 210);
  assert.equal(prepared.elongation, 1.5);
  assert.equal(prepared.orthotropic?.e1, 23000);
  assert.equal(prepared.orthotropic?.e3, 4400);
  assert.equal(prepared.compositeStrength, before.compositeStrength);
  assert.equal(prepared.updatedAt, NOW);
  assert.match(prepared.history[0].summary, /Material Model: Isotropic → Orthotropic/);
  const payload = calls[0].payload as ReturnType<typeof materialToDatabaseRow>;
  assert.equal(payload.material_model, 'Orthotropic');
  assert.equal(payload.sub_category, 'PCB Laminate (FR4)');
  assert.equal(payload.orthotropic, prepared.orthotropic);
  assert.equal(payload.composite_strength, before.compositeStrength);
  assert.equal(payload.youngs_modulus, 25000);
  const stored = next.materials.find(row => row.id === before.id)!;
  const returned = mapMaterialRow({ ...payload, id: before.id, notes: 'remote-notes', updated_at: REMOTE_UPDATED_AT, history: [{ at: REMOTE_UPDATED_ISO, action: 'edited', summary: 'remote history' }], orthotropic: { ...prepared.orthotropic, e3: 1111 } });
  assert.equal(stored.notes, 'remote-notes');
  assert.equal(stored.updatedAt, REMOTE_UPDATED_ISO);
  assert.equal(stored.updatedAt, returned.updatedAt);
  assert.deepEqual(stored.history, returned.history);
  assert.equal(stored.orthotropic?.e3, 1111);
  assert.notEqual(stored.orthotropic, prepared.orthotropic);
  assert.equal(stored.compositeStrength, before.compositeStrength);
  assert.equal(stored.youngsModulus, 25000);
  assert.equal(db.materials.find(row => row.id === before.id)?.notes, '');
});

test('Supabase Orthotropic to Isotropic keeps the Orthotropic object, strength, and returned nested values', async () => {
  const before = composite('Orthotropic');
  const input = await saveForm(before, [
    (root) => {
      const model = root.querySelector('select[aria-label="Material Model"]');
      if (!(model instanceof root.ownerDocument.defaultView!.HTMLSelectElement)) throw new Error('model select missing');
      setNativeValue(model, 'Isotropic');
    },
    (root) => setNativeValue(labeledInput(root, "Young's Modulus"), '26000'),
  ]);
  assert.equal(input.materialModel, 'Isotropic');
  assert.equal(Object.hasOwn(input, 'orthotropic'), false);
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.equal(input.youngsModulus, 26000);
  let prepared: Material | undefined;
  const remoteStrength: CompositeStrength = { ...strength, s12: 999 };
  const { client, calls } = echoingClient((row) => {
    row.notes = 'remote-isotropic';
    row.updated_at = REMOTE_UPDATED_AT;
    row.history = [{ at: REMOTE_UPDATED_ISO, action: 'edited', summary: 'remote isotropic history' }];
    row.composite_strength = remoteStrength;
  });
  const next = await commitSupabaseUpdate(database(before), before.id, input, async (row) => {
    prepared = row;
    return updateSupabaseMaterial(row, client);
  }, NOW, describeChanges);
  assert.ok(prepared);
  assert.equal(prepared.materialModel, 'Isotropic');
  assert.equal(prepared.youngsModulus, 26000);
  assert.equal(prepared.poissonRatio, before.poissonRatio);
  assert.equal(prepared.yieldStress, before.yieldStress);
  assert.equal(prepared.ultimateStress, before.ultimateStress);
  assert.equal(prepared.elongation, before.elongation);
  assert.equal(prepared.orthotropic, before.orthotropic);
  assert.equal(prepared.compositeStrength, before.compositeStrength);
  assert.match(prepared.history[0].summary, /Material Model: Orthotropic → Isotropic/);
  assert.doesNotMatch(prepared.history[0].summary, /Xt:|S12:/);
  const payload = calls[0].payload as ReturnType<typeof materialToDatabaseRow>;
  assert.equal(payload.material_model, 'Isotropic');
  assert.equal(payload.orthotropic, before.orthotropic);
  assert.equal(payload.composite_strength, before.compositeStrength);
  const stored = next.materials.find(row => row.id === before.id)!;
  assert.equal(stored.notes, 'remote-isotropic');
  assert.equal(stored.updatedAt, REMOTE_UPDATED_ISO);
  assert.equal(stored.history[0].summary, 'remote isotropic history');
  assert.equal(stored.orthotropic, before.orthotropic);
  assert.equal(stored.compositeStrength, remoteStrength);
  assert.equal(stored.youngsModulus, 26000);
  assert.notEqual(stored.compositeStrength, prepared.compositeStrength);
});

test('a legacy Composite Supabase edit keeps the model omitted and uses the returned row', async () => {
  const before = composite();
  delete before.materialModel;
  delete before.orthotropic;
  delete before.compositeStrength;
  delete before.subCategory;
  const input = await saveForm(before, [(root) => {
    const notes = root.querySelector('textarea');
    if (!notes) throw new Error('notes missing');
    setNativeValue(notes, 'legacy note');
  }]);
  assert.equal(Object.hasOwn(input, 'materialModel'), false);
  assert.equal(Object.hasOwn(input, 'orthotropic'), false);
  assert.equal(Object.hasOwn(input, 'compositeStrength'), false);
  assert.equal(isOrthotropic(input), false);
  let prepared: Material | undefined;
  const { client, calls } = echoingClient((row) => {
    row.notes = 'remote-legacy';
    row.updated_at = REMOTE_UPDATED_AT;
  });
  const next = await commitSupabaseUpdate(database(before), before.id, input, async (row) => {
    prepared = row;
    return updateSupabaseMaterial(row, client);
  }, NOW, describeChanges);
  assert.ok(prepared);
  assert.equal(Object.hasOwn(prepared, 'materialModel'), false);
  assert.equal(Object.hasOwn(prepared, 'orthotropic'), false);
  assert.equal(Object.hasOwn(prepared, 'compositeStrength'), false);
  assert.equal(isOrthotropic(prepared), false);
  assert.equal(prepared.youngsModulus, before.youngsModulus);
  assert.doesNotMatch(prepared.history[0].summary, /Material Model|Isotropic → Isotropic/);
  assert.match(prepared.history[0].summary, /備註/);
  const payload = calls[0].payload as ReturnType<typeof materialToDatabaseRow>;
  assert.equal(payload.material_model, null);
  assert.equal(payload.sub_category, null);
  assert.equal(payload.orthotropic, null);
  assert.equal(payload.composite_strength, null);
  const stored = next.materials.find(row => row.id === before.id)!;
  assert.equal(stored.notes, 'remote-legacy');
  assert.equal(stored.updatedAt, REMOTE_UPDATED_ISO);
  assert.equal(Object.hasOwn(stored, 'materialModel'), false);
  assert.equal(Object.hasOwn(stored, 'orthotropic'), false);
  assert.equal(Object.hasOwn(stored, 'compositeStrength'), false);
  assert.equal(isOrthotropic(stored), false);
  assert.equal(stored.history[0].summary, prepared.history[0].summary);
  assert.notEqual(stored.updatedAt, prepared.updatedAt);
});

test('a new Composite and a category change to Composite include the selected model', async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  const saved: MaterialInput[] = [];
  const metal = composite('Isotropic');
  metal.category = 'Metal';
  delete metal.subCategory;
  delete metal.orthotropic;
  delete metal.compositeStrength;
  delete metal.materialModel;
  await act(async () => {
    root.render(createElement(MaterialForm, {
      initial: null,
      existing: [],
      onSave: (input) => { saved.push(input); },
      onClose: () => {},
    }));
  });
  await act(async () => {
    setNativeValue(labeledInput(rootElement, 'Material Name'), 'New PCB');
    const category = rootElement.querySelector('select[aria-label="Category"]');
    if (!(category instanceof rootElement.ownerDocument.defaultView!.HTMLSelectElement)) throw new Error('category missing');
    setNativeValue(category, 'Composite');
  });
  await act(async () => {
    const model = rootElement.querySelector('select[aria-label="Material Model"]');
    if (!(model instanceof rootElement.ownerDocument.defaultView!.HTMLSelectElement)) throw new Error('model missing');
    setNativeValue(model, 'Orthotropic');
  });
  await act(async () => {
    const button = [...rootElement.querySelectorAll('button')].find(node => node.textContent === '新增');
    button?.click();
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  assert.equal(saved[0]?.materialModel, 'Orthotropic');
  assert.equal(saved[0]?.category, 'Composite');
  root.unmount();

  saved.length = 0;
  const second = createRoot(rootElement);
  await act(async () => {
    second.render(createElement(MaterialForm, {
      initial: metal,
      existing: [metal],
      onSave: (input) => { saved.push(input); },
      onClose: () => {},
    }));
  });
  await act(async () => {
    const category = rootElement.querySelector('select[aria-label="Category"]');
    if (!(category instanceof rootElement.ownerDocument.defaultView!.HTMLSelectElement)) throw new Error('category missing');
    setNativeValue(category, 'Composite');
  });
  await act(async () => {
    const button = [...rootElement.querySelectorAll('button')].find(node => node.textContent === '儲存變更');
    button?.click();
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  second.unmount();
  assert.equal(saved[0]?.category, 'Composite');
  assert.equal(saved[0]?.materialModel, 'Isotropic');
});
