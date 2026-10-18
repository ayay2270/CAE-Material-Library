import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImportExportDialog } from '../src/components/Dialogs';
import {
  SUPABASE_MATERIAL_CRUD_DENIED,
  SUPABASE_WRITE_LATER,
  materialCrudEnabledFor,
  supabaseCommittedNotice,
} from '../src/lib/localEditing';
import { helpModeCopy } from '../src/components/Dialogs';

const readyLabel = '資料來源 · Supabase';
const loginCopy = '登入後若具備 Material Library Admin 權限，可新增、編輯與刪除材料，新增、編輯或刪除已儲存的完整曲線，以及新增或重新命名分類與來源。刪除已儲存的完整曲線不會刪除材料。CSV 匯入、JSON 寫入、分類刪除與來源刪除目前仍不可用。';
const deferredCopy = '此功能在 Supabase 模式目前為唯讀，尚未開放寫入。';

test('Supabase source label, login copy, and deferred copy are feature-scoped', async () => {
  const status = await readFile(new URL('../src/components/DatabaseStatus.tsx', import.meta.url), 'utf8');
  const login = await readFile(new URL('../src/components/SupabaseAuthDialog.tsx', import.meta.url), 'utf8');
  assert.match(status, /if \(state\.supabaseStatus === 'ready'\) return '資料來源 · Supabase';/);
  assert.equal(status.includes('資料來源 · Supabase（唯讀）'), false);
  assert.match(status, /資料來源 · Supabase（讀取中）/);
  assert.match(status, /資料來源 · Supabase（讀取失敗）/);
  assert.equal(status.includes(readyLabel), true);
  assert.equal(login.includes('此步驟仍不可編輯材料'), false);
  assert.equal(login.includes(loginCopy), true);
  assert.equal(SUPABASE_WRITE_LATER, deferredCopy);
  assert.equal(deferredCopy.includes('下一階段'), false);
  assert.equal(SUPABASE_MATERIAL_CRUD_DENIED, '目前帳號沒有材料寫入權限。');
});

test('Supabase Admin material CRUD stays enabled while deferred writes stay closed', async () => {
  assert.equal(materialCrudEnabledFor('supabase', false, true), true);
  assert.equal(materialCrudEnabledFor('supabase', false, false), false);
  assert.equal(supabaseCommittedNotice('add', 'ZZZ').includes('已新增 Supabase 材料'), true);
  assert.equal(supabaseCommittedNotice('edit', 'ZZZ').includes('已更新 Supabase 材料'), true);
  assert.equal(supabaseCommittedNotice('delete', 'ZZZ').includes('已從 Supabase 刪除'), true);
  assert.equal(supabaseCommittedNotice('add', 'ZZZ').includes('Save Database'), false);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const drawer = await readFile(new URL('../src/components/MaterialDrawer.tsx', import.meta.url), 'utf8');
  const dialogs = await readFile(new URL('../src/components/Dialogs.tsx', import.meta.url), 'utf8');
  assert.match(app, /editable=\{materialCrudEnabled\}/);
  assert.match(app, /<MaterialDetailPage[\s\S]*editable=\{editable\}[\s\S]*materialCrudEnabled=\{materialCrudEnabled\}/);
  assert.match(drawer, /<StressStrainSection[^>]*editable=\{curveEditable\}/);
  assert.match(app, /<ImportExportDialog[\s\S]*editable=\{editable\}/);
  assert.match(app, /readOnlyHint=\{materialState\.dataSource === 'supabase' \? SUPABASE_WRITE_LATER : undefined\}/);
  assert.match(dialogs, /\{editable && <input ref=\{fileRef\}/);
  assert.match(app, /\{indexManager && \(indexWriteEnabled \|\| materialState\.materialWriting\) &&/);
  assert.match(app, /<Sidebar[\s\S]*indexManageEnabled=\{indexWriteEnabled && !indexRemoteStale\}/);
  assert.equal(app.includes('Supabase（唯讀）'), false);
  assert.equal(app.includes('此功能目前為唯讀'), true);
});

test('help copy follows the data source and leaves legacy local editing intact', () => {
  const supabase = `${helpModeCopy('supabase').view} ${helpModeCopy('supabase').storage}`;
  const legacy = `${helpModeCopy('legacy').view} ${helpModeCopy('legacy').storage}`;
  assert.equal(supabase.includes('src/data/materials.json'), false);
  assert.equal(supabase.includes('直接寫入 Supabase'), true);
  assert.equal(supabase.includes('不需要按 Save Database'), true);
  assert.equal(supabase.includes('新增、編輯或刪除已儲存的完整曲線'), true);
  assert.equal(supabase.includes('刪除已儲存的完整曲線不會刪除材料'), true);
  assert.equal(supabase.includes('新增或重新命名分類與來源'), true);
  assert.equal(supabase.includes('CSV／JSON 寫入、分類刪除與來源刪除目前仍不可用'), true);
  assert.equal(supabase.includes('分類與來源管理目前仍為唯讀'), false);
  assert.equal(legacy.includes('src/data/materials.json'), true);
  assert.equal(legacy.includes('按 Save Database 寫入檔案'), true);
  assert.equal(legacy.includes('連結本機資料庫'), true);
  assert.equal(helpModeCopy('example').storage.includes('此分頁'), true);
  assert.equal(helpModeCopy('example').storage.includes('按 Save Database'), false);
});

test('Supabase import dialog hides legacy recovery and keeps CSV and JSON writes closed', () => {
  const props = {
    materials: [],
    visibleRows: [],
    database: { schemaVersion: 1, materials: [], indexes: { categories: [], sources: [] } },
    editable: false,
    readOnlyHint: SUPABASE_WRITE_LATER,
    onImport: () => ({ added: 0, updated: 0, unchanged: 0 }),
    onReset: () => {},
    onRecover: () => {},
    onLegacy: () => {},
    onReadOnly: () => {},
    onClose: () => {},
  };
  const supabase = renderToStaticMarkup(createElement(ImportExportDialog, { ...props, showLegacyRecovery: false }));
  const legacy = renderToStaticMarkup(createElement(ImportExportDialog, props));
  assert.equal(supabase.includes('檢查舊瀏覽器資料'), false);
  assert.equal(legacy.includes('檢查舊瀏覽器資料'), true);
  assert.equal(supabase.includes('data-testid="csv-input"'), false);
  assert.equal(supabase.includes('匯入完整 JSON'), false);
  assert.equal(supabase.includes(SUPABASE_WRITE_LATER), true);
  assert.equal(supabase.includes('匯出全部'), true);
});

test('delete wording stays mode-aware', async () => {
  const dialogs = await readFile(new URL('../src/components/Dialogs.tsx', import.meta.url), 'utf8');
  assert.match(dialogs, /會直接從 Supabase 刪除，確認成功後才會生效/);
  assert.match(dialogs, /按 Save Database 才會寫入 Git 主資料庫/);
});
