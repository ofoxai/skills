# Changelog

All notable changes to the **ofox-video-core** skill. Versioning follows SemVer.

This file starts at 1.2.0; earlier versions predate it.

## 1.6.0 — `chain`: multi-shot sequences with real visual continuity

One job is one take, so a sequence meant several jobs that shared nothing and
drifted apart. `chain` feeds each shot's closing frame into the next as its
opening frame.

**Verified with a real paid run, which is the only way this could be settled.**
Shot 2 opened on very nearly the exact frame it was fed — cup position and
scale, window frame, table grain, light direction all carried over — then
followed its own prompt. Real continuity, not just matched framing. Brightness
shifts slightly across a seam.

- `chain --shot "..." --shot "..."`, or `--shots-file` with one prompt per
  line (blank lines and `#` comments skipped). Capped at 10 shots.
- Estimates the sequence up front; reports real per-shot cost and the total.
- **Stops on first failure**, keeping and reporting completed shots.
- Joins finished shots into one file (`--no-concat` to skip), re-encoding only
  when codecs differ. Fails open — no join, never a lost shot.
- Requires ffmpeg and **checks before submitting anything**, so a missing
  dependency can't cost a paid shot.
- New `last-frame VIDEO` subcommand: pull a clip's closing frame. No API call,
  no key, no cost. Grabs just before the end, since the literal last frame is
  often a fade.

### Found by the same run: real-person references are refused

`bytedance/seedance-2.5` image-to-video rejects a reference frame containing a
real person — `HTTP 400 / input_moderation_failed`, "may contain real person".
Nothing generated, nothing billed. So chaining works for products, landscapes,
illustration and anime, and **not** for live-action human sequences on this
model. This is also why `seedance-anime-drama` can reuse a character sheet
while a short-drama sequence cannot.

`input_moderation_failed` is now mapped (it previously fell through as
"unrecognized error code") and names both options: a non-photoreal reference,
or `--real-person true` — which Ofox documents for `bytedance/seedance-2.0`
and which is **untested on 2.5**, so the message says so rather than implying
a fix.

Tests: `references/test/chain.test.sh`, 18 cases, free by construction —
frame extraction is verified against a locally synthesized clip.

## 1.5.0 — cost estimates come from the live catalog, not a hardcoded table

The estimate shown before someone spends money was built from a 15-line `case`
of prices hand-copied off model pages two days earlier. It would have gone
wrong silently on the next repricing — and several of those rates are
promotional right now (Seedance 2.0 at 10% off, 2.0-fast at 30%, 2.5's 1080p a
time-limited $0.48 against a $0.60 list), so "the next repricing" is not
hypothetical. A wrong estimate is worse than no estimate.

- Rates now come from `provider_cards[].pricing.video_pricing.tiers[]` on the
  public, keyless catalog endpoint, via the same cache added in 1.4.0. Fallback
  ladder: fresh cache -> live -> stale cache -> bundled `pricing-snapshot.json`
  -> **no estimate**. That last rung is deliberate: the script never prints a
  number it cannot back up, and never blocks a run over pricing.
- **`generate` now estimates too**, not just `batch`. On stderr, so the
  `KEY VALUE` stdout contract is untouched.
- The resolution used for an estimate defaults to the model's own
  `default_resolution` instead of an assumed 720p.
- Image-to-video is priced at the **t2v** tier; only a video input moves it to
  v2v. (Confirmed earlier by a real i2v run billing 4s x $0.11 at 480p.)
- When a provider is pinned, the estimate reads that provider's own card.
  Prices matched across upstreams when measured, but that was an observation,
  not a contract — now the number follows if it ever stops being true.
- `references/pricing.md` no longer presents itself as the runtime source. It
  keeps the cheap-vs-expensive ladder (the argument for `batch` survives any
  repricing) as a dated snapshot, and points at `providers` for live numbers.
- `refresh-snapshot.sh` now regenerates the pricing snapshot as well.

Tests: `references/test/pricing.test.sh`, 14 cases, free by construction —
estimates print before anything is submitted.

## 1.4.0 — pin Seedance to the byteplus upstream

**Behavior change.** Seedance jobs now go to the `byteplus` upstream by
default. They previously went wherever Ofox's weighted routing sent them,
alternating unpredictably between BytePlus and Volcengine Ark.

Why it matters: Ofox states outright that with no `provider` field, "which
provider serves any single request is not predictable" — and the two upstreams
**moderate differently**. So an unpinned job that came back
`output_moderation_failed` may simply have landed on the stricter one, with
nothing for the user to point at. Pinning makes results reproducible.

- **New `--provider SLUG`.** Was previously reachable only by hand-writing
  `{"provider":{"type":"..."}}` into `--extra-json`, which nothing documented.
  `--provider auto` sends no pin; `OFOX_VIDEO_PROVIDER` sets a persistent
  default; an explicit flag beats the environment variable. `batch` forwards it.
- **Only multi-upstream models are pinned.** Measured across all eight video
  models: the four `bytedance/seedance-*` are served by `byteplus` +
  `volcengine`, the four `alibaba/*` by `aliyun` alone. Single-upstream models
  get no pin — routing is already deterministic there, and hardcoding it would
  only add a fact that can rot if they later gain a second upstream.
- **The default costs no network call** — it is a prefix rule, accurate per the
  measurement above, not a lookup.
- **Pricing is identical across upstreams** (verified tier by tier). This is a
  region and moderation choice, never a cost one; the docs now say so, so
  nobody assumes there is money in it.
- **Validation**: an unknown slug is rejected locally; a real slug that doesn't
  serve the chosen model is rejected too, naming the ones that do — but only
  when catalog data is at hand. An unreachable catalog never blocks a request.
- **Two error codes mapped**: `invalid_provider_type` and
  `provider_type_unavailable`, both pointing at `--provider auto`.
- **`output_moderation_failed` guidance now names the other upstream** as a
  remedy alongside changing the prompt. The rejected job was never billed and a
  retry is a new request, not a resubmission.
- **New `providers [MODEL]` subcommand**: a model's upstreams and their full
  price matrix, from the public keyless catalog endpoint. No API key needed.
- **New `--print-payload`**: dump the request body to stderr before sending.
  The API key is in a header, never the body, so this leaks nothing.
- The submit line now names the upstream:
  `Submitting job to Ofox (model=..., provider=byteplus)`.

Tests: `references/test/provider.test.sh`, 27 cases, free by construction.

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
