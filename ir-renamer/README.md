# IR Renamer (React + Tailwind + Vite)

Renames Inspection Request (IR) PDFs using the **IR reference, revision and the engineer's decision** printed and ticked on page 1.
OCR and PDF reading run entirely in the browser. No file is uploaded to any server.

## Run locally
```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
```

## Deploy on Vercel
1. Push this folder to a GitHub repository.
2. In Vercel choose Add New Project and pick the repository. The Vite framework is detected automatically
   (`vercel.json` sets the build command `npm run build` and the output folder `dist`).
3. Click Deploy. No environment variables are needed.

Note: the OCR engine (tesseract.js worker, core and English data) loads from the jsDelivr CDN the first time,
so the user's browser needs internet access.

## Structure (shadcn style)
- `src/components/ui/file-upload.tsx`: animated drop zone and file list
- `src/components/ui/card.tsx`, `timeline-animation.tsx`, `vertical-cut-reveal.tsx`: shared UI pieces
- `src/components/*`: Header, PillSwitch, LiveSheet, ProgressPanel, SettingsPanel, ReviewRow, Dock
- `src/lib/analyze.ts`: PDF render, OCR and checkbox detection
- `src/lib/naming.ts`: file naming and duplicate `(2)` handling
- Tailwind v4 tokens and animations: `src/index.css`

## File names
Default format `{ref}-R{rev}-{status}`, for example `TVD-...-000049-R0-Approved as noted.pdf`.
Use the switch at the top for letter codes (A to D) or edit the labels in the "File name format" panel.

## Supported forms

The form type is detected automatically (you can change it per row in Review):

- **Inspection Request, project 8775** – 1 Approved, 2 Approved as noted, 3 Revise and resubmit, 4 Not approved.
- **Inspection Request, project 8797** – 1 Approved or approved as noted, 2 Accepted with comments, 3 Rejected / revise and resubmit, 4 Review not required.
- **Sample Material Submittal** – reference is the "Submittal Nr" (revision comes from the `-R1` suffix); status 1–5 is the option enclosed in the blue box.

File-name labels for each form are editable in Settings.

## Safety features (v9)

- **Confidence** on every row (High / Medium / Low / Edited) and an "Order: Riskiest first" option.
- **Keyboard**: `J`/`K` or arrows move, `1`-`5` set the decision, `Enter` verifies and moves on, `Z` undoes.
- **Verified lock**: ZIP stays locked until every row is ticked. "Verify high-confidence rows" only ticks rows with no flags and no warnings.
- **Cross-checks**: same IR ref + revision with a different decision, project code vs form type, submittal vs IR reference, odd revisions, plus the missing-number panel.
- **Change history** per row with "Undo last change" and "Back to auto-detected".
- **Audit log** (`audit_log.csv`, opens in Excel) and `rename_mapping.csv` are added inside the ZIP (switch in Settings) and can be downloaded separately.
- **Multi-page scans**: "N pages · view all" opens every page. Only page 1 is read automatically.
