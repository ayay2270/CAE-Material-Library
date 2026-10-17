-- Step 4C: admin write authorization for material_library.materials only.
-- Review only. This file is not executed by the application.
-- It does not change rows, columns, categories, sources, or the admin function.

BEGIN;

GRANT INSERT, UPDATE, DELETE ON TABLE material_library.materials TO authenticated;

CREATE POLICY materials_insert_admin
  ON material_library.materials
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select private.is_material_admin())
  );

CREATE POLICY materials_update_admin
  ON material_library.materials
  FOR UPDATE
  TO authenticated
  USING (
    (select private.is_material_admin())
  )
  WITH CHECK (
    (select private.is_material_admin())
  );

CREATE POLICY materials_delete_admin
  ON material_library.materials
  FOR DELETE
  TO authenticated
  USING (
    (select private.is_material_admin())
  );

COMMIT;
