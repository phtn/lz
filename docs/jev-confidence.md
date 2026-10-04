# Jev classification and confidence policy

The upload pipeline is local OCR/text extraction → measured upload → authenticated
Worker Jev evaluation → original/thumbnail storage → Convex metadata and text index
→ ready confirmation. Jev runs before storage writes, after the Worker receives
extracted text. The queue displays its classification/filing stage while waiting;
95% is a stage boundary, not invented network progress.

The API key remains in `platform.env.TYPESAFE_API_KEY`. Local Wrangler reads the
existing `.env`; deployed Workers need a secret configured separately. The fixed
provider endpoint is https://api.typesafe.ai/v1/systemone. Credentials and document
contents are never logged or embedded in client assets. Readable extracted text,
filename and MIME are sent to TypeSafe; originals and thumbnails remain in R2.

## Improve the evidence, not the displayed number

- Keep paragraph/page boundaries, remove control characters, and preserve the
  actual recognized text. Do not rewrite OCR into imagined facts.
- Use all 28 category options with distinct descriptions and an Unknown escape.
  Purpose takes priority over format. Distinguish amounts due (invoice), payments
  completed (receipt), account transactions (banking), and tax authority records.
- Do not tell the model the local classifier's answer. Filename/MIME provide weak
  context; explicit content must justify the decision. Document instructions are
  untrusted data, including requests to change categories or confidence.
- Ask two focused questions in one request: a Choice for the folder and a Noul
  for readable, explicit evidence of one primary purpose. This second answer is
  an evidence probability, not an independent correctness confidence.
- Preserve returned model/version, raw confidence, all category probabilities,
  the top-two margin, evidence probability, and policy version. Display model
  confidence separately from OCR confidence and category probability.

Policy `document-routing-v1` automatically changes the fallback folder only when
all these initial gates pass:

| Signal | Required value |
| --- | --- |
| Model confidence | ≥ 0.85 |
| Selected category probability | ≥ 0.90 |
| Top-two probability margin | ≥ 0.20 |
| Clear evidence probability | ≥ 0.85 |
| OCR confidence, when available | ≥ 75/100 |
| Extracted content | ≥ 80 non-whitespace characters |
| Coverage | Complete analyzed pages, no extraction warning, no 24k truncation |
| Selected category | Known category, not Unknown |

These are conservative initial engineering gates, not calibrated accuracy claims.
Jev confidence is distribution concentration; it is not a measured probability
that the classification is correct. Multiple related signals are intentionally
not averaged into an inflated combined score. Low confidence, poor OCR, or
partial coverage keeps the fallback folder and recommends review. No text skips
Jev. Missing credentials, timeouts, malformed responses, and upstream failures
save the file with an explicit unavailable/review state. Transient 429/529/502/503
responses retry once with bounded backoff; the total call budget is 25 seconds.

## Calibration and continued improvement

Folder corrections and confirmation mark the assessment `corrected`, save a review
timestamp, and retain the original suggestion/distribution/model/policy for
comparison. The owner can confirm the fallback folder without changing it.

Before loosening gates, collect a consented, independently labeled corpus spanning
every category, language, clean/scanned inputs, invoice-versus-receipt edge cases,
partial PDFs, mixed documents and adversarial instructions. Split by document
source/customer, not page, to avoid train/evaluation leakage. Reviewer actions
are useful labels, but an unreviewed automatic assignment is never ground truth.

For each model/policy version, measure accepted-decision precision, coverage,
review rate, per-category confusion, language/OCR-band performance and confidence
reliability bins. Select thresholds for the business's acceptable error rate on a
held-out set; use a separate final test set and report uncertainty when samples
are small. Change category rubrics to reduce observed overlaps, then re-evaluate.
Do not increase confidence by removing plausible alternatives or repeatedly
calling until a high score appears. Re-OCR low-quality pages with the appropriate
language or request a clearer source before trying classification again.

Current verification includes synthetic routing, review gates, malformed provider
responses, outage behavior, retry/cancellation, persisted corrections and mobile
UI checks. Synthetic checks establish wiring; they do not establish production
accuracy or language calibration.

Sources: [API](https://docs.typesafe.ai/api),
[Choice](https://docs.typesafe.ai/primitives/choice),
[Confidence](https://docs.typesafe.ai/confidence).
