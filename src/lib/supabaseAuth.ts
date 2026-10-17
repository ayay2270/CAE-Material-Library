import { createMaterialLibraryClient } from './supabaseClient';

/** Exposed boolean RPC. It accepts no user id and returns no admin rows. */
export const MATERIAL_ADMIN_STATUS_RPC = 'is_current_user_material_admin';

export const ADMIN_STATUS_UNCONFIRMED = '無法確認 Admin 身分，目前維持唯讀。';
export const SESSION_STATUS_UNCONFIRMED = '無法確認登入狀態，目前維持唯讀。';

export type MaterialAdminStatus = 'signed_out' | 'checking' | 'admin' | 'non_admin' | 'error';

export interface MaterialAuthSnapshot {
  status: MaterialAdminStatus;
  email: string | null;
  message: string | null;
}

export interface MaterialAuthSession {
  user?: {
    id?: string;
    email?: string | null;
  } | null;
}

export interface MaterialAuthClient {
  auth: {
    getSession: () => PromiseLike<{
      data: { session: MaterialAuthSession | null };
      error: { message: string } | null;
    }>;
    onAuthStateChange: (
      callback: (event: string, session: MaterialAuthSession | null) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
    signInWithPassword: (
      credentials: { email: string; password: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
    signOut: () => PromiseLike<{ error: { message: string } | null }>;
  };
  rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface MaterialAuthHandle {
  stop: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
}

const SIGNED_OUT: MaterialAuthSnapshot = { status: 'signed_out', email: null, message: null };

export function materialAuthErrorMessage(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login') || text.includes('invalid credentials') || text.includes('invalid email or password')) {
    return '電子郵件或密碼不正確。';
  }
  if (text.includes('email not confirmed')) return '此帳號尚未完成電子郵件驗證。';
  if (text.includes('too many') || text.includes('rate limit')) return '嘗試次數過多，請稍後再試。';
  if (text.includes('network') || text.includes('fetch')) return '無法連線到 Supabase，請稍後再試。';
  return '登入失敗，請再試一次。';
}

function sessionEmail(session: MaterialAuthSession | null): string | null {
  const email = session?.user?.email;
  return typeof email === 'string' && email.length > 0 ? email : null;
}

function sessionKey(session: MaterialAuthSession | null): string {
  const user = session?.user;
  if (!user) return '';
  return user.id || user.email || 'signed-in';
}

/** Reads admin status for the current session. A missing session does not call the RPC. */
export async function readCurrentMaterialAdmin(
  client: MaterialAuthClient,
  session: MaterialAuthSession | null,
): Promise<MaterialAuthSnapshot> {
  if (!session?.user) return SIGNED_OUT;
  const email = sessionEmail(session);
  try {
    const { data, error } = await client.rpc(MATERIAL_ADMIN_STATUS_RPC);
    if (error || (data !== true && data !== false)) {
      return { status: 'error', email, message: ADMIN_STATUS_UNCONFIRMED };
    }
    return data
      ? { status: 'admin', email, message: null }
      : { status: 'non_admin', email, message: null };
  } catch {
    return { status: 'error', email, message: ADMIN_STATUS_UNCONFIRMED };
  }
}

export async function signInMaterialLibrary(
  client: MaterialAuthClient,
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error ? materialAuthErrorMessage(error.message) : null };
  } catch {
    return { error: '無法連線到 Supabase，請稍後再試。' };
  }
}

export async function signOutMaterialLibrary(client: MaterialAuthClient): Promise<{ error: string | null }> {
  try {
    const { error } = await client.auth.signOut();
    return { error: error ? '登出失敗，請再試一次。' : null };
  } catch {
    return { error: '登出失敗，請再試一次。' };
  }
}

export function watchMaterialAuth(
  client: MaterialAuthClient,
  onChange: (snapshot: MaterialAuthSnapshot) => void,
): MaterialAuthHandle {
  let generation = 0;
  let epoch = 0;
  let active = true;
  let settledKey = '';

  const publish = (snapshot: MaterialAuthSnapshot) => {
    if (active) onChange(snapshot);
  };

  const applySession = (session: MaterialAuthSession | null, force = false) => {
    epoch += 1;
    const key = sessionKey(session);
    if (!session?.user) {
      generation += 1;
      settledKey = '';
      publish(SIGNED_OUT);
      return;
    }
    if (!force && key === settledKey) return;
    const current = ++generation;
    settledKey = key;
    publish({ status: 'checking', email: sessionEmail(session), message: null });
    void readCurrentMaterialAdmin(client, session).then((snapshot) => {
      if (!active || current !== generation) return;
      publish(snapshot);
    });
  };

  const startedEpoch = epoch;
  void Promise.resolve(client.auth.getSession()).then((result) => {
    if (!active || epoch !== startedEpoch) return;
    if (result.error) {
      epoch += 1;
      generation += 1;
      settledKey = '';
      publish({ status: 'error', email: null, message: SESSION_STATUS_UNCONFIRMED });
      return;
    }
    applySession(result.data?.session ?? null);
  }).catch(() => {
    if (!active || epoch !== startedEpoch) return;
    epoch += 1;
    generation += 1;
    settledKey = '';
    publish({ status: 'error', email: null, message: SESSION_STATUS_UNCONFIRMED });
  });

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });

  return {
    stop() {
      active = false;
      data.subscription.unsubscribe();
    },
    signIn(email, password) {
      return signInMaterialLibrary(client, email, password);
    },
    async signOut() {
      applySession(null);
      const result = await signOutMaterialLibrary(client);
      if (!active || !result.error) return result;
      try {
        const restored = await client.auth.getSession();
        if (!active) return result;
        if (restored.error) {
          publish({ status: 'error', email: null, message: result.error });
          return result;
        }
        applySession(restored.data?.session ?? null, true);
      } catch {
        publish({ status: 'error', email: null, message: result.error });
      }
      return result;
    },
  };
}

export function startMaterialLibraryAuth(
  onChange: (snapshot: MaterialAuthSnapshot) => void,
): MaterialAuthHandle {
  const client = createMaterialLibraryClient();
  const authClient: MaterialAuthClient = {
    auth: {
      getSession: () => client.auth.getSession(),
      onAuthStateChange: (callback) => client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      }),
      signInWithPassword: (credentials) => client.auth.signInWithPassword(credentials),
      signOut: () => client.auth.signOut(),
    },
    rpc: (fn) => client.rpc(fn),
  };
  return watchMaterialAuth(authClient, onChange);
}
