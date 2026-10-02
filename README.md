# CAE 材料資料庫 (CAE Material Library)

## Live Website

[Open CAE Material Library](https://ayay2270.github.io/CAE-Material-Library/)

A compact, spreadsheet-style CAE material data ledger for internal engineering use.
Find a material → inspect its properties → verify the source → use the data in CAE.

Stack: React + TypeScript + Vite. No backend; data is kept in the browser's `localStorage`
(`cae-material-library:v1`) and seeded with 11 sample materials on first load.
UI language: Traditional Chinese. Property / column names (Material Name, Density, Young's Modulus, …) stay English.

## Run

```bash
git clone https://github.com/ayay2270/CAE-Material-Library.git
cd CAE-Material-Library
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # type-check + production build into dist/ (static, relative base)
```

## Features

- **材料列表**: dense full-width table, one search box, filters (材料類別 / 來源 / 更新時間), sortable columns,
  sticky header / Material Name / Actions, missing values shown as hatched `—`.
- **欄位設定**: drag (or ▲▼ buttons) to reorder columns, tick to show / hide, 還原預設. Material Name is pinned.
  Order and visibility are saved in `localStorage` (`cae-material-library:columns:v1`). Density / stress display units live here too.
- **材料比較**: tick 2 or more rows → 比較材料. No upper limit; the table scrolls horizontally.
- **材料地圖**: one simplified Density × Young's Modulus (ρ–E) scatter with an ⓘ reading guide.
- Row click opens a detail drawer (基本性質 / 材料曲線 / 來源與備註 / 歷史記錄) with edit and delete.
- 匯入 / 匯出: CSV export (all or current list) and CSV import (matched by Material Name).

## Notes

- Values are stored in the mm–t–N–s system (density t/mm³, stress MPa, elongation %).
- Stored text (Source, Notes, history entries) is displayed exactly as saved — it is never auto-translated.
- The header logo is `src/assets/lenovo-logo.png`.
- ETAN 算法 page is a placeholder: add the formula in `src/lib/etan.ts` (`calcEtan`).
- Deployment: GitHub Actions (`.github/workflows/pages.yml`) builds `dist/` and publishes it to GitHub Pages on every push to `main`.
- Clearing site data removes the library; export CSV regularly.

## UI concept gallery (exploration branch only)

Five alternative UI/UX concepts that reuse the same data and logic (storage, units, sorting/filtering, 欄位設定, Material Map, compare, CSV).
They do **not** change the production app and run on their own port, so their `localStorage` is separate from the app's.

```bash
npm run concepts          # http://127.0.0.1:5174/concepts/  (gallery; "/" redirects here)
npm run concepts:build    # static build into concepts-dist/ (not part of the production build)
```

Concepts live in `src/concepts/` (A Ledger · B Explorer · C Quick-Find · D Workbench · E Atlas).
