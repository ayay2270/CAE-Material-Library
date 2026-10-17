# Supabase admin authorization foundation

Step 4A prepares the identity model that later material write policies use. The sections below keep that staged design. The current application also signs in, checks admin status, and lets a confirmed Admin add, edit, and delete material rows.

## Current state

The browser client is created with the publishable frontend key. There is one Supabase client and one auth watcher. The user signs in with an existing Supabase Auth identity. Admin membership is a row in `private.material_library_admins`, keyed by that user's UUID. The browser does not read the registry. It calls `material_library.is_current_user_material_admin()`, which returns one boolean and no admin rows.

The UI enables a write only for a confirmed Admin. Signed out, checking, non-admin, and error stay closed. A stale Admin badge does not authorize a write.

Material Add, Edit, and Delete use the normal `material_library.materials` grants and Row Level Security from migration 005. The Admin predicate remains that boundary.

Curve update, category add, category label rename, source add, and source rename use the narrow `SECURITY DEFINER` RPCs from migration 007:

- `material_library.update_material_curve`
- `material_library.add_material_category`
- `material_library.rename_material_category_label`
- `material_library.add_material_source`
- `material_library.rename_material_source`

Every one of those functions calls `private.is_material_admin()`. `EXECUTE` is granted to `authenticated` only. `anon` and `PUBLIC` do not receive it. Category and source tables do not receive generic browser `INSERT`, `UPDATE`, or `DELETE`.

Still unavailable: category delete, source delete, CSV import/write, JSON import/recovery write, Save Database, and the legacy GitHub material write. The generic legacy `editable` flag stays false in Supabase mode.

`supabase/migrations/004_material_library_admin_foundation.sql` is a review artifact. This step does not execute it.

## Catalog access at the end of Step 4A

Migration `003_material_library_public_read.sql` was unchanged by Step 4A.

At that point, `anon` and `authenticated` could `SELECT` from:

- `material_library.categories`
- `material_library.sources`
- `material_library.materials`

Those Step 3 grants are `SELECT` only. The policies are `FOR SELECT` with `USING (true)`. Step 4A added no `INSERT`, `UPDATE`, or `DELETE` grant or policy. Step 4C later added material write policies for a confirmed admin. Categories and sources are still select-only.

## What Step 4A adds

Step 4A adds only:

- schema `private`
- table `private.material_library_admins`
- function `private.is_material_admin()`

`private` is an authorization schema. It is not a Data API schema. This repository has no `config.toml` and no other setting that adds `private` to Supabase exposed schemas. The live project API settings must also leave `private` off the exposed-schema list. The helper must not be created in `public` or `material_library`.

### Admin identity

An admin is a row in `private.material_library_admins`. The primary key is `user_id uuid`, and it references `auth.users(id)` with `ON DELETE CASCADE`. `created_at` is `timestamptz NOT NULL DEFAULT now()`.

The authorization key is the Supabase Auth user UUID. Email, `user_metadata`, a frontend flag, browser storage, and a `service_role` key are not authorization keys. The table stores no email, password, role text, API key, or JWT.

One membership means Material Library Admin. No row means not an admin. Step 4A inserts no row and hard-codes no email or UUID. The Auth user does not exist in this step.

### Who can touch the registry

`PUBLIC`, `anon`, and `authenticated` have no privileges on `private.material_library_admins`. Row Level Security is enabled and there is no policy, so a frontend role cannot read or write the table even if a grant were added later by mistake. The browser must not query this table.

`authenticated` receives `USAGE` on schema `private` and `EXECUTE` on `private.is_material_admin()` only. That is what future row policies need in order to call the predicate. It is not table access.

`EXECUTE` is revoked from `PUBLIC` and `anon`. This migration grants nothing to `service_role`. A `service_role` key stays on the server and is never shipped to the browser.

### Admin predicate

`private.is_material_admin()` returns boolean. It is `LANGUAGE sql`, `STABLE`, and `SECURITY DEFINER`, with `search_path` set to empty. It takes no arguments. It reads the current caller:

```sql
SELECT EXISTS (
  SELECT 1
  FROM private.material_library_admins
  WHERE user_id = (SELECT auth.uid())
);
```

`auth.uid()` and the table are schema-qualified. A null `auth.uid()` matches no row, so an anonymous caller is not an admin. The function owner can read the registry despite the lack of frontend grants. Frontend roles cannot.

## Access after Step 4A

Step 4A left writes closed for every caller, including a future admin. This table describes that step, not the current material policies.

| Caller | SELECT catalog | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | yes | no | no | no |
| authenticated non-admin | yes | no | no | no |
| authenticated admin | yes | no | no | no |

## What later steps added

Step 4A itself inserts no admin row and hard-codes no email or UUID. A later reviewed step registered one existing Auth user in `private.material_library_admins`. This repository still stores neither that email nor that UUID.

Step 4C added material write policies that authorize with:

```sql
(SELECT private.is_material_admin())
```

The current material matrix is:

| Caller | SELECT | Material INSERT | Material UPDATE | Material DELETE |
| --- | --- | --- | --- | --- |
| `anon` | yes | no | no | no |
| authenticated non-admin | yes | denied by RLS | denied by RLS | denied by RLS |
| authenticated material admin | yes | yes | yes | yes |

Those grants and policies are in `005_material_admin_write_policies.sql`, not in Step 4A. They cover `material_library.materials` only. Migration 005 does not grant category or source table writes, and it does not enable CSV or JSON import.

Step 5 adds curve and index writes without changing that table-grant split. `007_material_admin_extended_write_rpcs.sql` defines the five functions listed in Current state. Each is `SECURITY DEFINER` with an empty `search_path`, checks `private.is_material_admin()`, and is executable by `authenticated` only. Category add, category label rename, source add, and source rename also take the same transaction advisory lock. There is no category or source delete RPC and no generic write policy on those tables. The frontend Admin status chooses which buttons to show. It does not decide who is an admin. This Step 5 branch is not merged or deployed.
