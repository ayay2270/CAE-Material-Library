# Supabase material write authorization

Step 4C allows a Material Library admin to insert, update, and delete rows in `material_library.materials`. Everyone else stays read-only.

`supabase/migrations/005_material_admin_write_policies.sql` is a review artifact. This step does not execute it.

## Two layers

`GRANT` lets the `authenticated` database role reach `INSERT`, `UPDATE`, and `DELETE` on `material_library.materials`. PostgREST can then attempt those operations for a signed-in user.

Row Level Security decides whether the current caller is an admin. Every write policy calls `private.is_material_admin()`, which is true only when `auth.uid()` is present in `private.material_library_admins`.

The browser is not an authorization boundary. A frontend flag, email address, or `user_metadata` value is not consulted.

## Permission matrix

`materials_select_anon_authenticated` is unchanged. `anon` and `authenticated` can still `SELECT` materials.

| Caller | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `anon` | yes | no | no | no |
| authenticated non-admin | yes | denied by RLS | denied by RLS | denied by RLS |
| authenticated admin | yes | yes | yes | yes |

`material_library.categories` and `material_library.sources` stay `SELECT` only for `anon` and `authenticated`. This migration does not grant them writes and does not add write policies.

`anon` receives no `INSERT`, `UPDATE`, or `DELETE` grant. `PUBLIC` and `service_role` receive no new grant. `TRUNCATE`, `REFERENCES`, and `TRIGGER` are not granted.

## Policies on `material_library.materials`

| Policy | Command | Role | Predicate |
| --- | --- | --- | --- |
| `materials_select_anon_authenticated` | `SELECT` | `anon`, `authenticated` | `USING (true)`, unchanged |
| `materials_insert_admin` | `INSERT` | `authenticated` | `WITH CHECK ((select private.is_material_admin()))` |
| `materials_update_admin` | `UPDATE` | `authenticated` | `USING` and `WITH CHECK` both call `private.is_material_admin()` |
| `materials_delete_admin` | `DELETE` | `authenticated` | `USING ((select private.is_material_admin()))` |

An authenticated non-admin has the table privilege, so the request reaches the table. The admin predicate is false, so RLS does not accept the write. An authenticated admin passes `private.is_material_admin()`, so the same grants succeed.

No material rows are inserted, updated, or deleted by this file. No admin UUID is stored in the repository.

## Read-only checks after 005 is applied

Run these only after the migration has been executed. They do not change data.

### A. Grants

```sql
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'material_library'
  AND table_name IN ('categories', 'sources', 'materials')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

Expected:

- `anon` on `categories`, `sources`, and `materials`: `SELECT` only
- `authenticated` on `categories` and `sources`: `SELECT` only
- `authenticated` on `materials`: `SELECT`, `INSERT`, `UPDATE`, `DELETE`

### B. Materials policies

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'material_library'
  AND tablename = 'materials'
ORDER BY policyname;
```

Expected policies:

- `materials_select_anon_authenticated` — `SELECT`
- `materials_insert_admin` — `INSERT`
- `materials_update_admin` — `UPDATE`
- `materials_delete_admin` — `DELETE`

### C. Categories and sources stay select-only

```sql
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'material_library'
  AND tablename IN ('categories', 'sources')
ORDER BY tablename, policyname;
```

Expected: `categories_select_anon_authenticated` and `sources_select_anon_authenticated`, both `SELECT`.

### D. `anon` has no material write privilege

```sql
SELECT privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'material_library'
  AND table_name = 'materials'
  AND grantee = 'anon'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
```

Expected: no rows.
