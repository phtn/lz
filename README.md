# DropZone on Beast

DropZone is a local-first file organizer ported from React/Next.js to Beast
BTSX, Octane, and Rsbuild. Documents are classified in the browser with PDF.js
and Tesseract.js, then stored by the Node server in `.dropwell-data/`.

## Run locally

```bash
bun install
bun run dev
```

The development server opens on the URL printed by Rsbuild. For a production
check:

```bash
bun run check
bun run preview
```

## Application contracts

- `GET /` — streamed Octane SSR followed by hydration
- `GET /api/files` — list up to 200 stored files
- `POST /api/files` — upload a file up to 20 MB with classification metadata
- `GET /api/files/:id` — download a stored file
- `DELETE /api/files/:id` — remove a stored file

The client performs OCR and PDF text extraction locally before upload. The
server stores only the original file and the resulting classification record.

## Source layout

- `src/**/*.btsx` — authored Beast components
- `src/server` — Node storage and HTTP route handlers
- `src/utils/helpers.ts` — browser-only classification and extraction helpers
- `octane.config.ts` — render and server route ownership
- `rsbuild.config.ts` — Beast → TSRX → Octane build integration
