-- Read-only Data API access for material_library.
-- SELECT for anon and authenticated only. RLS stays enabled.
-- Does not grant writes, does not grant to PUBLIC, and does not change tables.

GRANT SELECT ON TABLE material_library.categories TO anon, authenticated;
GRANT SELECT ON TABLE material_library.sources TO anon, authenticated;
GRANT SELECT ON TABLE material_library.materials TO anon, authenticated;

CREATE POLICY categories_select_anon_authenticated
  ON material_library.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY sources_select_anon_authenticated
  ON material_library.sources
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY materials_select_anon_authenticated
  ON material_library.materials
  FOR SELECT
  TO anon, authenticated
  USING (true);
