import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SupabaseAuthDialog } from '../src/components/SupabaseAuthDialog';
import {
  materialAuthErrorMessage,
  readCurrentMaterialAdmin,
  signInMaterialLibrary,
  signOutMaterialLibrary,
  watchMaterialAuth,
  type MaterialAuthClient,
  type MaterialAuthSession,
  type MaterialAuthSnapshot,
} from '../src/lib/supabaseAuth';

const signedIn: MaterialAuthSession = { user: { id: 'fixture-user', email: 'person@example.com' } };

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeClient(options: {
  session?: MaterialAuthSession | null;
  rpcResult?: { data: unknown; error: { message: string } | null } | (() => Promise<{ data: unknown; error: { message: string } | null }>);
  sessionError?: { message: string } | null;
} = {}) {
  const rpcCalls: unknown[][] = [];
  const authCalls: { method: string; args: unknown[] }[] = [];
  let listener: ((event: string, session: MaterialAuthSession | null) => void) | null = null;
  const client: MaterialAuthClient = {
    auth: {
      async getSession() {
        authCalls.push({ method: 'getSession', args: [] });
        return {
          data: { session: options.session ?? null },
          error: options.sessionError ?? null,
        };
      },
      onAuthStateChange(callback) {
        listener = callback;
        callback('INITIAL_SESSION', options.session ?? null);
        return { data: { subscription: { unsubscribe() { listener = null; } } } };
      },
      async signInWithPassword(credentials) {
        authCalls.push({ method: 'signInWithPassword', args: [credentials] });
        return { error: null };
      },
      async signOut() {
        authCalls.push({ method: 'signOut', args: [] });
        return { error: null };
      },
    },
    async rpc(...args: unknown[]) {
      rpcCalls.push(args);
      if (typeof options.rpcResult === 'function') return options.rpcResult();
      return options.rpcResult ?? { data: false, error: null };
    },
  };
  return {
    client,
    rpcCalls,
    authCalls,
    emit(session: MaterialAuthSession | null) { listener?.('SIGNED_IN', session); },
  };
}

async function watchOnce(client: MaterialAuthClient): Promise<MaterialAuthSnapshot[]> {
  const snapshots: MaterialAuthSnapshot[] = [];
  const handle = watchMaterialAuth(client, (snapshot) => snapshots.push(snapshot));
  await settle();
  await settle();
  handle.stop();
  return snapshots;
}

test('signed-out state does not call the admin RPC', async () => {
  const { client, rpcCalls } = fakeClient({ session: null });
  const direct = await readCurrentMaterialAdmin(client, null);
  assert.equal(direct.status, 'signed_out');
  assert.equal(rpcCalls.length, 0);
  const snapshots = await watchOnce(client);
  assert.equal(rpcCalls.length, 0);
  assert.equal(snapshots.at(-1)?.status, 'signed_out');
});

test('signed-in session triggers the admin RPC with no arguments', async () => {
  const { client, rpcCalls } = fakeClient({ session: signedIn, rpcResult: { data: true, error: null } });
  const snapshots = await watchOnce(client);
  assert.ok(rpcCalls.length >= 1);
  for (const call of rpcCalls) {
    assert.deepEqual(call, ['is_current_user_material_admin']);
    assert.equal(JSON.stringify(call).includes('fixture-user'), false);
  }
  assert.equal(snapshots.at(-1)?.status, 'admin');
  assert.equal(snapshots.at(-1)?.email, 'person@example.com');
});

test('RPC true is admin and RPC false is non_admin', async () => {
  const admin = await readCurrentMaterialAdmin(fakeClient().client, signedIn);
  assert.equal(admin.status, 'non_admin');
  const { client } = fakeClient({ rpcResult: { data: true, error: null } });
  const allowed = await readCurrentMaterialAdmin(client, signedIn);
  assert.equal(allowed.status, 'admin');
  const denied = await readCurrentMaterialAdmin(
    fakeClient({ rpcResult: { data: false, error: null } }).client,
    signedIn,
  );
  assert.equal(denied.status, 'non_admin');
  assert.notEqual(denied.status, 'admin');
});

test('RPC error or a non-boolean result is never admin', async () => {
  const failed = await readCurrentMaterialAdmin(
    fakeClient({ rpcResult: { data: null, error: { message: 'permission denied' } } }).client,
    signedIn,
  );
  assert.equal(failed.status, 'error');
  assert.notEqual(failed.status, 'admin');
  const garbage = await readCurrentMaterialAdmin(
    fakeClient({ rpcResult: { data: { admin: true }, error: null } }).client,
    signedIn,
  );
  assert.equal(garbage.status, 'error');
  assert.notEqual(garbage.status, 'admin');
  const thrown = fakeClient();
  thrown.client.rpc = async () => { throw new Error('network down'); };
  const crashed = await readCurrentMaterialAdmin(thrown.client, signedIn);
  assert.equal(crashed.status, 'error');
  assert.notEqual(crashed.status, 'admin');
});

test('sign-in uses email and password auth and does not echo the password', async () => {
  const { client, authCalls } = fakeClient();
  let received: { email: string; password: string } | null = null;
  client.auth.signInWithPassword = async (credentials) => {
    received = credentials;
    authCalls.push({ method: 'signInWithPassword', args: [credentials] });
    return { error: { message: 'Invalid login credentials fixture-password' } };
  };
  const result = await signInMaterialLibrary(client, 'person@example.com', 'fixture-password');
  assert.equal(authCalls.some((call) => call.method === 'signInWithPassword'), true);
  assert.deepEqual(received, { email: 'person@example.com', password: 'fixture-password' });
  assert.equal(result.error, '電子郵件或密碼不正確。');
  assert.equal(result.error?.includes('fixture-password'), false);
  assert.equal(materialAuthErrorMessage('raw server text fixture-password'), '登入失敗，請再試一次。');
});

test('sign-out uses Supabase Auth signOut and ignores a late admin result', async () => {
  let releaseRpc: (value: { data: boolean; error: null }) => void = () => {};
  const { client, authCalls } = fakeClient({
    session: signedIn,
    rpcResult: () => new Promise((resolve) => { releaseRpc = resolve; }),
  });
  const snapshots: MaterialAuthSnapshot[] = [];
  const handle = watchMaterialAuth(client, (snapshot) => snapshots.push(snapshot));
  await settle();
  assert.equal(snapshots.at(-1)?.status, 'checking');
  const signingOut = handle.signOut();
  assert.equal(snapshots.at(-1)?.status, 'signed_out');
  releaseRpc({ data: true, error: null });
  await signingOut;
  await settle();
  assert.equal(authCalls.some((call) => call.method === 'signOut'), true);
  assert.equal(snapshots.at(-1)?.status, 'signed_out');
  assert.equal(snapshots.some((snapshot) => snapshot.status === 'admin'), false);
  const direct = await signOutMaterialLibrary(client);
  assert.equal(direct.error, null);
  assert.ok(authCalls.filter((call) => call.method === 'signOut').length >= 2);
  handle.stop();
});

test('admin helper has no material writes, signup, or Knowledge Base storage', async () => {
  const paths = [
    '../src/lib/supabaseAuth.ts',
    '../src/components/SupabaseAuthDialog.tsx',
    '../src/components/DatabaseStatus.tsx',
  ];
  const forbidden = [
    '.insert(',
    '.update(',
    '.delete(',
    '.upsert(',
    '.from(',
    'signUp',
    'resetPasswordForEmail',
    'signInWithOtp',
    'signInWithOAuth',
    'service_role',
    'cae-kb-v4-auth',
    'user_metadata',
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const token of forbidden) assert.equal(source.includes(token), false, `${path} contains ${token}`);
  }
  const auth = await readFile(new URL('../src/lib/supabaseAuth.ts', import.meta.url), 'utf8');
  assert.equal(auth.includes('signInWithPassword'), true);
  assert.equal(auth.includes('signOut'), true);
  assert.equal(auth.includes("rpc(MATERIAL_ADMIN_STATUS_RPC)"), true);
  assert.equal(auth.includes('is_current_user_material_admin'), true);
});

test('login dialog is email and password only', () => {
  const html = renderToStaticMarkup(createElement(SupabaseAuthDialog, {
    onClose() {},
    async onSignIn() { return { error: null }; },
  }));
  assert.match(html, /type="email"/);
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="username"|autocomplete="username"/);
  assert.match(html, /autoComplete="current-password"|autocomplete="current-password"/);
  assert.match(html, /取消/);
  assert.match(html, /登入/);
  assert.equal(html.includes('註冊'), false);
  assert.equal(html.includes('忘記密碼'), false);
  assert.equal(/oauth|magic|google/i.test(html), false);
});

test('006 exposes only the current-user boolean RPC to authenticated', async () => {
  const sql = await readFile(new URL('../supabase/migrations/006_material_admin_status_rpc.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE FUNCTION material_library\.is_current_user_material_admin\(\)/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /STABLE/);
  assert.match(sql, /SET search_path = ''/);
  assert.match(sql, /SELECT private\.is_material_admin\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION material_library\.is_current_user_material_admin\(\) FROM anon/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION material_library\.is_current_user_material_admin\(\) TO authenticated/);
  assert.equal(/GRANT EXECUTE ON FUNCTION[\s\S]*TO anon/.test(sql), false);
  assert.equal(sql.includes('service_role'), false);
  assert.equal(/uuid|email|user_metadata/i.test(sql), false);
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
});
