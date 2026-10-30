# HyperMesh NU31 derived display

## Source and convention

Production uses Supabase `material_library.materials`, not `src/data/materials.json`.
A read-only query on 2026-10-30 confirmed record `seed-4` is FR4 / Orthotropic:
E1 = 22000 MPa, E3 = 4400 MPa, ν13 = 0.28, ν23 = 0.4, G13 = 1720 MPa.

Altair's [MAT9OR reference](https://help.altair.com/hwsolvers/os/topics/solvers/os/mat9ort_bulk_r.htm),
comment 3, gives νij / Ei = νji / Ej. Therefore:

`ν31=ν13×E3/E1=0.28×4400/22000=0.056`

The [SYSSETTING reference](https://help.altair.com/hwsolvers/os/topics/solvers/os/syssetting_io_r.htm)
defines `MAT9ORT=NU31` as the default interpretation of MAT9OR field 8.
If explicitly set to `MAT9ORT=NU13`, field 8 instead takes the original ν13 (0.28).
MAT9OR's blank-field default copies NU23; it is not a reciprocal conversion.
For this FR4, leaving the field blank would use 0.4 rather than 0.056.
G31 and G13 denote the same shear plane, so G31 remains 1720 MPa.

## Implementation

The material detail page and legacy orthotropic drawer show a separate
`NU31（HyperMesh）` result below the original Poisson ratios. It is derived for
active orthotropic materials from the current record, so Supabase edits update it
automatically. No schema migration, database write, seed rewrite, stored NU31, or
change to ν13 / G13 is needed. CSV and JSON continue to export source constants.

Missing or invalid inputs show `—`, with the required inputs explained in the
formula disclosure. Non-positive moduli and non-finite values are rejected;
finite negative and zero ν13 values are supported. Moduli must use the same unit.
The ratio is unit independent and retains enough precision to show 0.056.

The disclosure is closed initially and opens on hover, keyboard focus, or
click/tap. It stays open while the pointer or focus is inside, including over
the official reference links. Clicking pins it; a second click, Escape, outside
pointer press, or focus leaving dismisses it. A native button exposes its state
and controls relationship. The panel stays in document flow, wraps long formula
text, and uses existing theme tokens. It has no motion and works with zoom.

## Verification and release

`tests/orthotropicNu31.test.ts` checks the FR4 result, reciprocal relation,
unit invariance, changed source inputs, preservation of source data, invalid
inputs, and DOM interactions. The existing detail-page integration test also
checks the separate 0.056 result and initially hidden formula.

Run `npm test`, `npm run build:preview` with the existing Supabase build settings,
and `npm run test:production`. Verify the production-data preview at
`?material=seed-4`, including keyboard focus, click dismissal and a narrow viewport.

Release follows the existing pull-request review and `main` GitHub Pages workflow
in `.github/workflows/pages.yml`. Opening a PR does not deploy to production.
