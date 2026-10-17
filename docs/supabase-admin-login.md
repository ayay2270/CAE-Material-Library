# Supabase admin login

Step 4D-1 adds Material Library sign-in and an admin-status display. Login authenticates the Supabase Auth user and then checks Material Library Admin status. It does not by itself grant Admin. A confirmed Admin can Add, Edit, and Delete materials. Those successful writes go directly to Supabase and do not ask for Save Database. A non-admin stays read-only for material CRUD. Curve editing, CSV import, JSON recovery/import, and category or source management stay read-only for every account.

`supabase/migrations/006_material_admin_status_rpc.sql` is a review artifact. This step does not execute it.

## Shared Auth user, separate authorization

CAE Knowledge Base and CAE Material Library can use the same Supabase project. A person who already has a Supabase Auth email/password account can sign in here with that same account. This application does not create a second user and does not encode Knowledge Base behavior.

Authentication identity is project-level. Supabase Auth answers who the current user is.

Material Library authorization is app-specific. Admin membership lives only in `private.material_library_admins`. The browser never reads that table. Knowledge Base storage, including `cae-kb-v4-auth`, is not read or written. Material Library uses the normal Supabase Auth session on its own origin and its own UI lifecycle.

## What the browser may ask

The browser calls one exposed function:

`material_library.is_current_user_material_admin()`

The function has no arguments, returns boolean, and runs as `SECURITY INVOKER` with an empty `search_path`. Its body returns `private.is_material_admin()`. That inner function remains the security-definer predicate from Step 4A. It checks `auth.uid()` against the private registry and returns no rows, emails, or UUIDs.

`EXECUTE` is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted only to `authenticated`. A signed-out visitor is `anon` and cannot execute it. The UI also skips the call when no session exists.

`private` stays off the Data API. This migration does not grant schema exposure, a view, or a table privilege.

## Two different gates

Row Level Security on `material_library.materials` remains the write authorization. An admin session does not bypass it, and a frontend flag cannot satisfy it.

The header reports the auth snapshot. Material Add, Edit, and Delete follow the confirmed Admin state. Row Level Security still accepts or rejects the write.

| UI state | Meaning |
| --- | --- |
| signed out | no session; admin RPC is not called |
| checking | a session exists and the boolean RPC is in flight |
| admin | the RPC returned true |
| non-admin | the RPC returned false |
| error | the session or RPC failed; treated as not admin |

Failure never promotes the user to admin.

## What login enables now

Supabase mode still keeps the legacy `editable` flag false, so Save Database, curve editing, CSV import, JSON recovery, and category or source index editing stay inactive. Material Add, Edit, and Delete use a separate Admin capability. The client sends Auth requests, the boolean RPC, and, for a confirmed Admin, one material insert, update, or delete. It does not upsert, and it does not write categories or sources.

Sign-in is email and password, with session restore and sign-out. There is no signup, password reset, magic link, or OAuth. This document stores no admin email, user id, password, or token.

## 006 review

- The function is `material_library.is_current_user_material_admin()`, not a `private` function.
- `SECURITY INVOKER`, `STABLE`, `search_path = ''`.
- No arguments and no email or UUID parameter.
- The return value is one boolean.
- `anon` cannot execute it. `authenticated` can.
- `private` is not added to exposed schemas.
- This migration does not change table grants or the material write policies added in Step 4C.
