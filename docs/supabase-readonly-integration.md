# Supabase read-only integration

This document originated during the Step 3 read-only phase. The current implementation now supports Admin material CRUD; see the current-state section.

Step 3 added an optional catalog source for Supabase project **CAE Tools**, schema `material_library`.

## Current state

Supabase is the intended production material data source. The branch implementation and a controlled live check are done. `main` has not been merged, and GitHub Pages has not been deployed from this cutover.

When `VITE_MATERIAL_DATA_SOURCE=supabase` and example mode is off:

- Everyone can read the catalog.
- A confirmed Material Library Admin can Add, Edit, and Delete material records. Those writes go directly to Supabase. They are not a local draft and do not use Save Database.
- Row Level Security authorizes every write. The Admin badge does not bypass it.
- Stress-strain curve editing, CSV import, JSON recovery/import, category editing, source editing, category/source index management, the legacy Save Database workflow, and GitHub material sync/write stay read-only.

Without the flag, or with any other value, startup stays on the legacy source below. Legacy mode remains supported.

Orthotropic example mode (`?example=fr4-orthotropic`) still takes precedence over Supabase mode. In that mode the page is a session-only example, not the Supabase catalog.

The ready status label is **資料來源 · Supabase**. Loading is **資料來源 · Supabase（讀取中）**. A failed read is **資料來源 · Supabase（讀取失敗）**. The older ready label **資料來源 · Supabase（唯讀）** is no longer used, because material Add/Edit/Delete are available to a confirmed Admin. Auth status is separate and shows `Admin` only after the boolean admin check succeeds.

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

No service-role key, database password, JWT secret, or other private key is read. Credentials are not hard-coded and must not be committed. The browser client uses the publishable key only.

## Example local configuration

Do not commit `.env` or `.env.local`. Those names are gitignored. For a local Vite process only:

```text
VITE_MATERIAL_DATA_SOURCE=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are required when Supabase mode is requested. The client uses one `createClient` with `db.schema` set to `material_library`. That same client is the Supabase Auth client. Step 3 did not configure Auth; sign-in, admin detection, and material writes were added in Step 4.

Vite inlines `VITE_*` variables at build time. A build without `VITE_MATERIAL_DATA_SOURCE=supabase` stays on the legacy source and does not include the Supabase client.

## What is read

The adapter selects explicit columns from three tables:

| Table | Columns |
| --- | --- |
| `categories` | `id`, `label`, `color` |
| `sources` | `name` |
| `materials` | `id`, `name`, `category_id`, `material_model`, `sub_category`, `density`, `youngs_modulus`, `poisson_ratio`, `yield_stress`, `etan`, `ultimate_stress`, `elongation`, `orthotropic`, `composite_strength`, `stress_strain_curve`, `source`, `notes`, `updated_at`, `history` |

Rows are mapped back to the existing `MasterDatabase` / `Material` shape (`category_id` to `category`, snake_case engineering fields to camelCase, `updated_at` to a UTC ISO `updatedAt`). Null `material_model`, `sub_category`, `orthotropic`, and `composite_strength` are omitted. History, orthotropic constants, composite strength, and stress-strain points are not rewritten. The assembled document must pass the existing `validateDatabase()`.

A failed read throws. The status UI shows **資料來源 · Supabase（讀取失敗）** and the error message. It does not report a successful Supabase connection when the read fails. Step 3 stopped at this read path. Material writes now exist and are described in `docs/supabase-material-crud.md`.

## Status UI

When the flag is on and example mode is off, the source label is one of:

- 資料來源 · Supabase（讀取中）
- 資料來源 · Supabase
- 資料來源 · Supabase（讀取失敗）

Save Database, GitHub sync, local-file onboarding, and the legacy browser-recovery control stay on the legacy path. They are not the Supabase editing workflow.

## GitHub Pages cutover preparation

Step 4F-1 prepares `.github/workflows/pages.yml` to build Supabase mode. That workflow is not a completed production cutover. `main` is still unchanged, and this branch has not been merged or deployed.

The workflow sets `VITE_MATERIAL_DATA_SOURCE` to `supabase`. It reads these repository Actions variables and does not use `.env.local`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The publishable key is frontend configuration. It is bundled into the client. It is not a service-role secret. The workflow must not receive a service-role key or database password.

Before the production build, the workflow checks that both variables are non-empty. If either name is missing, the workflow fails and does not build, upload, or deploy. The build step remains `npm run build:preview`, which uses a relative base for `https://ayay2270.github.io/CAE-Material-Library/`.

The variables must be created in GitHub Settings before the first Supabase Pages deploy. This document does not store their values.

## Database migration

`supabase/migrations/003_material_library_public_read.sql` is a review artifact. This step does not execute it.

It grants `SELECT` on `material_library.categories`, `material_library.sources`, and `material_library.materials` to `anon` and `authenticated`, and adds one `FOR SELECT` policy per table with `USING (true)`. It does not grant `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER`, does not grant to `PUBLIC`, and does not disable RLS or change table definitions.
