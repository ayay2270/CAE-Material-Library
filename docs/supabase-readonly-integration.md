# Supabase read-only integration

This step adds an optional read-only catalog source for Supabase project **CAE Tools**, schema `material_library`.

The Git/local JSON database remains the application default. Supabase is not contacted, and the existing local file, Vite writer, GitHub sync, and legacy recovery paths stay in place, unless the flag below is set.

## Feature flag

Supabase mode is active only when:

```text
VITE_MATERIAL_DATA_SOURCE=supabase
```

If the variable is absent or has any other value, startup behavior is unchanged:

- committed `src/data/materials.json`
- local Vite database writer in development
- File System Access API
- GitHub sync
- local editing and Save Database
- legacy recovery

Orthotropic example mode (`?example=orthotropic`) still takes precedence over Supabase mode.

No service-role key, database password, JWT secret, or other private key is read. Credentials are not hard-coded and must not be committed.

## Example local configuration

Do not commit `.env` or `.env.local`. Those names are gitignored. For a local Vite process only:

```text
VITE_MATERIAL_DATA_SOURCE=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required when Supabase mode is requested. The client uses `createClient` with `db.schema` set to `material_library`. Auth is not configured in this step.

Vite inlines `VITE_*` variables at build time. A production build without `VITE_MATERIAL_DATA_SOURCE=supabase` stays on the legacy source and does not include the Supabase client. Set the variable only for a later, intentional cutover after manual verification.

## What is read

The adapter selects explicit columns from three tables:

| Table | Columns |
| --- | --- |
| `categories` | `id`, `label`, `color` |
| `sources` | `name` |
| `materials` | `id`, `name`, `category_id`, `material_model`, `sub_category`, `density`, `youngs_modulus`, `poisson_ratio`, `yield_stress`, `etan`, `ultimate_stress`, `elongation`, `orthotropic`, `composite_strength`, `stress_strain_curve`, `source`, `notes`, `updated_at`, `history` |

Rows are mapped back to the existing `MasterDatabase` / `Material` shape (`category_id` to `category`, snake_case engineering fields to camelCase, `updated_at` to a UTC ISO `updatedAt`). Null `material_model`, `sub_category`, `orthotropic`, and `composite_strength` are omitted. History, orthotropic constants, composite strength, and stress-strain points are not rewritten. The assembled document must pass the existing `validateDatabase()`.

A failed read throws. The status UI shows **資料來源 · Supabase（讀取失敗）** and the error message. It does not report a successful Supabase connection when the read fails. There are no Supabase writes.

## Status UI

When the flag is on and example mode is off, `DatabaseStatus` shows only:

- 資料來源 · Supabase（讀取中）
- 資料來源 · Supabase（唯讀）
- 資料來源 · Supabase（讀取失敗）

Editing, Save Database, GitHub sync, and local-file onboarding stay on the legacy path.

## Database migration

`supabase/migrations/003_material_library_public_read.sql` is a review artifact. This step does not execute it.

It grants `SELECT` on `material_library.categories`, `material_library.sources`, and `material_library.materials` to `anon` and `authenticated`, and adds one `FOR SELECT` policy per table with `USING (true)`. It does not grant `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`, does not grant to `PUBLIC`, and does not disable RLS or change table definitions.
