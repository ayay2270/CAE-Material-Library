# CAE Material Library

A compact, spreadsheet-style CAE material data ledger for internal engineering use.
Find a material → inspect its properties → check source / completeness → use the data in CAE.

Stack: React + TypeScript + Vite. No backend; data is kept in the browser's `localStorage`
(key `cae-material-library:v1`) and seeded with 11 sample materials on first load.

## Run

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # type-check + production build into dist/ (static, relative base)
npm run preview
```

## Features

- Dense full-width material table: sorting, search (name / source / notes), category chips,
  row selection, sticky header / Material column / Actions, units in the headers.
- Completeness indicator (filled / 7) and striped `—` cells for missing values (never zero).
- Row click opens a drawer: basic + supplemental properties, idealised material curve,
  source & notes, history. Add / Edit / Delete with validation.
- Compare 2–3 selected materials side by side (no scoring).
- One Material Map: Lightweight vs. Stiffness (ρ–E) with an ⓘ "How to read this chart" panel.
- CSV export (stored units) and CSV import (rows matched by name).
- Units dialog switches the display of density (t/mm³ / kg/m³) and stress (MPa / GPa).

## Notes

- Values are stored in the mm–t–N–s system (density t/mm³, stress MPa, elongation %).
- Seed values were transcribed from the design mockup; empty cells stay empty.
- The "Lenovo" mark in the header is a text placeholder — replace it with the official asset.
- Clearing site data removes the library; use Export CSV for backups.
