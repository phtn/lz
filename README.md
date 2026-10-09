# DropZone on Beast

DropZone organizes files with browser-based OCR, server-side Jev classification, Cloudflare R2
storage, and an owner-scoped Convex index. The interface works on phones,
tablets, and desktops with consistent light and dark themes.

## Run locally

```bash
bun install
bun run dev
```

Copy `.env.example` to `.env` and supply the Firebase web configuration,
`CONVEX_URL`, a `FILE_URL_SIGNING_KEY` of at least 32 random characters, and
`TYPESAFE_API_KEY` for Jev. Wrangler reads `.env` and `.env.local` locally.
For a deployed Worker, configure `CONVEX_URL`, `FILE_URL_SIGNING_KEY`, and
`TYPESAFE_API_KEY` as Worker secrets; deploying does not upload local `.env`
values. Use the **production** Convex deployment URL for the deployed Worker,
not the personal development URL from `.env.local`. Set the secrets on the
top-level Worker with:

```bash
bunx wrangler secret put CONVEX_URL --env ''
bunx wrangler secret put FILE_URL_SIGNING_KEY --env ''
bunx wrangler secret put TYPESAFE_API_KEY --env ''
```

The signing key must contain at least 32 random characters. These server-only
variables must never use the `PUBLIC_` prefix. Verify the secret names with
`bunx wrangler secret list --env ''`. A missing `CONVEX_URL` makes the library
request fail immediately after sign-in; a missing signing key prevents file
previews and uploads from working.
Enable Google authentication and the appropriate local origin in Firebase.
Configure the R2 binding in `wrangler.jsonc`. Use `bun run dev:cf` to exercise
the Cloudflare runtime with the configured development R2 bucket. Ordinary
Rsbuild development renders the UI but has no R2 runtime bindings.

## Upload and analysis behavior

- Two files can move through the pipeline at once. A shared OCR worker handles
  recognition serially to control memory use on phones and is released after
  45 seconds idle.
- Progress covers local analysis (0–40%), measured upstream transmission
  (40–95%), and server-side Jev classification/filing (95–100%). Transfer byte counts include
  multipart metadata and the optional thumbnail. A file is marked ready only
  after its original and metadata have been saved. Completed activity stays
  visible until dismissed; retries reuse the same upload ID.
- Files must contain data and be no larger than 20 MB. Invalid files show an
  actionable queue error before OCR or upload starts.
- Image OCR applies bounded resizing, grayscale contrast enhancement, and
  automatic rotation. Choose English or English combined with Spanish,
  French, German, Chinese, or Japanese. Language models download on demand.
- PDF analysis reads up to 12 pages, performing OCR for every scanned page
  within that range, including mixed text/scanned PDFs. Longer documents show
  a partial-analysis notice; their complete original is still stored.
- DOCX, PPTX, and XLSX XML text is extracted locally with bounded decompression.
  Plain text is read up to 256 KB, and stored extracted text is capped at
  60,000 characters. Unsupported, encrypted, or unreadable files fall back to
  filename/type classification and show a review notice.
- There are 28 folders, including invoices, banking, taxes, employment,
  property, research, design, emails, audio, and video. The viewer allows
  persistent folder corrections and copying recognized text. Existing files
  retain their classifications; older files with no extracted text remain
  searchable by their visible filename and summary.

OCR computation stays on the device. Originals, thumbnails, extracted text,
and classification metadata sync to the authenticated cloud library. Extracted
text (up to 24,000 characters per file), filename, and MIME type are sent by the
authenticated Worker to TypeSafe for Jev classification. No image pixels or
original file bytes are sent to Jev. Existing files are not reprocessed.

## Previews and performance

Image previews support zoom buttons, mouse wheel, keyboard +/−/0, touch pinch,
dragging, double-click zoom, rotation, and fit. The viewer includes navigation,
PDF page controls, native audio/video players, downloads, and an extracted-text
view. Native dialogs provide focus containment, Escape dismissal, and focus
restoration. Mobile previews include file insights below the image.

New image uploads generate WebP thumbnails up to 480 pixels, which the grid
loads lazily. Older images fall back to their originals. File metadata is kept
separate from OCR content, so the main library does not read or send the full
recognized text. OCR, PDF rendering, Office extraction, and the detail viewer
are loaded on demand. The grid renders 48 files initially, with a show-more
control. Signed preview links refresh when browsing after ten minutes.

The initial library shows the 200 most recent files. Search includes the
current library's filename/summary matches and up to 20 owner-scoped full-text
matches. Full-text indexing is automatic for new uploads and corrected files.

## Verification

```bash
bun run check
bunx playwright install chromium
bun run test:ui
```

`check` compiles authored BTSX into ignored `.octane/beast` output, type-checks the
result plus client/server and Convex TypeScript, runs the unit/backend tests,
and builds the production Worker. TypeScript is pinned to the version
supported by the TSRX checker.

Octane 0.8 Strong mode owns callback caching and dependency inference. Author
plain callbacks and render calculations, use `useLinkedState` for values that
reset with an account or file, and keep asynchronous effects cancellable.
Context providers render as the context component. SVG markup uses Octane's
`trustHTML()` API. The checker selects `octane/compiler/volar` explicitly, and
generated TSRX stays under `.octane` so server RPC discovery excludes it.

PDF previews and OCR use the worker from the installed `pdfjs-dist` package.
Rsbuild serves it directly during development and copies it during production
builds, preventing mismatches after dependency upgrades.

Browser tests intercept authentication and file endpoints; they do not upload
fixtures into real accounts. They cover 320–1440px layouts, both themes,
previews, clipboard copying, folder corrections, upload failure/retry and
completion, account cleanup, real image OCR, and a mixed text/scanned PDF.
The test server uses its own local Wrangler configuration. OCR smoke tests
require network access to fetch the Tesseract worker/model assets.

## HTTP contracts

- `GET /` — streamed Octane SSR followed by hydration
- `GET /api/files` — recent compact metadata for the signed-in user
- `GET /api/files?search=…` — scoped full-text search results
- `POST /api/files` — original plus classification and optional thumbnail
- `GET /api/files/:id?metadata=1` — authenticated details and fresh preview links
- `GET /api/files/:id?key=…&expires=…&signature=…` — signed original/thumbnail
- `PATCH /api/files/:id` — authenticated folder correction
- `DELETE /api/files/:id` — remove the original, thumbnail, and OCR/index data

The Worker stores originals under `drop/{userId}/{uploadId}` and thumbnails
under `drop/{userId}/thumbnails/{uploadId}`. Convex stores compact file metadata
in `files` and OCR/search content in `fileContents`. Optional legacy fields
preserve compatibility with existing records. Backend changes must be
available on the target Convex deployment before releasing the new Worker.
