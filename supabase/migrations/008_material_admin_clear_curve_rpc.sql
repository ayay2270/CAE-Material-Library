-- Step 5G: admin-only RPC that clears one material's stored stress-strain curve.
-- Review only. This file is not executed by the application.
-- A repeated call is a no-op once the curve is already NULL, so a retry after a
-- lost response does not append another history entry or change updated_at.
-- It does not remove the material row and does not change any other material column.
-- It does not grant table writes, and it does not add a table policy.
-- Run it later as the table owner. SECURITY DEFINER bypasses RLS for that owner,
-- so the function checks private.is_material_admin() itself.

BEGIN;

CREATE OR REPLACE FUNCTION material_library.clear_material_curve(
  p_material_id text
)
RETURNS SETOF material_library.materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_curve pg_catalog.jsonb;
  v_count pg_catalog.int8;
  v_ts pg_catalog.timestamptz;
  v_at pg_catalog.text;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  IF p_material_id IS NULL OR pg_catalog.btrim(p_material_id) = '' THEN
    RAISE EXCEPTION 'material id is required'
      USING ERRCODE = '23514';
  END IF;

  -- Lock only this material row. A second clear waits, then sees the cleared row.
  SELECT stress_strain_curve
  INTO v_curve
  FROM material_library.materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'material not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_curve IS NULL THEN
    RETURN QUERY
    SELECT *
    FROM material_library.materials
    WHERE id = p_material_id;
    RETURN;
  END IF;

  v_ts := pg_catalog.clock_timestamp();
  v_at := pg_catalog.to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  RETURN QUERY
  UPDATE material_library.materials
  SET
    stress_strain_curve = NULL,
    updated_at = v_ts,
    history = pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'at', v_at,
        'action', 'edited',
        'summary', 'Stress–strain curve：已移除完整曲線'
      )
    ) || history
  WHERE id = p_material_id
  RETURNING *;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'material not found'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION material_library.clear_material_curve(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.clear_material_curve(text) FROM anon;
REVOKE ALL ON FUNCTION material_library.clear_material_curve(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.clear_material_curve(text) TO authenticated;

COMMIT;
