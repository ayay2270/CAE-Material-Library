# CAE Material Library

Repository: https://github.com/ayay2270/CAE-Material-Library

GitHub Pages: https://ayay2270.github.io/CAE-Material-Library/

The deployed site uses Supabase as the material catalog. Everyone can browse it. This branch, `wip/supabase-admin-extended-writes-step5`, adds the confirmed-Admin curve and category/source writes below. It is not merged to `main` and it is not deployed.

## Supabase capability

Everyone can read the catalog.

A confirmed Material Library Admin can:

- Add, edit, and delete a material
- Add, edit, or delete a stored full stress-strain curve. Deleting that curve does not delete the material.
- Add a category, or rename its display label
- Add a source, or rename it

Those writes go directly to Supabase. They do not create a local draft and they do not require Save Database.

Still unavailable in Supabase mode:

- Category delete
- Source delete
- CSV import/write
- JSON import/recovery write
- Save Database
- Legacy GitHub material write

The generic legacy `editable` flag stays false in Supabase mode. It still closes the deferred features above. Legacy mode remains available when Supabase mode is off.

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

Supabase Admin writes listed above are direct. Legacy local editing still keeps a draft until Save Database.
