-- Step 4A: private admin-identity foundation.
-- Review only. This file is not executed by the application.
-- It does not alter material_library data, grants, or policies, and it seeds no admin.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE private.material_library_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.material_library_admins FROM PUBLIC;
REVOKE ALL ON TABLE private.material_library_admins FROM anon;
REVOKE ALL ON TABLE private.material_library_admins FROM authenticated;

ALTER TABLE private.material_library_admins ENABLE ROW LEVEL SECURITY;

-- No policy is intentional. Frontend roles have no grant and no policy.
-- The security-definer function below runs as its owner and is the only reader.

CREATE FUNCTION private.is_material_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.material_library_admins
    WHERE user_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION private.is_material_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_material_admin() FROM anon;
REVOKE ALL ON FUNCTION private.is_material_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION private.is_material_admin() TO authenticated;

COMMIT;
