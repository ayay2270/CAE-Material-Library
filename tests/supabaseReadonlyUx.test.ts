import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  SUPABASE_WRITE_LATER,
  requestLocalEditing,
  requestMaterialMutation,
} from '../src/lib/localEditing';

function track() {
  const calls = { action: 0, local: 0, supabase: 0 };
  return {
    calls,
    action() { calls.action += 1; },
    local() { calls.local += 1; },
    supabase() { calls.supabase += 1; },
  };
}

test('Supabase readonly add, edit and delete do not open local editing', () => {
  for (const name of ['add', 'edit', 'delete']) {
    const gate = track();
    requestMaterialMutation('supabase', false, gate.action, gate.local, gate.supabase);
    assert.deepEqual(gate.calls, { action: 0, local: 0, supabase: 1 }, name);
  }
});

test('Supabase stays read-only even if editable were true', () => {
  const gate = track();
  requestMaterialMutation('supabase', true, gate.action, gate.local, gate.supabase);
  assert.deepEqual(gate.calls, { action: 0, local: 0, supabase: 1 });
});

test('legacy readonly still opens local editing and a ready editor still runs', () => {
  const blocked = track();
  requestMaterialMutation('legacy', false, blocked.action, blocked.local, blocked.supabase);
  assert.deepEqual(blocked.calls, { action: 0, local: 1, supabase: 0 });
  const ready = track();
  requestMaterialMutation('legacy', true, ready.action, ready.local, ready.supabase);
  assert.deepEqual(ready.calls, { action: 1, local: 0, supabase: 0 });
  let ran = 0;
  requestLocalEditing(true, () => { ran += 1; }, () => assert.fail('example and linked editors run the action'));
  requestLocalEditing(false, () => assert.fail('legacy readonly must not run the action'), () => { ran += 1; });
  assert.equal(ran, 2);
});

test('Supabase editable remains false and no material write was added', async () => {
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.equal(storage.includes('editable = true'), false);
  const files = [
    '../src/App.tsx',
    '../src/lib/localEditing.ts',
    '../src/components/Header.tsx',
    '../src/components/MaterialTable.tsx',
    '../src/components/MaterialDrawer.tsx',
    '../src/components/Dialogs.tsx',
  ];
  for (const path of files) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const token of ['.insert(', '.update(', '.delete(', '.upsert(', ".from('materials')"]) {
      assert.equal(source.includes(token), false, `${path} contains ${token}`);
    }
  }
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.equal(app.includes('requestMaterialMutation'), true);
  assert.equal(app.includes("requestEdit(() => setEditing('new'))"), true);
  assert.equal(app.includes('requestEdit(() => setEditing(m))'), true);
  assert.equal(app.includes('requestEdit(() => setDeleting(m))'), true);
  assert.equal(app.includes("dialog === 'supabaseReadOnly'"), true);
  assert.equal(app.includes('SUPABASE_WRITE_LATER'), true);
  assert.equal(app.includes(SUPABASE_WRITE_LATER), false);
});

test('Supabase controls use the read-only title and legacy keeps the local hint', async () => {
  const header = await readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
  const table = await readFile(new URL('../src/components/MaterialTable.tsx', import.meta.url), 'utf8');
  const drawer = await readFile(new URL('../src/components/MaterialDrawer.tsx', import.meta.url), 'utf8');
  assert.match(header, /title=\{editable \? '新增材料' : readOnlyTitle\}/);
  assert.match(header, /readOnlyTitle = LOCAL_EDITING_HINT/);
  assert.match(table, /p\.readOnlyTitle \?\? LOCAL_EDITING_HINT/);
  assert.match(drawer, /readOnlyTitle = LOCAL_EDITING_HINT/);
  assert.equal(header.includes(SUPABASE_WRITE_LATER), false);
});
