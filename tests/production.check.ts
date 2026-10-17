import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { preview } from 'vite';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../src/lib/database-schema.mjs';

test('production has browser-selected file access but no server filesystem endpoint or GitHub writer', async t => {
  const path = new URL('../src/data/materials.json', import.meta.url);
  const before = await readFile(path, 'utf8');
  const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'silent' });
  t.after(() => new Promise<void>(resolve => server.httpServer.close(() => resolve())));
  const origin = `http://127.0.0.1:${(server.httpServer.address() as any).port}`;
  const base = '/CAE-Material-Library-V2-Preview/';
  const response = await fetch(origin + base + '__database', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ database: { materials: [] } }) });
  assert.notEqual(response.headers.get('content-type')?.includes('application/json'), true);
  assert.equal(await readFile(path, 'utf8'), before);
  const html = await (await fetch(origin + base)).text(); assert.match(html, /CAE/);
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  const js = (await Promise.all(assets.filter(f => f.endsWith('.js')).map(f => readFile(new URL(`../dist/assets/${f}`, import.meta.url), 'utf8')))).join('\n');
  assert.equal(/node:fs|writeFile|createDatabaseMiddleware|x-local-database|__database/.test(js), false, 'production must omit local API/writer code');
  assert.ok(js.includes(JSON.stringify(JSON.parse(before).materials[0].id)), 'committed material ID is included in the deployed viewer');
  assert.ok(js.includes('showOpenFilePicker') && js.includes('createWritable'), 'production includes explicit selected-file integration');
  assert.ok(js.includes('連結本機資料庫') && js.includes('檢查 GitHub 同步'));
  // material_library plus the source label means the Supabase reader is in this bundle.
  // The old whole-database read-only label must not be the marker: Admin material CRUD is live.
  // A quoted "sb_secret_" is the SDK prefix check, not a secret value. A key body after that prefix is.
  const supabaseBundle = js.includes('material_library') && js.includes('資料來源 · Supabase') && !js.includes('資料來源 · Supabase（唯讀）');
  t.diagnostic(`production mode: ${supabaseBundle ? 'supabase' : 'legacy'}`);
  assert.equal(/github_pat_|ghp_|sb_secret_(?!["'])|service_role|SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE_KEY/.test(js), false, 'no private credentials');
  if (supabaseBundle) {
    assert.ok(js.includes('material_library'), 'supabase production includes the material_library reader');
    assert.ok(js.includes('資料來源 · Supabase'), 'supabase production includes the source status');
    assert.equal(js.includes('資料來源 · Supabase（唯讀）'), false, 'supabase production no longer calls the whole source read-only');
  } else {
    assert.equal(js.includes('material_library'), false, 'legacy production must omit the Supabase reader');
    assert.equal(/Authorization|Bearer |github_pat_|ghp_/.test(js), false, 'no GitHub credentials');
    for (const token of [
      'material_library',
      'is_current_user_material_admin',
      'signInWithPassword',
      'GoTrueClient',
      'insertSupabaseMaterial',
      'updateSupabaseMaterial',
      'deleteSupabaseMaterial',
      'supabaseMaterialWrites',
      'supabaseMaterialCommit',
      'update_material_curve',
      'add_material_category',
      'rename_material_category_label',
      'add_material_source',
      'rename_material_source',
      'supabaseExtendedWrites',
      'supabaseExtendedCommit',
    ]) {
      assert.equal(js.split(token).length - 1, 0, `legacy production must omit ${token}`);
    }
  }
  const version = await (await fetch(origin + base + 'database-version.json')).json();
  assert.equal(version.databaseSha256, createHash('sha256').update(canonicalJson(JSON.parse(before))).digest('hex'));
});
