# CAE 材料資料庫 (CAE Material Library)

A compact, spreadsheet-style CAE material data ledger for internal engineering use.
Find a material → inspect its properties → verify the source → use the data in CAE.

Stack: React + TypeScript + Vite. No backend; data is kept in the browser's `localStorage`
(`cae-material-library:v1`) and seeded with 11 sample materials on first load.
UI language: Traditional Chinese. Property / column names (Material Name, Density, Young's Modulus, …) stay English.

## Run

```bash
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
- The "Lenovo" mark in the header is a text placeholder; replace it with the official asset.
- Clearing site data removes the library; export CSV regularly.
