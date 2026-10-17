-- Step 5B1: admin-only RPCs for curve update and category/source index writes.
-- Review only. This file is not executed by the application.
-- It does not grant INSERT, UPDATE, or DELETE on categories or sources.
-- It does not add a delete RPC, a table policy, or a second material UPDATE policy.
-- Run it later as the table owner. SECURITY DEFINER bypasses RLS for that owner,
-- so every function below checks private.is_material_admin() itself.

BEGIN;

-- Shared transaction lock for category add, category label rename, source add,
-- and source rename. The key pair (741051, 5) is a stable application namespace.
-- It is not a table index, and this migration does not create one.
-- Curve updates do not take this lock; one material row is already locked by its primary key.

CREATE OR REPLACE FUNCTION material_library.update_material_curve(
  p_material_id text,
  p_curve jsonb
)
RETURNS SETOF material_library.materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count pg_catalog.int8;
  v_points pg_catalog.int4;
  v_point pg_catalog.jsonb;
  v_ts pg_catalog.timestamptz;
  v_at pg_catalog.text;
  v_summary pg_catalog.text;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  IF p_material_id IS NULL OR pg_catalog.btrim(p_material_id) = '' THEN
    RAISE EXCEPTION 'material id is required'
      USING ERRCODE = '23514';
  END IF;

  IF p_curve IS NULL OR pg_catalog.jsonb_typeof(p_curve) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'curve must be a JSON object'
      USING ERRCODE = '23514';
  END IF;

  IF pg_catalog.jsonb_typeof(p_curve -> 'points') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_curve -> 'points') < 2 THEN
    RAISE EXCEPTION 'curve requires at least two points'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_curve -> 'points') AS element(point)
    WHERE pg_catalog.jsonb_typeof(point) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(point -> 'strain') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(point -> 'stress') IS DISTINCT FROM 'number'
  ) THEN
    RAISE EXCEPTION 'curve point strain and stress must be numbers'
      USING ERRCODE = '23514';
  END IF;

  FOR v_point IN
    SELECT point
    FROM pg_catalog.jsonb_array_elements(p_curve -> 'points') AS element(point)
  LOOP
    BEGIN
      PERFORM (v_point ->> 'strain')::pg_catalog.float8;
      PERFORM (v_point ->> 'stress')::pg_catalog.float8;
    EXCEPTION
      WHEN numeric_value_out_of_range OR invalid_text_representation THEN
        RAISE EXCEPTION 'curve point strain and stress must be finite numbers'
          USING ERRCODE = '23514';
    END;
  END LOOP;

  IF pg_catalog.jsonb_typeof(p_curve -> 'definition') IS DISTINCT FROM 'string'
     OR (p_curve ->> 'definition') NOT IN ('engineering', 'true', 'unspecified')
     OR pg_catalog.jsonb_typeof(p_curve -> 'strainKind') IS DISTINCT FROM 'string'
     OR (p_curve ->> 'strainKind') NOT IN ('total', 'plastic', 'unspecified')
     OR pg_catalog.jsonb_typeof(p_curve -> 'source') IS DISTINCT FROM 'string'
     OR pg_catalog.jsonb_typeof(p_curve -> 'notes') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'curve definition, strain kind, source, or notes is invalid'
      USING ERRCODE = '23514';
  END IF;

  v_points := pg_catalog.jsonb_array_length(p_curve -> 'points');
  v_ts := pg_catalog.clock_timestamp();
  v_at := pg_catalog.to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_summary := 'Stress–strain curve：' || v_points::pg_catalog.text || ' 個完整資料點';

  RETURN QUERY
  WITH updated AS (
    UPDATE material_library.materials
    SET
      stress_strain_curve = p_curve,
      updated_at = v_ts,
      history = pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'at', v_at,
          'action', 'edited',
          'summary', v_summary
        )
      ) || history
    WHERE id = p_material_id
    RETURNING *
  )
  SELECT * FROM updated;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'material not found'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION material_library.add_material_category(p_name text)
RETURNS SETOF material_library.categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name pg_catalog.text;
  v_count pg_catalog.int8;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'category name is required'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'category name exceeds 120 characters'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.lower(v_name) = 'all' THEN
    RAISE EXCEPTION 'all is reserved'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(741051, 5);

  IF EXISTS (
    SELECT 1
    FROM material_library.categories AS category
    WHERE pg_catalog.lower(category.id) = pg_catalog.lower(v_name)
       OR pg_catalog.lower(category.label) = pg_catalog.lower(v_name)
  ) THEN
    RAISE EXCEPTION 'category name already exists'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO material_library.categories (id, label, color)
    VALUES (v_name, v_name, '#6b7b92')
    RETURNING *
  )
  SELECT * FROM inserted;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'category was not inserted'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION material_library.rename_material_category_label(
  p_id text,
  p_label text
)
RETURNS SETOF material_library.categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_label pg_catalog.text;
  v_current_label pg_catalog.text;
  v_count pg_catalog.int8;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  IF p_id IS NULL OR pg_catalog.btrim(p_id) = '' THEN
    RAISE EXCEPTION 'category id is required'
      USING ERRCODE = '23514';
  END IF;

  v_label := pg_catalog.btrim(p_label);
  IF v_label IS NULL OR v_label = '' THEN
    RAISE EXCEPTION 'category label is required'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.char_length(v_label) > 120 THEN
    RAISE EXCEPTION 'category label exceeds 120 characters'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.lower(v_label) = 'all' THEN
    RAISE EXCEPTION 'all is reserved'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(741051, 5);

  SELECT category.label
  INTO v_current_label
  FROM material_library.categories AS category
  WHERE category.id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'category does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_label = v_current_label THEN
    RETURN QUERY
    SELECT *
    FROM material_library.categories AS category
    WHERE category.id = p_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN
      RAISE EXCEPTION 'category does not exist'
        USING ERRCODE = 'P0002';
    END IF;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM material_library.categories AS category
    WHERE category.id <> p_id
      AND (
        pg_catalog.lower(category.id) = pg_catalog.lower(v_label)
        OR pg_catalog.lower(category.label) = pg_catalog.lower(v_label)
      )
  ) THEN
    RAISE EXCEPTION 'category label already exists'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE material_library.categories
    SET label = v_label
    WHERE id = p_id
    RETURNING *
  )
  SELECT * FROM updated;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'category was not renamed'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION material_library.add_material_source(p_name text)
RETURNS SETOF material_library.sources
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name pg_catalog.text;
  v_count pg_catalog.int8;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  v_name := pg_catalog.btrim(p_name);
  IF v_name IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'source name is required'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'source name exceeds 120 characters'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.lower(v_name) = 'all' THEN
    RAISE EXCEPTION 'all is reserved'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(741051, 5);

  IF EXISTS (
    SELECT 1
    FROM material_library.sources AS source
    WHERE pg_catalog.lower(source.name) = pg_catalog.lower(v_name)
  ) THEN
    RAISE EXCEPTION 'source name already exists'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY
  WITH inserted AS (
    INSERT INTO material_library.sources (name)
    VALUES (v_name)
    RETURNING *
  )
  SELECT * FROM inserted;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'source was not inserted'
      USING ERRCODE = 'P0002';
  END IF;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION material_library.rename_material_source(
  p_old_name text,
  p_new_name text
)
RETURNS TABLE (
  old_name text,
  new_name text,
  affected_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old pg_catalog.text;
  v_new pg_catalog.text;
  v_ts pg_catalog.timestamptz;
  v_at pg_catalog.text;
  v_summary pg_catalog.text;
  v_deleted pg_catalog.int8;
BEGIN
  IF private.is_material_admin() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'insufficient privilege'
      USING ERRCODE = '42501';
  END IF;

  v_old := pg_catalog.btrim(p_old_name);
  v_new := pg_catalog.btrim(p_new_name);
  IF v_old IS NULL OR v_old = '' THEN
    RAISE EXCEPTION 'source name is required'
      USING ERRCODE = '23514';
  END IF;
  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION 'source name is required'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.char_length(v_new) > 120 THEN
    RAISE EXCEPTION 'source name exceeds 120 characters'
      USING ERRCODE = '23514';
  END IF;
  IF pg_catalog.lower(v_new) = 'all' THEN
    RAISE EXCEPTION 'all is reserved'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(741051, 5);

  IF NOT EXISTS (
    SELECT 1
    FROM material_library.sources AS source
    WHERE source.name = v_old
  ) THEN
    RAISE EXCEPTION 'source does not exist'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_old = v_new THEN
    old_name := v_old;
    new_name := v_new;
    affected_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM material_library.sources AS source
    WHERE source.name <> v_old
      AND pg_catalog.lower(source.name) = pg_catalog.lower(v_new)
  ) THEN
    RAISE EXCEPTION 'source name already exists'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO material_library.sources (name)
  VALUES (v_new);

  v_ts := pg_catalog.clock_timestamp();
  v_at := pg_catalog.to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_summary := 'Source：' || v_old || ' → ' || v_new || '（來源索引重新命名）';

  UPDATE material_library.materials
  SET
    source = v_new,
    updated_at = v_ts,
    history = pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'at', v_at,
        'action', 'edited',
        'summary', v_summary
      )
    ) || history
  WHERE source = v_old;

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  DELETE FROM material_library.sources
  WHERE name = v_old;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 1 THEN
    RAISE EXCEPTION 'old source was not deleted'
      USING ERRCODE = 'P0002';
  END IF;

  old_name := v_old;
  new_name := v_new;
  RETURN NEXT;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION material_library.update_material_curve(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.update_material_curve(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION material_library.update_material_curve(text, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.update_material_curve(text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION material_library.add_material_category(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.add_material_category(text) FROM anon;
REVOKE ALL ON FUNCTION material_library.add_material_category(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.add_material_category(text) TO authenticated;

REVOKE ALL ON FUNCTION material_library.rename_material_category_label(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.rename_material_category_label(text, text) FROM anon;
REVOKE ALL ON FUNCTION material_library.rename_material_category_label(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.rename_material_category_label(text, text) TO authenticated;

REVOKE ALL ON FUNCTION material_library.add_material_source(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.add_material_source(text) FROM anon;
REVOKE ALL ON FUNCTION material_library.add_material_source(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.add_material_source(text) TO authenticated;

REVOKE ALL ON FUNCTION material_library.rename_material_source(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION material_library.rename_material_source(text, text) FROM anon;
REVOKE ALL ON FUNCTION material_library.rename_material_source(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION material_library.rename_material_source(text, text) TO authenticated;

COMMIT;
