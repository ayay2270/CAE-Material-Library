# CAE 材料資料庫 (CAE Material Library)

A compact CAE material data workspace for internal engineering use.

Find a material → inspect its properties → verify the source → compare / map / use the data in CAE.

## V2 Preview Website

[Open the live V2 preview](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/)

Preview repository: [ayay2270/CAE-Material-Library-V2-Preview](https://github.com/ayay2270/CAE-Material-Library-V2-Preview)

V2 is being evaluated before replacing production. This branch does not replace `main`;
production still uses the original repository's `main` branch and existing Pages site.

---

## Current concept branch

**Branch:** `concepts/table-workspace-v2`

[Open this branch on GitHub](https://github.com/ayay2270/CAE-Material-Library/tree/concepts/table-workspace-v2)

This branch implements the selected **Table-first Engineering Workspace** concept.

The design combines:

- a dark left engineering-workspace sidebar
- live Material Category / Source indexes
- a dense engineering data table as the **default Material Library view**
- a grouped **Card View** as a secondary browsing mode
- shared filtering between sidebar navigation, category chips, search, Source, and Updated Time controls

The goal is to keep the fast data-scanning workflow of the original spreadsheet-style Material Library while improving navigation, hierarchy, and category visibility.

> This branch is a concept implementation only.  
> It does **not** replace `main` and does **not** change the current production GitHub Pages deployment.

---

## Preview this V2 branch

The source code for V2 is stored in:

`concepts/table-workspace-v2`

The current V2 snapshot is published at the separate [V2 preview website](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/).
The existing GitHub Pages site remains the production site from `main`; this preview does not overwrite it while evaluation is ongoing.

### Preview locally

```bash
git clone https://github.com/ayay2270/CAE-Material-Library.git
cd CAE-Material-Library
git checkout concepts/table-workspace-v2
npm install
npm run dev
```

Open the local URL shown by Vite, normally:

`http://127.0.0.1:5173/`

### Preview with GitHub Codespaces

Open the V2 branch on GitHub, then choose:

**Code → Codespaces → Create codespace on concepts/table-workspace-v2**

In the Codespaces terminal run:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Then open the forwarded **5173** port from the **Ports** panel.

### Permanent V2 preview

The V2 snapshot is deployed from the public [preview repository](https://github.com/ayay2270/CAE-Material-Library-V2-Preview) using GitHub Actions on its `main` branch, so that:

- V2 can have its own public URL
- `main` remains untouched
- the current production GitHub Pages site remains unchanged
- V2 can continue to evolve independently until it is ready to replace production

---

## Production website

[Open the current production CAE Material Library](https://ayay2270.github.io/CAE-Material-Library/)

Production continues to deploy from **`main`**.

The GitHub Pages workflow remains unchanged and publishes only from the production branch configuration.

---

## Main workspace

### 材料庫

The Material Library opens in **Table View by default**.

The workspace includes:

- Material search
- Material Category filtering
- Source filtering
- Updated Time filtering
- live Category counts
- live Source counts
- Table / Card view switching
- sortable engineering-property columns
- compact category color indicators
- selectable materials
- add / edit / delete material workflows
- material detail drawer
- missing-value display
- Density / Stress unit display controls

### Table View

The primary view is optimized for engineering data scanning.

Typical properties include:

- Material Name
- Category
- Density
- Young's Modulus
- Poisson's Ratio
- Yield Stress
- ETAN
- Ultimate Stress
- Elongation
- Source
- Updated

The table preserves the existing column visibility, reordering, unit handling, sorting, selection, and material-detail behavior.

### Card View

Card View is a secondary browsing mode.

Materials are grouped by category and keep the same underlying:

- material data
- current filters
- selection state
- display units

It is intended for visual browsing rather than replacing the dense table workflow.

### 材料分類與 Source 管理

Click **編輯** beside either sidebar index to add an item or edit its name.
New items remain available with a count of 0 until assigned to a material.
Category names update throughout the table, cards, filters, comparison and map;
their stored category IDs remain stable. Renaming a Source updates all materials
using it and records that change in their history. Material forms offer every
registered category and Source.

### 完整 Stress–strain curve

Open a material's **Detail → 材料曲線 → 加入完整曲線** to paste Strain / Stress
points or import a two-column CSV/TSV file. Select the input units (mm/mm or %;
MPa or GPa), curve definition and strain definition, inspect the preview, then save.
Stored curves can be edited and exported as CSV. All points and their original
order are retained, including softening, unloading and negative values.
Invalid rows block saving. Curves do not alter material properties or ETAN logic.
The original curve calculated from material properties remains available as a
separate option. Material CSV backups include the full curve and metadata in
the **Stress-Strain Curve JSON** column; older CSV files preserve existing curves.

---

## Other functions

- **材料比較**: select 2 or more materials and compare properties. No fixed upper comparison limit; the comparison table can scroll horizontally.
- **Material Map**: simplified Density × Young's Modulus (ρ–E) material map with reading guidance.
- **ETAN 計算**: current placeholder implementation is preserved. This UI concept does not introduce or alter the ETAN engineering formula.
- **欄位設定**: reorder fields, show / hide fields, restore defaults, and configure Density / Stress display units.
- **匯入 / 匯出**: CSV export and CSV import matched by Material Name.
- **Material Detail**: basic properties, curve information, Source / Notes, history, edit, and delete.

---

## Data and engineering behavior

- Values use the **mm–t–N–s** system.
- Density is stored in **t/mm³**.
- Stress values are stored in **MPa**.
- Elongation is stored in **%**.
- Existing engineering values and material meanings are unchanged in this concept branch.
- Stored text such as Source, Notes, and history entries is displayed exactly as saved.
- Seed data contains 11 example materials on first load.
- Material data is currently stored in browser `localStorage` under:
  - `cae-material-library:v1`
- Column order / visibility preferences are stored under:
  - `cae-material-library:columns:v1`
- Category / Source indexes are stored under:
  - `cae-material-library:indexes:v1`

CSV backs up material values and curve data. Index display names and unused
index items are local preferences and are not included in material CSV exports.

Clearing browser site data removes local material data, so export CSV regularly when using the tool for real work.

---

## Tech stack

- React
- TypeScript
- Vite
- Browser localStorage
- GitHub Pages for production deployment

UI language is primarily **Traditional Chinese**.

Engineering property / column names such as `Material Name`, `Density`, `Young's Modulus`, etc. remain in English.

The Lenovo header logo is stored at:

`src/assets/lenovo-logo.png`

---

## Run locally

```bash
git clone https://github.com/ayay2270/CAE-Material-Library.git
cd CAE-Material-Library

git checkout concepts/table-workspace-v2

npm install
npm run dev
```

Build check:

```bash
npm run build
```

The production build is generated into `dist/`.

---

## Branch status

The `concepts/table-workspace-v2` branch currently represents the preferred V2 Material Library UI direction.

Before replacing `main`, continue evaluating the concept in real CAE workflow use, especially:

- material lookup speed
- table readability with larger datasets
- sidebar usefulness
- Table / Card switching
- comparison workflow
- Material Map workflow
- column density at 1440–1920 px desktop widths

Until that evaluation is complete, **keep this branch separate from `main`**.
