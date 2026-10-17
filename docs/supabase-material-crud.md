# Supabase material writes

Step 4E-1 adds a low-level write adapter for `material_library.materials` only. The functions are `insertSupabaseMaterial`, `updateSupabaseMaterial`, and `deleteSupabaseMaterial` in `src/lib/supabaseMaterialWrites.ts`.

Step 4E-2B wires those three functions into the app for a confirmed Supabase Admin. The wired operations are Add Material, Edit Material basic fields, and Delete Material. A successful write is stored directly. It is not a local draft, it does not set the unsaved flag, and it does not ask the user to press Save Database.

`editable` is unchanged. Supabase mode remains false for that flag. Material add, edit, and delete use a separate `materialCrudEnabled` flag: the existing legacy/example `editable` value, or Supabase data source with auth status `admin`.

## Authorization

Row Level Security is the authorization boundary. The app does not call `material_library.is_current_user_material_admin()` again, and it does not start a second auth watcher. Hiding Add, Edit, and Delete is only a convenience. A write still succeeds only when the current session passes the existing admin policies on `material_library.materials`.

The adapter uses the existing `createMaterialLibraryClient()` singleton. It does not create a second client and does not use a service role, secret key, or database password.

Accounts that are signed out, still checking, non-admin, or in an auth error cannot open material add, edit, or delete. The message is 「目前帳號沒有材料寫入權限。」

## One row at a time

Each call writes one material. The app generates the material id and `updatedAt`, builds the created or edited history entry, and then calls the adapter. The adapter does not generate ids, rewrite history, reorder stress-strain points, calculate H, or change engineering numbers. `etan` is stored as the existing legacy column.

The local material list changes only after the adapter returns the written row or the deleted id. Insert and update keep the returned material. A failed write leaves the list as it was, and the form or delete dialog stays open with the error.

There is no upsert. An update that does not find the id does not insert a row. Category and source tables are not written. CSV import and bulk changes are deferred.

## Returned rows

Insert and update ask PostgREST for the explicit material column list already used by `readSupabaseDatabase`, then map that row back with `mapMaterialRow`. Delete asks only for `id`.

A Supabase error becomes a Traditional Chinese application error. Zero returned rows is also a failure, even when Supabase reports no error. That is how a non-admin update or delete behaves under the current policies: the statement matches nothing and does not raise. The adapter reports 「材料不存在或目前帳號沒有更新權限。」 or 「材料不存在或目前帳號沒有刪除權限。」 instead of treating that response as success.

## Still deferred

A Supabase Admin still cannot edit a stress-strain curve, edit category or source indexes, import CSV, recover or import JSON, or use Save Database. Those controls stay on the storage `editable` flag, which is false in Supabase mode. There is no adapter for category or source writes.

Source is restricted to the existing source index while adding or editing a Supabase material. The form does not accept an arbitrary new source, and the write is refused before the adapter runs. Legacy and example mode still allow free-text Source.

## Live validation

Step 4E-2C was manually verified against the live Supabase project. No credential, token, or admin identity is recorded here.

The baseline catalog had 11 materials. The controlled row was `ZZZ_STEP4E2C_TEST`.

Observed sequence:

- INSERT raised the count from 11 to 12, and the row was still there after reload.
- UPDATE changed only Notes. The count stayed 12. The new notes and history were still there after reload.
- DELETE returned the count from 12 to 11. Reload confirmed the test row was absent.
- The original 11 materials remained.

## Pages status

The GitHub Pages workflow on this branch is prepared to build Supabase mode from Actions variables. Production merge and deployment have not happened. `main` is still the previous legacy Pages build. See `docs/supabase-readonly-integration.md`.
