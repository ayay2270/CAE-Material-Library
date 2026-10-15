# Orthotropic composites

This is an additive schemaVersion 1 extension. Existing records, including legacy
Composite FR4, are unchanged. `materialModel` omitted or `Isotropic` uses the
existing isotropic workflow; for Composite the UI calls this **Isotropic Equivalent**.
Only `category === 'Composite' && materialModel === 'Orthotropic'` activates the
new form, drawer, card and comparison fields.

## Stored fields

All existing Material fields remain present. These additions are optional:

```ts
materialModel?: 'Isotropic' | 'Orthotropic';
subCategory?: string;
orthotropic?: {
  e1: number | null; e2: number | null; e3: number | null;
  g12: number | null; g13: number | null; g23: number | null;
  nu12: number | null; nu13: number | null; nu23: number | null;
};
compositeStrength?: {
  xt: number | null; xc: number | null;
  yt: number | null; yc: number | null; s12: number | null;
};
```

When a nested group is supplied, include its known keys; use `null` for unknown
values. E, G and supplied strengths must be positive finite numbers. ν accepts
any finite number, without an isotropic 0.5 cap or stability constraint.
No missing value is replaced with zero. Stored units are t/mm³ and MPa;
display unit preferences also apply to Orthotropic moduli and strengths.

Selecting another model preserves previously saved inactive data. Table, card,
drawer and compare use the active model and suppress inactive values. Orthotropic
materials are excluded from the single-E Material Map and isotropic plasticity
calculator material picker. No directional value is automatically substituted for E.

The default table and its column preferences are unchanged. Cards show only
ρ, E1, E2, E3, G12; the drawer shows all nine elastic constants and conditionally
shows the strength group. Mixed compare uses `—` for inapplicable properties.

## Persistence and CSV

The shared validator is used by Git JSON loading, JSON backup import, browser
file saving, the local server writer, legacy recovery, GitHub reads and builds.
These paths keep the complete nested objects. No migration is required and
`src/data/materials.json` is not changed by this feature.

CSV retains its original columns and adds:

`Material Model, Sub Category, E1, E2, E3, G12, G13, G23, NU12, NU13, NU23, Xt, Xc, Yt, Yc, S12`.

The model value is stored/exported as `Isotropic` or `Orthotropic`; import also
accepts `Isotropic Equivalent`. CSV units are always base units, independent of
display preferences. Missing extension columns in older CSVs leave existing
extension groups unchanged on same-name updates. Within a supplied group,
blank/omitted constants become null (as with the existing flat-property import).
Invalid new constants or model values skip the entire row with an error message.
CSV change detection includes model, subcategory, constants and strengths, so an
E1-only update is not accidentally skipped. Full JSON is the lossless backup for
IDs, history and arbitrary metadata; CSV keeps its existing name-match semantics.

FR4 seed density remains **1.8E-9 t/mm³**. It is not independently verified here
and is never changed automatically to 2.71E-9. The example constants supplied in
the request are user-entered data, not a new verified seed.

## Future solver mapping (data only)

No solver export, Tsai-Wu or Hashin calculator is implemented.

| Database | Future OptiStruct shell MAT8 |
| --- | --- |
| e1 | E1 |
| e2 | E2 |
| nu12 | NU12 |
| g12 | G12 |
| g13 | G1Z |
| g23 | G2Z |
| e3 / nu13 / nu23 | Retained in the database; omitted from shell MAT8 |

The complete nine constants remain available for a future 3D orthotropic mapping.

## Verification

`npm test` includes `tests/orthotropic.test.mjs` for legacy loading, schema
validation, CSV/JSON, real server and browser-file round-trips, component rendering,
mixed compare, unit conversion and history change detection.

`tests/orthotropic.ui.cjs` runs against a production preview using an isolated
browser file fixture. It exercises real create/edit/save/reload, null values,
validation, model switching, old/new CSV updates, JSON download, cards, drawer,
mixed compare, Metal H/Yield behavior and desktop/mobile layouts. It never writes
the Git seed file. Run it with an installed Playwright and Chromium:

```sh
npm run build
npm run preview
node tests/orthotropic.ui.cjs
```

Optional environment variables: `PLAYWRIGHT_MODULE`, `BROWSER_CHANNEL`,
`PREVIEW_URL` (default port 4173), `OUTPUT_DIR` (screenshots; defaults to OS temp).

Two existing standalone UI scripts have baseline failures on unchanged commit
`d2cba49`: `etan.ui.cjs:32` expects zero calculated steps even though the current
UI includes the calculated reference; `densityTuner.ui.cjs:113` expects an unsaved
draft to survive reload even though persistence requires Save Database. These
scripts are outside the npm test suite and were not changed by this feature.
# Online independent example

Open `?example=fr4-orthotropic` on the deployed site, or use the link in the unlinked database panel. The explicit example banner offers Drawer, Edit and SGCC + FR4 Mixed Compare shortcuts; the existing Add button uses the same material form.

This mode clones the committed database and adds a separate `example-fr4-orthotropic` record. Every original record, including legacy FR4 and its density, is retained. The supplied nine constants are sample values, not confirmed material specifications. No schema migration is required.

“儲存範例” validates and writes only the dedicated `cae-material-library:fr4-example:v1` sessionStorage key. Refresh restores saved edits in that tab. Closing the tab normally clears the sandbox (browser session restoration may retain it). Exiting the example opens the normal library; no example is loaded there. The example bypasses remembered file handles, local dev API loading/writing, legacy recovery and GitHub sync. It never writes the repository or a linked file. Unsaved drafts still trigger the existing leave warning, and JSON export remains available.
