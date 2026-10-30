import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement, act } from 'react';
import { JSDOM } from 'jsdom';
import { calculatedNu31, formatNu31 } from '../src/lib/orthotropicNu31';
import type { Material } from '../src/types';

// Matches the read-only production snapshot for material_library.materials / seed-4.
const fr4: Material = {
  id: 'seed-4', name: 'FR4', category: 'Composite', materialModel: 'Orthotropic',
  density: 1.8e-9, youngsModulus: 25000, poissonRatio: 0.35, yieldStress: 196,
  etan: null, ultimateStress: null, elongation: null, source: 'Provided by Jennifer',
  notes: '', updatedAt: '2026-10-18T02:49:09.250Z', history: [],
  orthotropic: { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 },
};

test('FR4 reciprocal ratio is 0.056, not ν13 or the NU23 blank-field default', () => {
  const before = structuredClone(fr4);
  const value = calculatedNu31(fr4)!;
  assert.ok(Math.abs(value - 0.056) < 1e-14);
  assert.equal(formatNu31(value), '0.056');
  assert.ok(Math.abs(value / fr4.orthotropic!.e3! - 0.28 / 22000) < 1e-16);
  assert.equal(formatNu31(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, e1: 22, e3: 4.4 } })!), '0.056');
  assert.equal(formatNu31(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, e3: 8800 } })!), '0.112');
  assert.deepEqual(fr4, before, 'original ν13, G13 and the whole record stay unchanged');
});

test('inactive, incomplete, invalid and non-finite inputs do not produce a solver value', () => {
  assert.equal(calculatedNu31({ ...fr4, materialModel: 'Isotropic' }), null);
  assert.equal(calculatedNu31({ ...fr4, orthotropic: undefined }), null);
  for (const key of ['e1', 'e3', 'nu13'] as const) {
    for (const value of [null, undefined, NaN, Infinity, -Infinity]) {
      assert.equal(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, [key]: value } }), null);
    }
  }
  for (const key of ['e1', 'e3'] as const) {
    for (const value of [0, -1]) assert.equal(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, [key]: value } }), null);
  }
  assert.equal(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, nu13: 0 } }), 0);
  assert.ok(calculatedNu31({ ...fr4, orthotropic: { ...fr4.orthotropic!, nu13: -0.28 } })! < 0);
  assert.equal(formatNu31(0.00000001), '1e-8', 'small ratios must not round to zero');
});

const build = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/components/HyperMeshNu31.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
  packages: 'external', loader: { '.css': 'empty' },
});
const compiled = { exports: {} as Record<string, any> };
new Function('require', 'module', 'exports', build.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { HyperMeshNu31 } = compiled.exports;

test('formula disclosure supports hover, focus, click/touch, Escape and outside dismissal', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div><button id="outside">Outside</button></body></html>', { url: 'http://localhost' });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, Node: dom.window.Node, HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true })) {
    Object.defineProperty(globalThis, name, { configurable: true, value });
  }
  const { createRoot } = await import('react-dom/client');
  const rootElement = document.getElementById('root')!;
  const root = createRoot(rootElement);
  try {
    await act(async () => root.render(createElement(HyperMeshNu31, { material: fr4 })));
    const trigger = rootElement.querySelector('button')!;
    const panel = rootElement.querySelector<HTMLElement>('[role="region"]')!;
    const wrapper = rootElement.firstElementChild!;
    const outside = document.getElementById('outside')!;
    const visible = (expected: boolean) => {
      assert.equal(panel.hidden, !expected);
      assert.equal(trigger.getAttribute('aria-expanded'), String(expected));
    };
    visible(false);
    assert.equal(trigger.getAttribute('aria-controls'), panel.id);
    assert.match(trigger.textContent!, /NU31（HyperMesh）0\.056/);
    assert.match(panel.textContent!, /ν31=ν13×E3\/E1=0\.28×4400\/22000=0\.056/);
    assert.match(panel.textContent!, /Default = NU23/);
    assert.match(panel.textContent!, /MAT9ORT=NU13/);

    await act(async () => trigger.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true })));
    visible(true);
    await act(async () => wrapper.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true, relatedTarget: outside })));
    visible(false);
    await act(async () => trigger.focus());
    visible(true);
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    visible(false);
    assert.equal(document.activeElement, trigger, 'Escape does not steal focus');
    await act(async () => trigger.click());
    visible(true);
    await act(async () => trigger.click());
    visible(false);
    await act(async () => trigger.click());
    visible(true);
    await act(async () => panel.querySelector('a')!.focus());
    visible(true);
    await act(async () => outside.focus());
    visible(false);
    await act(async () => { trigger.focus(); trigger.click(); });
    visible(true);
    await act(async () => outside.dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true })));
    visible(false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
