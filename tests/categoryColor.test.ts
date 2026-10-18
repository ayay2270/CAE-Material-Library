import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CATEGORY_PRESENTATION_COLORS, categoryPresentationColor } from '../src/lib/indexes';

const uiBuild = buildSync({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { IndexContext } from './src/lib/indexes';
      import { Sidebar } from './src/components/Sidebar';
      import { MaterialTable } from './src/components/MaterialTable';
      import { MaterialDrawer } from './src/components/MaterialDrawer';
      const stored = { categories: [
        { id: 'Metal', label: '金屬', color: '#111111' },
        { id: 'Plastic', label: '塑膠', color: '#222222' },
        { id: 'Composite', label: '複合材料', color: '#333333' },
        { id: 'Elastomer', label: '彈性體', color: '#444444' },
        { id: 'Others', label: '其他', color: '#555555' },
        { id: 'Custom', label: '自訂', color: '#123abc' },
      ], sources: ['Legacy data'] };
      const metal = { id: 'adc12', name: 'ADC12', category: 'Metal', density: 2.82e-9, youngsModulus: 71000, poissonRatio: 0.3, yieldStress: 165, etan: null, ultimateStress: 336, elongation: 2.5, source: 'Legacy data', notes: '', updatedAt: '2026-09-17T07:17:00.000Z', history: [] };
      const noop = () => {};
      const units = { density: 't/mm³', stress: 'MPa' };
      const wrap = node => renderToStaticMarkup(<IndexContext.Provider value={stored}>{node}</IndexContext.Provider>);
      export const sidebar = () => wrap(<Sidebar materials={[metal]} view="materials" onNavigate={noop} filters={{category:'all',source:'all',updated:'all'}} onFilters={noop} selectedCount={0} onManage={noop} indexManageEnabled={false} />);
      export const table = () => wrap(<MaterialTable editable={false} rows={[metal]} total={1} columns={['category']} sort={{key:'name',dir:'asc'}} onSort={noop} selected={[]} onToggle={noop} onClearSelection={noop} onOpen={noop} onEdit={noop} onDelete={noop} units={units} activeId={null} />);
      export const drawer = () => wrap(<MaterialDrawer editable={false} material={metal} units={units} onClose={noop} onEdit={noop} onDelete={noop} onSaveCurve={() => null} />);
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
    'import.meta.env.BASE_URL': '"/CAE-Material-Library-V2-Preview/"',
    'process.env.NODE_ENV': '"production"',
  },
});
const compiled = { exports: {} as Record<string, () => string> };
new Function('require', 'module', 'exports', uiBuild.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const ui = compiled.exports;

test('built-in category presentation colors are distinct and deterministic', () => {
  const colors = Object.values(CATEGORY_PRESENTATION_COLORS);
  assert.equal(new Set(colors).size, 5);
  assert.deepEqual(colors, ['#3b82f6', '#f59e0b', '#a855f7', '#22c55e', '#94a3b8']);
  for (const [id, color] of Object.entries(CATEGORY_PRESENTATION_COLORS)) {
    assert.equal(categoryPresentationColor(id, '#111111'), color);
    assert.equal(categoryPresentationColor(id), color);
  }
  assert.equal(categoryPresentationColor('Custom', '#123abc'), '#123abc');
  assert.equal(categoryPresentationColor('Missing', 'not-a-color'), '#94a3b8');
});

test('sidebar, table, and drawer resolve the same category color', () => {
  const sidebar = ui.sidebar();
  const table = ui.table();
  const drawer = ui.drawer();
  const metalColor = CATEGORY_PRESENTATION_COLORS.Metal;
  for (const html of [sidebar, table, drawer]) {
    assert.ok(html.includes(metalColor), metalColor);
    assert.equal(html.includes('#111111'), false);
  }
  assert.match(drawer, new RegExp(`cat-tag" style="--cat:${metalColor}"`));
  assert.equal(drawer.includes('category-Metal'), false);
  assert.ok(sidebar.includes(CATEGORY_PRESENTATION_COLORS.Plastic));
  assert.ok(sidebar.includes(CATEGORY_PRESENTATION_COLORS.Composite));
  assert.ok(sidebar.includes(CATEGORY_PRESENTATION_COLORS.Elastomer));
  assert.ok(sidebar.includes(CATEGORY_PRESENTATION_COLORS.Others));
  assert.ok(sidebar.includes('#123abc'));
});
