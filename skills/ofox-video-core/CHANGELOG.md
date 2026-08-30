# Changelog

All notable changes to the **ofox-video-core** skill. Versioning follows SemVer.

This file starts at 1.2.0; earlier versions predate it.

## 1.3.0 — `batch` takes with real per-take billing, `contact-sheet`

- **New `batch --takes N`**: N takes of one prompt, each its own job, run
  through the same path a single `generate` uses — so the no-resubmit rule
  holds for free and no take can be double-billed. Prints an estimate before
  spending, then a real total and `BATCH_COST_PER_TAKE` built from each job's
  own `usage.video_cost`. Cost-per-*usable*-take is the number that actually
  matters when you generate several and keep one.
- A failed take **stops the run**: takes after it are not submitted, since
  whatever broke one will likely break the rest and each attempt costs money.
  Completed takes are still downloaded and reported (exit 3 for a partial run).
- Warns when `--seed` is fixed across takes — you would be paying N times for
  N identical clips. `--takes` is capped at 10 per run.
- **Contact sheet**: three frames per take tiled one row per take, so a human
  picks a winner from one image. Uses `ffmpeg` only (its `tile`/`vstack`
  filters — no ImageMagick dependency). Fails open: no ffmpeg means no sheet,
  stated plainly, videos untouched. `--no-contact-sheet` to skip.
- **New `contact-sheet VIDEO...` subcommand**: build a sheet from videos
  already on disk. No API call, no key, no cost.
- Reported sheet paths are absolute even when `--out-dir` was relative.

Verified with a real run: 3 takes on `seedance-2.0-mini` at 480p/4s, billed
$0.24 total ($0.08/take) exactly matching the estimate, contact sheet rendered.
That run also exercised the no-resubmit rule for real — polling hit two
`curl 35` failures and the script retried the *poll*, never the create.

## 1.2.0 — per-model validation, `models` subcommand

- **Parameters are validated against the model you actually chose.** The old
  hardcoded tables were wrong three ways, each verified against live
  `GET /v1/models` data:
  - `--aspect-ratio` accepted `3:2`, `2:3` and `9:21`, which `seedance-2.5`
    rejects. Those passed local validation and spent a round trip to come back
    as a generic `invalid_request`.
  - `--duration` was only range-checked when the model was literally
    `bytedance/seedance-2.5`. The other seven video models got no check at all,
    despite every one having a different range (`wan-*` 2-15s, `happyhorse-*`
    3-15s, `seedance-2.0*` 4-15s).
  - `--resolution` accepted `1K`/`2K` (no video model supports either) and
    rejected `4k` (which `seedance-2.0` supports, lowercase in the API).
  Errors now name the model and list that model's own legal values.
- Image-to-video is rejected up front for models whose `modes` lack `i2v`.
- **New `models` subcommand**: lists every video model with its real limits and
  base per-second price. Needs no API key — `GET /v1/models` is public — so it
  is safe to run before signing up, and it costs nothing.
- **Model data is fetched, not hardcoded**: fresh cache (24h, under
  `XDG_CACHE_HOME`) → live fetch → stale cache → bundled
  `references/models-snapshot.json`. Each fallback is announced on stderr,
  never silent. If no list can be had at all, validation falls back to the
  union of every model's values rather than blocking a request that would have
  worked. `OFOX_SKIP_MODEL_VALIDATION=1` skips per-model checks entirely.
- An id missing from a **live** list is rejected locally; missing from a
  **snapshot** it is deferred to the API, since the snapshot may simply predate
  the model.
- New `references/refresh-snapshot.sh` to regenerate the bundled snapshot, and
  `references/test/validation.test.sh` — 36 cases, all free by construction.
- Frontmatter: top-level `version` and `metadata.openclaw.homepage`/
  `envVars`/`primaryEnv`, which is what ClawHub's publish scanner reads.
