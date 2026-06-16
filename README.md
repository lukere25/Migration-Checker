# NetApp Migration Checker

Playwright TypeScript comparison tool for validating NetApp production pages against the Vercel migration site.

## Setup

```bash
npm install
npm run install:browsers
```

This downloads **Chromium** and **Chrome** for desktop testing (default). The UI also runs this automatically before each comparison if browsers are missing.

By default, comparisons run on **desktop Chrome** only (`chromium-desktop`). To also test Safari desktop and iPad:

```bash
PLAYWRIGHT_ALL_BROWSERS=true npm run install:browsers:all
PLAYWRIGHT_ALL_BROWSERS=true npm run test:migration
```

## Run from the UI

Start the web app, provide a spreadsheet URL or upload a local Excel file, and launch the comparison from the browser:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Supported spreadsheet sources:

- Google Sheets share links (sheet must be shared as **Anyone with the link can view**)
- Direct links to `.xlsx` files
- Local `.xlsx` or `.xls` file upload from your machine

The spreadsheet should include a column with **URL aliases** (also recognized as Path, URL, Slug, etc.) and an optional Page name column. The tool always uses the **first sheet** and starts from the **first data row**.

Each alias is expanded automatically:

- **Live URL:** `https://www.netapp.com/` + alias
- **Migration URL:** `https://netapp-e25migration.vercel.app/` + alias

### Sample spreadsheet format

Download the template from the UI (**Download sample spreadsheet**) or use `public/sample-spreadsheet.xlsx`.

| Page | URL Alias |
|------|-----------|
| Home | `/` |
| Artificial Intelligence | `/artificial-intelligence/` |
| Data Services - Tiering | `/data-services/tiering/` |

Minimum format (URL alias column only):

| URL Alias |
|-----------|
| `/` |
| `/artificial-intelligence/` |

If the workbook has more than one sheet, the **first tab** is used automatically.

Each run writes reports to `reports/{run-id}/summary.html`, `summary.json`, `summary.csv`, and per-page folders under `reports/{run-id}/pages/`.

### Report summaries

**summary.html** includes dedicated result summary boxes:

- **Metadata validation** — side-by-side **live vs migration** on each page detail report (key fields + **all meta tags** table); migration must have required tags. Differences between live and migration are flagged as warnings.
- **PDF download** — each page report includes `report.pdf` (Download PDF button on the detail page; HTML / PDF links in the summary table).
- **Broken links** — HTTP status checks on internal links on both live and migration sites (default: up to 25 links per page per site; set `LINK_STATUS_CHECK_LIMIT` to change).

Per-page **report.html** includes a compact **Result summary** section for metadata and broken links on that page.

## CLI (optional)

The easiest way to pick a spreadsheet is the **web UI** (`npm start`) — upload a file or paste a URL and choose the sheet there.

For terminal runs, point `EXCEL_PATH` at your `.xlsx` file (absolute path recommended):

```bash
npm run auth:dev
EXCEL_PATH="/full/path/to/my-pages.xlsx" npm run test:migration
```

The tool also checks the project folder and your `Downloads` folder for the filename.

Useful limits:

```bash
MAX_PAGES=1 EXCEL_PATH="/full/path/to/my-pages.xlsx" npm run test:migration
```

### Visual comparison (screenshots)

Each page is captured as a **full-page screenshot** (full scroll height, scrollbars visible). The report shows prod, migration, and a pixel diff. Very long pages may take longer to capture.

### Live site (www.netapp.com) screenshots

Runs are **headless by default** (no visible browser windows). Live pages use installed Google Chrome in headless mode when available.

To show browser windows while debugging:

```bash
PLAYWRIGHT_HEADLESS=false npm start
```

Or uncheck **Run headless** in the UI before starting a run.
