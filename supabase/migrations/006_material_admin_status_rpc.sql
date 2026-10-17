-- Step 4D-1: boolean admin-status RPC for the current authenticated user.
-- Review only. This file is not executed by the application.
-- It does not change rows, table grants, policies, or private.is_material_admin().

BEGIN;

CREATE FUNCTION material_library.is_current_user_material_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.is_material_admin();
$$;

REVOKE ALL ON FUNCTION material_library.is_current_user_material_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.is_current_user_material_admin() FROM anon;
REVOKE ALL ON FUNCTION material_library.is_current_user_material_admin() FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.is_current_user_material_admin() TO authenticated;

COMMIT;
