# TODO

## Task: Allow downloading output reports even when eligible users = 0

Each page/sheet should show "No eligible suppliers found."

- [x] 1. `frontend/src/pages/TdsRate01Page.jsx`
  - Remove empty-row guard in `runExportExcel`.
  - Remove empty-row guard in `runExportCsv`.
  - Remove empty-row guard in `runExportPdf`.
  - Enable Excel/CSV/PDF buttons even when 0 eligible rows (remove disabled conditions).
- [x] 2. `frontend/src/utils/csvExport.js`
  - When rows empty, write header + "No eligible suppliers found." message row.
- [x] 3. `frontend/src/utils/pdfExport.js`
  - When rows empty, render header + "No eligible suppliers found." message row.
- [x] 4. Verify build (vite build succeeded).

## Done
