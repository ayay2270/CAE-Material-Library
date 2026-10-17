import { useCallback, useEffect, useRef, useState } from 'react';
import { startMaterialLibraryAuth } from './supabaseAuth';
import type { MaterialAdminStatus, MaterialAuthHandle, MaterialAuthSnapshot } from './supabaseAuth';

const ADMIN_STATUS_UNCONFIRMED = '無法確認 Admin 身分，目前維持唯讀。';
const INITIAL_SNAPSHOT: MaterialAuthSnapshot = { status: 'checking', email: null, message: null };

// The comparison stays in the true branch so a non-supabase literal drops the auth runtime.
const supabaseAuthEnabled = import.meta.env
  ? import.meta.env.VITE_MATERIAL_DATA_SOURCE === 'supabase'
  : false;
const supabaseAuthRuntime = supabaseAuthEnabled ? { startMaterialLibraryAuth } : null;

export interface MaterialLibraryAuthController {
  snapshot: MaterialAuthSnapshot;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => void;
}

/** UI capability only. Row Level Security still authorizes every write. */
export function isSupabaseAdminCapability(
  dataSource: 'supabase' | 'legacy',
  status: MaterialAdminStatus,
): boolean {
  return dataSource === 'supabase' && status === 'admin';
}

/** One watcher for the Supabase screen. Legacy and example mode pass active=false. */
export function useMaterialLibraryAuth(active: boolean): MaterialLibraryAuthController {
  const [snapshot, setSnapshot] = useState<MaterialAuthSnapshot>(INITIAL_SNAPSHOT);
  const authRef = useRef<MaterialAuthHandle | null>(null);
  useEffect(() => {
    const runtime = supabaseAuthRuntime;
    if (!active || !runtime) return;
    let handle: MaterialAuthHandle;
    try {
      handle = runtime.startMaterialLibraryAuth(setSnapshot);
    } catch {
      setSnapshot({ status: 'error', email: null, message: ADMIN_STATUS_UNCONFIRMED });
      return;
    }
    authRef.current = handle;
    return () => {
      authRef.current = null;
      handle.stop();
    };
  }, [active]);
  const signIn = useCallback((email: string, password: string) => {
    return authRef.current?.signIn(email, password) ?? Promise.resolve({ error: ADMIN_STATUS_UNCONFIRMED });
  }, []);
  const signOut = useCallback(() => {
    void authRef.current?.signOut();
  }, []);
  return { snapshot, signIn, signOut };
}
