# Supabase material writes

Step 4E-1 adds a low-level write adapter for `material_library.materials` only. The functions are `insertSupabaseMaterial`, `updateSupabaseMaterial`, and `deleteSupabaseMaterial` in `src/lib/supabaseMaterialWrites.ts`.

The application does not call them yet. Supabase mode stays read-only, `editable` stays false, and Add, Edit, Delete, curve editing, index editing, and CSV import still use the Step 4D message: 「Supabase 目前為唯讀模式；寫入功能將於下一階段開放。」

## Authorization

Row Level Security is the authorization boundary. The adapter does not call `material_library.is_current_user_material_admin()`, and it does not decide who is an admin. A future screen may hide controls for a signed-out user, but a write still succeeds only when the current session passes the existing admin policies on `material_library.materials`.

The adapter uses the existing `createMaterialLibraryClient()` singleton. It does not create a second client and does not use a service role, secret key, or database password.

## One row at a time

Each call writes one material. The caller supplies the complete `Material`, including `id` and `history`. The adapter does not generate ids, rewrite history, reorder stress-strain points, calculate H, or change engineering numbers. `etan` is stored as the existing legacy column.

There is no upsert. An update that does not find the id does not insert a row. Category and source tables are not written. CSV import and bulk changes are deferred.

## Returned rows

Insert and update ask PostgREST for the explicit material column list already used by `readSupabaseDatabase`, then map that row back with `mapMaterialRow`. Delete asks only for `id`.

A Supabase error becomes a Traditional Chinese application error. Zero returned rows is also a failure, even when Supabase reports no error. That is how a non-admin update or delete behaves under the current policies: the statement matches nothing and does not raise. The adapter reports 「材料不存在或目前帳號沒有更新權限。」 or 「材料不存在或目前帳號沒有刪除權限。」 instead of treating that response as success.
