# Supabase admin authorization foundation

Step 4A prepares the identity model that later material write policies will use. It does not sign anyone in, and it does not allow anyone to write the catalog.

`supabase/migrations/004_material_library_admin_foundation.sql` is a review artifact. This step does not execute it.

## Current catalog access

Migration `003_material_library_public_read.sql` is unchanged.

`anon` and `authenticated` may `SELECT` from:

- `material_library.categories`
- `material_library.sources`
- `material_library.materials`

Those grants are `SELECT` only. The policies are `FOR SELECT` with `USING (true)`. There is no `INSERT`, `UPDATE`, or `DELETE` grant or policy on those tables.

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

Writes are still closed for every caller, including a future admin.

| Caller | SELECT catalog | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | yes | no | no | no |
| authenticated non-admin | yes | no | no | no |
| authenticated admin | yes | no | no | no |

## Later steps, not this one

A person will sign in through Supabase Auth. After that user exists, a separate reviewed step can insert that user's UUID into `private.material_library_admins`.

Future material write policies, still not created here, will authorize with:

```sql
(SELECT private.is_material_admin())
```

The intended later matrix is:

| Caller | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | yes | no | no | no |
| authenticated non-admin | yes | no | no | no |
| authenticated admin | yes | future yes | future yes | future yes |

Those future write permissions are not grants and not policies in Step 4A. The application has no login, signup, or catalog editor for Supabase in this step. The frontend does not decide who is an admin.
