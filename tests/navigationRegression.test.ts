import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('workspace navigation exits an active material detail before changing view', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const helperStart = app.indexOf('const clearDetailForNavigation');
  const navigateStart = app.indexOf('const navigate', helperStart);
  const navigateEnd = app.indexOf('const showLocalEditing', navigateStart);
  assert.ok(helperStart >= 0, 'clearDetailForNavigation helper should exist');
  assert.ok(navigateStart > helperStart, 'navigate should follow the detail cleanup helper');

  const helper = app.slice(helperStart, navigateStart);
  const navigate = app.slice(navigateStart, navigateEnd);

  assert.match(helper, /pushedDetail\.current = false/);
  assert.match(helper, /setDetailId\(null\)/);
  assert.match(helper, /searchWithMaterial\(window\.location\.search, null\)/);
  assert.match(helper, /window\.history\.replaceState/);
  assert.match(navigate, /clearDetailForNavigation\(\)/);
  assert.match(navigate, /setView\(v\)/);
});

test('Lenovo logo exposes a home action wired to the materials view', async () => {
  const [app, header] = await Promise.all([
    readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /onHome=\{\(\) => navigate\('materials'\)\}/);
  assert.match(header, /className="brand-home"/);
  assert.match(header, /onClick=\{onHome\}/);
  assert.match(header, /aria-label="回到材料庫首頁"/);
});
