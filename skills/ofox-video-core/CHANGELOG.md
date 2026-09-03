# Changelog

All notable changes to the **ofox-video-core** skill. Versioning follows SemVer.

This file starts at 1.2.0; earlier versions predate it.

## 1.13.0 — a second finding on hard cuts, and a second round for a published deliverable

Docs only; no script changes. Both additions trace back to one accepted-but-
flagged clip: the first 720p `seedance-short-drama` job made on the 1.12.0
references (2026-09-03, job `4e5c9581-d462-443b-9663-b1aa6d72f527`, 30s, ten
shots, $7.20) obeyed every rule these two shared files already stated and
still drew four specific complaints from the repository owner — a plain
back half, a compressed climax, seconds wasted on transitions, and a request
for more say in the brief before the job runs.

- **New "Two 30-second jobs past that envelope: the mix, not the label,
  decided" under "Several shots in one job."** The existing envelope
  (three shots in eight seconds) said nothing about longer timelines with a
  mix of hard cuts and named continuous transitions. Two 30-second jobs fill
  that gap and contradict each other on the one claim either alone would
  support: job `844c9145-9b10-4335-9fdc-ec4937793a2f` (8 boundaries, 3 hard
  cuts against 5 continuous) had every explicit label render as written; job
  `4e5c9581-d462-443b-9663-b1aa6d72f527` (9 boundaries, 3 hard cuts against
  6 continuous) had **zero** of its written hard cuts detected at threshold
  0.3 — the whole clip read as one continuous flow. Stated as a working
  hypothesis from two samples, not a threshold: a boundary's rendering isn't
  decided independently of the rest of the timeline, so a timeline weighted
  toward continuous transitions can soften an explicitly labeled hard cut
  too.
- **`creative-brief.md` now allows a second round of up to four questions
  when the deliverable is published** (a page asset, a client deliverable,
  anything the user describes that way) rather than previewed once and set
  aside. The second round is reserved for a new class of axis —
  **"Pacing questions belong in round two"**: duration split, ending
  length, slow motion/freeze frame use, density of the standout segment, and
  hard-cut share — all five of which every scenario skill previously left
  entirely to the agent's own judgement, by default, with no question and no
  approval step in between. The flow diagram and anti-pattern 1 were updated
  to match; a follow-up (branch-triggered) and a round two (published-tier)
  are now two different, both-legitimate reasons to ask again.

`seedance-short-drama` 1.9.0 is the first scenario skill to wire the new
round-two axes into its own question table (`Pacing`, `Effects`) and to add
its own "Duration budget" section with concrete second counts. The other
three scenario skills were audited for the same duration-imbalance risk in
the same pass: `seedance-product-video` needed a related fix (its own
1.8.0 entry — a template whose segments didn't scale with `--duration`);
`seedance-ad-creative` and `seedance-anime-drama` did not change, because
their existing templates already bound their equivalent risk (a one-second
cap on the ad climax's slow motion already in the template text; an
escalation-driven segment structure for anime that does not front-load a
static setup or close).

## 1.12.0 — `prompt-structure.md`: shot density measured per case, and the transition choice made visible

Docs only; no script changes. Both additions come from a real failure: the
first short-drama clip generated with the 1.11.0 references (2026-09-03, job
`38ca8311-5b2d-47d5-a45d-e8ebea0e6312`, 20s at 480p, four static shots, cuts
landing where the timestamps said) obeyed every rule in this file and was
rejected as too plain to publish. Two of those rules were discoverable only
by an author who already knew to look for them.

- **New "Shot density, measured per case" under "Segmenting the timeline".**
  The existing "Segment length" gave ranges; this gives the per-case counts
  they were read off, which is what a draft can be compared against: case 11
  at 10 shots in 24s (2.4s each), case 34 at 13 cuts in 30s, case 1 at 9 in
  30s, case 18 at 8 in 30s, case 14 at 9 `CUT`s, case 22 at 6 in 30s, case 15
  at 5 in 20s — and the one-takes counted the same way, cases 8, 6, 2 and 3
  with zero cuts but a movement phase every 6–8 seconds. Two findings stated
  outright: among prompts that cut, nothing collected holds a cut shot longer
  than about five seconds; and **a timeline of 5-second shots with a static
  camera in each is the one shape the gallery does not contain** — which is
  precisely what a scenario template's defaults produce when nobody chooses a
  register. The narrow Ofox-verified envelope (three shots in eight seconds)
  is restated next to it so a denser count is priced as an experiment.
- **The transition choice is now on the skeleton.** "Skeleton to copy" gained
  a `TRANSITION` line between beats, pointing at "Transitions" and saying
  that an unnamed boundary renders as a hard cut. The nine kinds were already
  documented in full; what was missing was any prompt to use them at the
  moment a timeline is being written.
- **Checklist items 3 and 4 tightened**: item 3 now asks for a shot count
  that matches the register rather than a template's floor, and item 4 asks
  for a transition kind named at each boundary on purpose, not only for the
  timestamp's meaning to be declared.

## 1.11.0 — two shared references for every Seedance scenario skill: prompt structure and the creative brief

- **New `references/prompt-structure.md`**: how to structure the text that
  goes into `--prompt`, distilled from the 63-prompt Seedance 2.5 gallery (24
  ByteDance first-party, 39 community). The vendor's own formula and worked
  example; the header-manifest -> timeline -> closing-block skeleton; when to
  timestamp (56% of prompts do; 78% of 16–30s ones), which formats are in use
  and how long a segment runs; the two things a timestamp can mean; transition,
  camera, pacing and ending vocabularies; consistency locks and negative lists;
  dialogue density in two tiers; and the two meanings of an attached image —
  first-frame lock (`--frame-first-image`) versus identity reference
  (`input_references` through `--extra-json`) — with the API constraints that
  decide between them. Every entry carries the case numbers it was observed
  in, and the file says up front that frequency is not effect.
- **New `references/creative-brief.md`**: the other half of the same job —
  what to ask the user *before* a prompt exists. The three tiers (must-ask /
  ask-if-open / never-ask) and why a never-ask axis belongs in the cost table
  rather than in a question; one `AskUserQuestion` round of at most four
  questions with at most one branch follow-up; zero questions as a legitimate
  and common outcome; the shape of a question (12-character header, a
  recommendation first, visibly different pictures, no hand-rolled "Other");
  the three rules for "Let the AI decide" (always last, never pre-selected,
  resolves to a concrete value marked `(AI's pick)`, and a blanket "you
  decide" never covers must-ask); the generic skip rows (platform words to
  ratios, an attached asset, a repeat request in one session); the rule that
  every answer must be findable in the prompt or a flag; the order with the
  approval gate and the recap format; the fallback for a runtime with no
  `AskUserQuestion`; and ten anti-patterns. Scenario vocabulary is
  deliberately absent — each scenario skill supplies its own question set,
  inference rows and recap example.
- **What callers do**: nothing changes in the script or its flags. Scenario
  skills load `references/prompt-structure.md` before writing a prompt and
  `references/creative-brief.md` before asking anything, and link both
  instead of restating them, the same way they link `approval-gate.md`. The
  1.7.0 releases of `seedance-short-drama`, `seedance-anime-drama`,
  `seedance-ad-creative` and `seedance-product-video` do so and keep only
  their scenario-specific template and question set.
- **"Several shots in one job" carries a real-run record, not a
  placeholder.** Prompt text cannot show whether a video honoured its cuts,
  so the section was drafted with a `VERIFY-MULTICUT` marker and then filled
  from two paid `bytedance/seedance-2.5` runs on `byteplus` (2026-09-03, 8s,
  480p, three shots each). Both cut where the timestamps said, to about ±1s,
  in bare-timestamp and in manifest + `SHOT N` notation, and one character
  survived three shots on text alone. The subsection also lists what those
  runs did not cover — 30s or 8+ shots, dialogue across a cut, resolutions
  other than 480p, `volcengine` — so scenario skills can say "verified" only
  where it is.
- **`SKILL.md`'s `chain` section no longer opens on the claim this release
  disproves.** It began "One job is one continuous take, so a sequence means
  several jobs", which contradicted the new reference and the four scenario
  skills. It now says a job is one 4-30s clip that can hold several
  timestamped hard cuts, and frames `chain` as continuity *across* jobs — for
  a sequence past the duration ceiling, or when each shot needs its own
  approval, seed or resolution — with the two mechanisms combinable rather
  than alternatives. The commands and verified-behaviour notes below it are
  unchanged. Also corrected in the real-person subsection: what
  `seedance-anime-drama` reuses across shots is a generated frame of the
  character, not a character sheet — that skill's 1.7.0 forbids feeding a
  design sheet to `--frame-first-image`.
- `SKILL.md` links both files from "For scenario skills built on this", one
  subsection each, and names the division of labour between the three shared
  references. No behaviour change and no test changes; the one edit inside
  `ofox-video.sh` is `cmd_chain`'s header comment, which opened on the same
  retired claim — left alone, it is where the next maintainer would read it
  back out and re-propagate it.

## 1.10.0 — one approval gate, shared by every skill in this repo

- **New `references/approval-gate.md`**: the single spec for "never spend
  before an approved cost table". Required columns, where the numbers must
  come from (`--dry-run`, never the agent's own arithmetic), how to itemise a
  batch, what to do when no estimate is possible, and how a two-phase image →
  video flow splits into two approvals.
- The four `seedance-*` skills each carried their own prose version of the
  same rule, which is a guarantee of drift. They now link this file and keep
  only what is scenario-specific.
- `SKILL.md` links it from "Quote the price before you spend it" and from the
  guidance for scenario skills built on this one. The script's mechanics are
  unchanged — no behavior change here, only where the rules are written down.

## 1.9.0 — surface the keyless price check; stop leading with a misleading rate

A third role-play review, this time as a non-programmer with no Ofox account,
no API key, and an explicit fear of an accidental bill — starting at the
README rather than at SKILL.md.

Its main finding was not a bug: **the strongest thing this repo can offer that
reader already worked, and nothing told them it existed.** `--dry-run`,
`models` and `providers` all run with no API key, so a job can be priced
before signing up. The docs never said so; the *Availability check* section
implied the opposite order (check first, then go get a key), which sends
someone to a signup form before they know whether this costs $0.44 or $7.20.
The one accurate statement lived in a source comment nobody reads.

- `SKILL.md` leads with the keyless price check and says to quote first,
  point at signup second.
- `check` now separates *present* from *valid*: it makes no network call, so a
  typo'd key passes it and fails on the first real request. It says that. And
  when no key is set, it names the three commands that still work rather than
  dead-ending.
- **`models` shows each model's default-resolution rate**, labelled with that
  resolution. It printed `pricing.output_video_per_second` — for
  `seedance-2.5` that is the 480p rate ($0.11) while the model defaults to
  720p ($0.24). The reviewer's persona multiplied the first big number by 15
  and was off by 118%. `pricing.md` already warned never to quote that field,
  so the repo knew it misled and showed it anyway.

Tests: `references/test/newuser.test.sh`, 22 cases, all free.

## 1.8.0 — `create`, and fixes for three defects 1.7.0 introduced

A second role-play review — a sub-agent given only the SKILL.md files and told
nothing about the previous round — confirmed 1.7.0's fixes landed (it read the
dry-run flow out of the docs unprompted) and found twelve more issues. Three
were introduced by 1.7.0 itself.

**The timeout trap (the worst one).** `generate` blocks for up to
`--max-wait` seconds, default 540. Claude Code's Bash tool defaults to 120 and
caps at 600. A tool call dying mid-poll lands in the one state that actually
costs someone something: job created and billable, id never printed, no way to
recover it. `batch --takes 4` is worse — 36 minutes worst case, more than any
single tool call can be given — and 1.7.0 had just finished recommending
`batch` in all four scenario skills.

- **New `create` subcommand**: submits and returns the job id in seconds, no
  polling. `poll` already existed, so `create` → `poll` → `poll` is now a
  path that no short timeout can strand. `generate` is unchanged for callers
  that can wait.
- Documents the real duration expectations, the `takes x max-wait` arithmetic
  for `batch`, and lowering `--max-wait` for short drafts.

**Introduced by 1.7.0, now fixed:**

- `batch --dry-run` printed **two** `Estimated cost:` lines — the second was
  the inner validation call leaking its own per-take figure, which is exactly
  the number two documents tell you not to quote, right after promising
  "exactly one line". Inner stderr is now captured and only surfaced on error.
- Dry runs said "Actual billing is reported below" with nothing below.
- `--dry-run` required `OFOX_API_KEY` despite sending no authenticated
  request, so someone without a key could not even be quoted a price —
  against this repo's own fail-open rule.

**Pre-existing, also fixed:**

- `check` exited **1** on a missing key while the exit-code table defines 1 as
  "fix the flag and retry freely" and 2 as an environment error. Now exits 2.
- `--dry-run` did not validate `--out-dir`, so a bad path passed the free
  check and then cost a real job before failing with exit 6. Now resolved and
  checked during the dry run.
- **`batch` now assigns and prints a seed per take.** Takes differed only by a
  seed the API picked and never disclosed, which made "render take 3 properly"
  impossible — the workflow both SKILL.md files recommend. The `TAKE` line
  carries `seed=N`, and the summary shows the command to re-render one.

Tests: `references/test/create.test.sh`, 16 cases, free by construction.

## 1.7.0 — `--dry-run`, so a price can be quoted before it is spent

A sub-agent given only the SKILL.md files, asked to role-play delivering a
video, found that the documentation asked for something the script could not
do. The scenario skills said to relay the estimate the script prints — but
that estimate is printed five lines before `curl -X POST`, so by the time an
agent could relay it, the job existed and was billable. There was no
`--dry-run` anywhere in the script. Following the docs literally meant billing
someone without warning.

- **`--dry-run` on `generate`, `batch` and `chain`.** Parses arguments,
  validates every parameter against the model, resolves the upstream, builds
  the payload, prints the estimate — then stops. Nothing submitted, nothing
  billed, exit 0. A bad parameter now costs a message instead of a job.
- **An `Estimated cost:` line always prints.** It used to be wrapped in
  `if [ -n "$duration" ]`, so omitting `--duration` produced complete silence.
  Silence is the one outcome an agent cannot relay: it can repeat a number and
  it can repeat "unavailable", but it cannot notice a line it was never told
  to expect. Missing duration now says so explicitly.
- **Human-facing lines round to 2 decimals.** The batch summary read
  "That is $0.6400000000 for 4 takes" — a line written for a person, carrying
  ten decimals. `VIDEO_COST` and `BATCH_COST_TOTAL` keep the exact API string,
  because those are the machine contract and the billing record.
- **`BATCH_COST_PER_TAKE` guidance rewritten.** It called that field "the
  number that matters" and then said the number that matters is the total —
  two different fields in one sentence. `BATCH_COST_TOTAL` is what to quote:
  if one take in four is usable, that clip cost the whole total, and the
  per-take figure understates it 4x.

Tests: `references/test/dryrun.test.sh`, 19 cases, free by construction —
`--dry-run` makes no network call at all.

## 1.6.1 — fix: video-to-video was quoted at the text-to-video rate

The estimate added in 1.5.0 detected v2v by looking for `type == "video"` in
`input_references`. The API's actual value is **`video_url`**, so a v2v job was
priced at the t2v tier and the user was quoted low — a real run estimated
$0.44 and billed $0.56, 27% more. 1.5.0 existed to stop wrong estimates; this
was that exact failure inside the feature meant to prevent it. Both spellings
are accepted now.

The same run corrected a claim of ours that had never been measured:
`api-params.md` said `usage.video_seconds` "includes v2v input duration when
applicable". **It does not** — a 4s input with a 4s output billed 4 seconds,
not 8. The extra cost of v2v comes from the rate, not from counting the input.

Also documents, now that a real request has confirmed them: the
`input_references` element shapes (`image_url` / `audio_url` / `video_url`),
that a video reference must be a **URL** with no local-file path (unlike
`frame_images`), and that a completed job's `unsigned_urls` link works as one.

And states what the run did **not** settle: the output opened on nearly the
input's closing frame, but a motionless cup cannot distinguish "continues from
the last frame" from "restages a similar scene from a style reference". No
claim is made either way. For multi-shot continuity `chain` is better on every
measured axis — cheaper, takes local files, anchors on a real frame.

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
