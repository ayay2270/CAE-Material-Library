import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** One client per module. A second createClient() would construct another GoTrueClient. */
let materialLibraryClient: SupabaseClient<any, 'material_library'> | null = null;

/** Shared browser client for material_library schema access, the Supabase Auth session, and the Admin capability flow. */
export function createMaterialLibraryClient(): SupabaseClient<any, 'material_library'> {
  if (materialLibraryClient) return materialLibraryClient;
  const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Supabase 讀取需要 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY。');
  }
  materialLibraryClient = createClient<any, 'material_library'>(url, key, {
    db: {
      schema: 'material_library',
    },
  });
  return materialLibraryClient;
}
