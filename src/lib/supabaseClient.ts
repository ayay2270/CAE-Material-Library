import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Browser client for the read-only material_library schema. No auth configuration. */
export function createMaterialLibraryClient(): SupabaseClient<any, 'material_library'> {
  const url = import.meta.env?.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('Supabase 讀取需要 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY。');
  }
  return createClient<any, 'material_library'>(url, key, {
    db: {
      schema: 'material_library',
    },
  });
}
