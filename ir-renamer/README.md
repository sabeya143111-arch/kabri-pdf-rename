# IR Renamer (React + Tailwind + Vite)

Inspection Request PDFs ko unke andar ke **IR Ref No + Rev + Engineer decision** ke hisaab se rename karta hai.
OCR aur PDF reading poori tarah browser me hoti hai, koi file server pe upload nahi hoti.

## Chalane ke liye
```bash
npm install
npm run dev        # local
npm run build      # production build -> dist/
```

## Vercel pe deploy
1. Folder ko GitHub repo me push karo.
2. Vercel -> Add New Project -> repo chuno. Framework "Vite" apne aap detect hoga
   (`vercel.json` me build command `npm run build`, output `dist`).
3. Deploy dabao. Koi environment variable nahi chahiye.

Note: OCR engine (tesseract.js worker, core aur English data) pehli baar jsDelivr CDN se load hota hai,
isliye user ke browser ko internet chahiye.

## Structure (shadcn style)
- `src/components/ui/file-upload.tsx`: animated drop zone + file list
- `src/components/*`: Header, LiveSheet, ProgressPanel, StatsStrip, SettingsPanel, ReviewRow, Dock
- `src/lib/analyze.ts`: PDF render + OCR + checkbox detection
- `src/lib/naming.ts`: naam banana, duplicate `(2)` handling
- Tailwind v4 tokens aur animations: `src/index.css`

## Naam ka format
Default `{ref}-R{rev}-{status}` (jaise `TVD-...-000049-R0-Approved as noted.pdf`).
App ke "Naam ka format" panel se badal sakte ho (status ke liye A/B/C/D bhi).
