import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_WRITE_LATER, requestMaterialMutation } from '../src/lib/localEditing';
import { isSupabaseAdminCapability } from '../src/lib/useMaterialAuth';
import type { MaterialAdminStatus } from '../src/lib/supabaseAuth';

const srcRoot = fileURLToPath(new URL('../src/', import.meta.url));

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(path);
  }
  return files;
}

test('only App starts the single material auth watcher', async () => {
  const calls: string[] = [];
  for (const file of await sourceFiles(srcRoot)) {
    const source = await readFile(file, 'utf8');
    const count = source.match(/startMaterialLibraryAuth\s*\(/g)?.length ?? 0;
    if (count > 0) calls.push(`${file}:${count}`);
  }
  assert.deepEqual(calls.map(call => call.split(/[\\/]/).at(-1)).sort(), ['supabaseAuth.ts:1', 'useMaterialAuth.ts:1']);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const status = await readFile(new URL('../src/components/DatabaseStatus.tsx', import.meta.url), 'utf8');
  const hook = await readFile(new URL('../src/lib/useMaterialAuth.ts', import.meta.url), 'utf8');
  assert.equal(app.includes('startMaterialLibraryAuth'), false);
  assert.equal(status.includes('startMaterialLibraryAuth'), false);
  assert.equal(app.includes("useMaterialLibraryAuth(materialState.dataSource === 'supabase')"), true);
  assert.equal(status.includes('useMaterialLibraryAuth('), false);
  assert.equal(hook.includes('auth={auth}'), false);
  assert.match(hook, /import\.meta\.env\.VITE_MATERIAL_DATA_SOURCE === 'supabase'/);
  assert.equal(status.includes('auth.snapshot'), true);
  assert.equal(status.includes('auth.signIn'), true);
  assert.equal(status.includes('auth.signOut'), true);
});

test('Supabase admin capability follows the resolved snapshot and data source', () => {
  const statuses: MaterialAdminStatus[] = ['signed_out', 'checking', 'admin', 'non_admin', 'error'];
  for (const status of statuses) {
    assert.equal(isSupabaseAdminCapability('legacy', status), false, status);
    assert.equal(isSupabaseAdminCapability('supabase', status), status === 'admin', status);
  }
});

test('deferred Supabase writes stay closed and the adapter is not imported outside storage', async () => {
  assert.equal(isSupabaseAdminCapability('supabase', 'admin'), true);
  const calls = { action: 0, local: 0, supabase: 0 };
  requestMaterialMutation('supabase', false, () => { calls.action += 1; }, () => { calls.local += 1; }, () => { calls.supabase += 1; });
  assert.deepEqual(calls, { action: 0, local: 0, supabase: 1 });
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const hook = await readFile(new URL('../src/lib/useMaterialAuth.ts', import.meta.url), 'utf8');
  const status = await readFile(new URL('../src/components/DatabaseStatus.tsx', import.meta.url), 'utf8');
  assert.match(app, /requestMaterialMutation\(\s*materialState\.dataSource, editable, action, showLocalEditing, showSupabaseReadOnly,/);
  assert.equal(app.includes('SUPABASE_WRITE_LATER'), true);
  assert.equal(SUPABASE_WRITE_LATER, '此功能在 Supabase 模式目前為唯讀，尚未開放寫入。');
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.match(storage, /const supabaseMaterialWriters = supabaseReadOnly/);
  assert.equal(storage.includes("from './supabaseMaterialWrites'"), true);
  for (const source of [app, hook, status]) {
    assert.equal(source.includes('supabaseMaterialWrites'), false);
    assert.equal(source.includes('insertSupabaseMaterial'), false);
    assert.equal(source.includes('updateSupabaseMaterial'), false);
    assert.equal(source.includes('deleteSupabaseMaterial'), false);
    assert.equal(source.includes('is_current_user_material_admin'), false);
  }
  assert.equal(app.includes('startMaterialLibraryAuth'), false);
  assert.equal(status.includes('startMaterialLibraryAuth'), false);
});

test('legacy local editing and example mode stay on their existing paths', async () => {
  const calls = { action: 0, local: 0, supabase: 0 };
  requestMaterialMutation('legacy', false, () => { calls.action += 1; }, () => { calls.local += 1; }, () => { calls.supabase += 1; });
  requestMaterialMutation('legacy', true, () => { calls.action += 1; }, () => { calls.local += 1; }, () => { calls.supabase += 1; });
  assert.deepEqual(calls, { action: 1, local: 1, supabase: 0 });
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const status = await readFile(new URL('../src/components/DatabaseStatus.tsx', import.meta.url), 'utf8');
  assert.equal(status.includes('連結本機資料庫'), true);
  assert.match(status, /if \(state\.exampleMode\) return/);
  assert.equal(status.includes('獨立範例'), true);
  assert.equal(app.includes('編輯範例'), true);
  assert.equal(isSupabaseAdminCapability('legacy', 'admin'), false);
});
