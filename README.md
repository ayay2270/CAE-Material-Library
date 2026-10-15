# CAE Material Library — WIP Preview (temporary)

> **This is a temporary preview repository for UI / behavior review. It is NOT the production repository.**
> Do not use it as the production material database.

| | |
|---|---|
| **Preview site** | https://ayay2270.github.io/CAE-Material-Library-V2-WIP-Preview/ |
| **Production site** | https://ayay2270.github.io/CAE-Material-Library-V2-Preview/ (unchanged) |
| **Source of the work** | [`ayay2270/CAE-Material-Library-V2-Preview`](https://github.com/ayay2270/CAE-Material-Library-V2-Preview), branch [`wip/solver-bridge-calculated-h`](https://github.com/ayay2270/CAE-Material-Library-V2-Preview/tree/wip/solver-bridge-calculated-h) |

Production remains unchanged: nothing here has been merged into the production `main` branch or its GitHub Pages site.

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

## Notes for reviewers

- The database sync-status check may still refer to the production repository. That part of the app is read-only and unchanged in this preview.
- This repository and its preview site can be deleted after review without affecting production.
