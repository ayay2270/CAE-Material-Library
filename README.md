# CAE Material Library

Repository: https://github.com/ayay2270/CAE-Material-Library

Current development branch: `wip/supabase-admin-auth-step4`

Prepared GitHub Pages URL: https://ayay2270.github.io/CAE-Material-Library/

Supabase-backed Material Library is prepared on this branch. A confirmed Admin can Add, Edit, and Delete materials, and that path was live-verified. The GitHub Pages workflow is prepared to build Supabase mode. `main` has not been merged or deployed yet, so the production Supabase cutover is not complete.

## What is being previewed

- **H is calculated automatically** from Young's Modulus, Yield Stress, Ultimate Stress and Elongation.
- **ETAN is calculated automatically** from E and H: `ETAN = E × H / (E + H)`.
- **New Solver Bridge layout** in the Material Detail drawer (基本性質): OptiStruct H and LS-DYNA ETAN side by side, with equivalent fields aligned row by row (E/E, NU/PR, RHO/RO, LIMIT1/SIGY). Materials that cannot calculate H show which inputs are missing.
- **Table, Cards, Compare and the ETAN page use calculated H.**
- **The manual H input is hidden** from the isotropic material form.
- **Legacy stored `etan` data is preserved** for backward compatibility. It is kept unchanged when a material is edited, but it is no longer displayed or used as H.
- **CSV / JSON / database schema behavior has NOT been migrated yet.**
- **Orthotropic Composite behavior is unchanged.** Orthotropic materials still bypass H / ETAN.

## Known limitation (deferred to a later phase)

CSV export still writes the **legacy stored H** value, while the UI displays the **calculated H**.

| Material | H shown in the UI | Legacy stored / exported H |
|---|---|---|
| Al7050 | 1196.42 MPa | 1205.42 MPa |

## Notes

Curve editing, CSV import, JSON recovery/import, and category or source management stay read-only in Supabase mode. Legacy mode remains available when Supabase mode is off.
