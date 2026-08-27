# DropZone on Beast

DropZone is a privacy-first file organizer built with Beast, Octane, and
Rsbuild. Documents are classified in the browser with PDF.js and Tesseract.js,
stored in Cloudflare R2, and indexed per user in Convex.

## Run locally

```bash
bun install
bun run dev
```

Copy `.env.example` to `.env` and replace its placeholders with your Firebase
web configuration and private Cloudflare R2 S3 credentials. In the Firebase
console, enable Google under Authentication > Sign-in method. Run
`npx convex dev` once to select a Convex deployment and generate `.env.local`.

The development server opens on the URL printed by Rsbuild. For a production
check:

```bash
bun run check
bun run preview
```

## Application contracts

- `GET /` — streamed Octane SSR followed by hydration
- `GET /api/files` — list up to 200 files for the signed-in user
- `POST /api/files` — upload a file up to 20 MB with classification metadata
- `GET /api/files/:id` — redirect to a short-lived R2 download URL
- `DELETE /api/files/:id` — remove a stored file

The client performs OCR and PDF text extraction locally before upload. The
server writes original bytes to `drop/{userId}/{uploadId}` in R2. Convex stores
the authenticated user record and searchable file metadata; R2 credentials
remain server-only.

## Source layout

- `src/**/*.btsx` — authored Beast components
- `src/server` — authenticated Convex/R2 HTTP integration
- `convex` — user and file schemas, indexes, and authorization-aware functions
- `src/utils/helpers.ts` — browser-only classification and extraction helpers
- `octane.config.ts` — render and server route ownership
- `rsbuild.config.ts` — Beast → TSRX → Octane build integration
