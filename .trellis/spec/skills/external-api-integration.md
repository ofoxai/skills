# External API Integration (Billable APIs Especially)

Learned while building `skills/ofox-video-core` (task `08-29-seedance2-5-skills`),
verified with real, paid API calls — not just by reading documentation.

## Pattern: never resubmit a billable job on timeout — only retry reads

**Problem**: A skill submits a job to a paid external API (video/image
generation, any async "create then poll" API), the poll loop times out or a
network call fails, and the tempting fix is "just call create again." If the
first create call got *any* HTTP response, the job may already exist and be
billed — resubmitting creates a second, separately billed job for the same
user request.

**Solution**: Track the distinction between "no response was received at
all" (ambiguous — genuinely don't know if a job was created) and "a response
was received" (the job's fate, billed or rejected, is already decided).
Only the read/poll operation is safe to retry automatically; the create
operation is retried only on the ambiguous-no-response case, and even then
the skill should say so explicitly rather than silently retrying.

```
create call gets a response (any HTTP status) -> job's fate is decided.
  -> poll times out / poll request fails  => retry the POLL, never CREATE again.
create call gets NO response (curl exit nonzero, no HTTP code at all)
  -> ambiguous. Do not guess. Tell the user to check the provider's
     dashboard for whether a job/charge appeared before manually retrying.
```

**Where this is implemented in this repo**:
- `skills/ofox-video-core/references/ofox-video.sh` — `cmd_generate` makes
  exactly one create call; `poll_and_download`'s retry loop only ever issues
  `GET` requests; a timeout (exit `4`) or ambiguous create failure (exit `5`)
  both print "do NOT re-run generate" and point at `poll JOB_ID` instead.
- `skills/cloudflare-drop` demonstrates the same discipline in spirit for a
  non-billable-but-still-consequential operation: it never claims a deploy
  succeeded without independently verifying the result (`URL_UNVERIFIED`
  rather than assuming success), the same "don't guess, verify or say so"
  instinct applied to a different kind of irreversible action.

**Applies to**: any future skill in this repo that wraps a paid or
consequential external API with a create-then-poll (or create-then-webhook)
shape — read this before writing the request/poll loop, don't rediscover it.

## Gotcha: don't trust a third-party API's docs about which response field is always present

**What happened**: Ofox's public video-generation API docs
(`https://ofox.ai/docs/api/videos/retrieve`) describe a completed job's
response as including both `unsigned_urls` (temporary, upstream) and
`mirror_urls` (persistent, CDN-signed) — worded in a way that reads as if
`mirror_urls` is a standard field on every completed job, with the docs
recommending it as the preferred download source.

A real, paid, non-simulated end-to-end test (2026-08-29,
`bytedance/seedance-2.5` text-to-video, job actually completed and billed
$0.44) returned a response with **`unsigned_urls` only — no `mirror_urls`
field at all**. The first version of `ofox-video-core`'s download logic only
read `mirror_urls` and treated its absence as a hard error, so it refused to
download a video that had genuinely finished generating and been paid for.
The video had to be retrieved manually from `unsigned_urls` before its ~24h
expiry, and the script was then fixed to check `mirror_urls` first and fall
back to `unsigned_urls`, only failing if neither field yields a URL.

**Lesson**: when a third-party API's documentation describes multiple
candidate fields for conceptually the same piece of data (here: "the
video's download URL," across two field names with different presence/
persistence guarantees), do not assume the field the docs call "preferred"
or "standard" is unconditionally present. Prefer it when present, but build
an explicit fallback to the other documented field(s), and only treat the
job as unrecoverable if *none* of the documented fields resolve to a usable
value. Verify this with at least one real call before shipping — this class
of gap does not show up from reading docs alone or from mocked/simulated
tests, only from a real response.

**Where this is implemented in this repo**:
`skills/ofox-video-core/references/ofox-video.sh`'s `download_result()`
function and the field notes in `references/api-params.md` and
`.trellis/tasks/08-29-seedance2-5-skills/research/ofox-video-api.md`.

**Scope note**: the specific `mirror_urls`/`unsigned_urls` behavior is an
Ofox API detail dated 2026-08-29 — re-verify against
`https://ofox.ai/docs/api/videos` if Ofox's API changes; the general lesson
(don't hard-require a "preferred" field the docs don't guarantee, verify
with a real call) is the reusable part.

## Gotcha: a documented general parameter can silently require a specific,
## undocumented value for one model

**What happened**: Ofox's video-creation docs describe `aspect_ratio` as a
general parameter accepting a fixed list of values (`16:9`, `9:16`, `1:1`,
`4:3`, `3:4`, `3:2`, `2:3`, `21:9`, `9:21`) with no mention of any
model-specific constraint, and `bytedance/seedance-2.5`'s own model page
confirms it supports image-to-video with no caveat either. In reality,
`bytedance/seedance-2.5` + an attached image (`frame_images` or
`input_references`) **requires `aspect_ratio: "adaptive"`** — a value not
even in the documented list — and rejects every documented value (mix of
`400 invalid_request` and `502 upstream_error` depending on exactly which
other fields were present). Text-to-video on the same model works fine with
any documented aspect ratio; only the image-attached path has this
requirement. Discovered 2026-08-29 through 6 real, paid-or-free-depending-on-
response API attempts (see `.trellis/tasks/archive/2026-08/08-29-product-video/research/seedance-2.5-image-to-video.md`
for the full attempt log and exact job ids) — not something reasoning about
the docs alone would surface, and not something provider-routing
(`provider.type`) had anything to do with (that was a plausible-looking red
herring, ruled out by testing it directly).

**Lesson**: for a model that supports multiple generation modes (t2v / i2v /
v2v), do not assume a documented general parameter's valid-value list or
default applies uniformly across modes for every model. When something
works for text-only but fails for the same model with a reference
image/video attached (or vice versa), suspect a mode-specific requirement
that isn't in the general parameter docs, and check by testing the
narrowest possible variable (same request, only the mode-defining field
changed) — comparing against a *different model in the same family* that
does work (here, `bytedance/seedance-2.0` succeeded with the exact same
`frame_images` shape and no special aspect ratio) is what actually isolated
this to "2.5 + image needs `adaptive`," not the image itself, not the
provider, not the reference URL.

**Also learned in the same investigation**: when a fix like this touches a
shared execution-layer skill (`ofox-video-core`), check every scenario skill
that already ships example commands using the affected parameter — both
`seedance-ad-creative` and `seedance-product-video` had to be corrected
because their existing image-to-video examples showed an explicit
`--aspect-ratio` that a fixed script would now silently override. A
shared-layer fix isn't done until its blast radius on dependent skills'
own documentation is checked, not just the shared code.

**Where this is implemented in this repo**:
`skills/ofox-video-core/references/ofox-video.sh` (the model+mode-conditional
override, with a printed `NOTE:` — never silently override a value the
caller passed), `seedance-ad-creative/SKILL.md`, `seedance-product-video/SKILL.md`.

**Scope note**: specific to `bytedance/seedance-2.5` via Ofox, dated
2026-08-29 — re-verify if Ofox/ByteDance changes this. The general lesson
(mode-specific requirements can hide inside general-looking parameters;
isolate by comparing against a sibling model that works) is the reusable
part.

## Gotcha: a response field describing media output can be wrong — third instance of "verify the real artifact"

**What happened**: `ofox-image-core`'s real end-to-end test (2026-08-29,
`google/gemini-3.1-flash-image`, `size: 512x512` requested) got back a
response claiming `"size": "512x512"` — matching the request exactly. The
actual downloaded PNG, verified with `file`/`sips -g pixelWidth -g
pixelHeight`, is really `1024x1024`; the model appears to always generate
at its native resolution and just echo back whatever `size` was requested.
Unconfirmed for `openai/gpt-image-2` / `bailian/qwen-image-3.0-pro`.

**Lesson**: same pattern as the two entries above — Ofox's video API's
`mirror_urls`/`unsigned_urls` presence claim, and `seedance-2.5`'s
`aspect_ratio` value-list claim. A documented or response-reported field
describing media output is not itself proof of the real artifact's
properties. When a caller needs an actual guarantee (a working URL, an
aspect ratio, or here, pixel dimensions), verify by inspecting the real
downloaded/generated artifact, not by trusting the field. See the two
entries above for the reusable general instinct; this entry just records
the third confirmed instance.

**Where this is implemented in this repo**:
`skills/ofox-image-core/references/api-params.md` and `SKILL.md` (the
gotcha writeup and the guidance to check the real file's dimensions
instead of the response's `size` field); `skills/ofox-image-core/references/pricing.md`'s
verified example documents the same real call.

**Scope note**: confirmed only for `google/gemini-3.1-flash-image` via
Ofox, dated 2026-08-29 — re-verify if Ofox/Google changes this, or once the
other two models are tested for the same behavior.

## Gotcha: inferring a response's *shape* from doc prose (not a real example) can produce a "confirmed" claim that's simply wrong

**What happened**: `ofox-image-core`'s original research documented `400
provider_type_unavailable` as a "confirmed" `error.code` for
`/v1/images/generations`, based on reading Ofox's docs prose describing a
provider/model-mismatch scenario in words — not from an actual response
example. A real rejected call (2026-08-29, an invalid
`extra_body.provider.type`, exactly the scenario that prose was describing)
returned a different shape entirely: `{"error": {"message", "type":
"invalid_request_error", "code": 400}}` — an OpenAI-SDK-style shape where
`code` is literally the HTTP status as a number, not a semantic string, and
`provider_type_unavailable` appears nowhere in the real response. The
*value* being guessed wasn't just wrong — the entire *shape* being reasoned
about (which field carries the semantic meaning) was wrong.

**Lesson**: this is a stronger case than "a documented field might be
absent" (the `mirror_urls` entry above) — here, the vendor's docs never gave
a literal example response at all, and the shape was inferred from prose
describing a scenario, then written up in this repo's own docs as
"confirmed." In this repo, "confirmed" for anything about an API's
request/response contract — including the *shape* of an error object, not
just whether a named field like `mirror_urls` is present or a value list
like `aspect_ratio`'s is complete — must mean "observed in an actual
response," never "described in the vendor's prose, however specific it
sounds." When only prose is available, say so plainly ("documented in
prose, not yet confirmed by a real response") instead of writing it up as
an observed fact.

**Where this is implemented in this repo**:
`skills/ofox-image-core/references/api-params.md` and `SKILL.md` (corrected
error-handling sections), `skills/ofox-image-core/references/ofox-image.sh`'s
`print_api_error` (now keys off `error.type`, the real classifier, instead
of the never-actually-real `error.code` string),
`.trellis/tasks/08-29-image-core/research/ofox-images-api.md`.

**Scope note**: specific to Ofox's `/v1/images/generations` error shape,
dated 2026-08-29 — re-verify if Ofox changes this. The general lesson (a
"confirmed" claim in this repo's own docs must mean observed, not inferred
from prose) applies to every gotcha entry in this file, not just this one.

## Gotcha: passing large data through `jq --arg`/`--argjson` (or any command-line
## value) can silently hit the OS's `ARG_MAX` — unlike the entries above, this
## isn't an API-documentation gap at all

**What happened**: `ofox-video-core`'s local-file support for
`--frame-first-image`/`--frame-last-image` base64-encodes a local image file
into a `data:image/<ext>;base64,...` URI, then passed that entire string as
a `jq --arg`/`--argjson` **command-line** value while building the
`frame_images` request field (and the assembled request body was then
passed to `curl` the same way, via `-d "$payload"`). A real, paid-adjacent
end-to-end test (2026-08-29, `seedance-anime-drama`, a real 885KB PNG
character reference image) failed with `jq: Argument list too long` —
**before any network call was made** — because the PNG's base64 encoding
(1,179,996 bytes) already exceeded this machine's `ARG_MAX`
(`getconf ARG_MAX` = 1,048,576 bytes, the OS-enforced limit on the combined
size of a new process's `argv` + `environ`). Any real photo whose base64
encoding exceeds roughly 1MB (any real photo over ~750KB, ordinarily) broke
the local-file feature entirely — not an edge case, the common case for
real reference photos.

**Lesson**: this is a different class of gotcha from every other entry in
this file. The other entries are about not trusting what a third-party
API's documentation claims about its own request/response contract; this
one is an OS/shell-level limit that applies **regardless of what any API
documents or accepts** — it fires during local request-building, before a
single byte reaches the network. Any time a shell script builds a payload
that could embed a large blob (base64-encoded binary data especially, but
also long free text) and passes that value as a literal command-line
argument to an external command (`jq --arg`/`--argjson`, `curl -d`, or any
other `execve`d command), that value's size is bounded by `ARG_MAX`, and
exceeding it fails ungracefully (`Argument list too long`) with no relation
to the API's own limits. The fix is mechanical and general: never put a
potentially-large value in an exec argument. Write it to a temp file and
read the file's raw content instead — `jq --rawfile`/`--slurpfile` (not
`--arg`/`--argjson`), `curl --data-binary @file` (not `-d "$value"`). A
value merely captured into a shell variable via command substitution
(`x=$(cmd)`) is not itself a problem — bash variables aren't
`ARG_MAX`-bound — the risk is specifically when that variable is later
handed to another program *as one of its arguments*. Clean up the temp
file(s) on every exit path (the existing `tmp_body`-style
create/use/remove-immediately pattern in this repo's scripts already does
this correctly for short-lived files; extend the same pattern rather than
inventing a new one).

**Where this is implemented in this repo**:
`skills/ofox-video-core/references/ofox-video.sh` — the `frame_images`
build (`--rawfile` for each resolved frame reference, `--slurpfile` to
merge the frames array and `--extra-json` into the payload) and the create
call (`curl --data-binary @file` instead of `-d "$payload"`); the module's
`SKILL.md` documents the fix in the local-file section.

**Scope note**: the exact `ARG_MAX` value (1,048,576 bytes) is specific to
this machine (macOS) and can differ by OS/kernel/config — the general
lesson (large values must never be passed as command-line arguments; route
them through a file instead) is the reusable part and applies to any shell
script in this repo, not just Ofox integrations.

## Pattern: prefer a live capability endpoint over a hardcoded validation table

**Discovered**: 2026-08-30, while auditing `ofox-video.sh` against the real API.

`ofox-video.sh` hardcoded one global table of valid resolutions, aspect
ratios, and a single model's duration range. Checked against
`GET /v1/models`, it was wrong three ways at once:

- it accepted `3:2`, `2:3` and `9:21`, which **no** video model supports —
  those passed client-side validation and then cost a round trip to come back
  as a generic `invalid_request`;
- it range-checked `duration` only when the model was literally
  `bytedance/seedance-2.5`, leaving the other seven models unchecked despite
  every one having a different range;
- it accepted `1K`/`2K` (supported by nothing) while rejecting `4k` (which
  `seedance-2.0` does support, lowercase in the API).

`ofox-image.sh` had the same class of bug from the other direction: a
hardcoded list of three models locally rejected the eleven others the API
actually serves.

**The lesson**: a hardcoded table of an external API's valid values is a
copy of a fact you don't own. It is wrong the day the provider adds a model
and can be wrong on the day you write it. When the provider exposes the
values programmatically, read them.

**What made it viable here**: `GET https://api.ofox.ai/v1/models` is public,
needs no API key (verified by calling it with `OFOX_API_KEY` unset — HTTP
200), and is free. Each entry carries a `video_attributes` object with real
`modes`/`resolutions`/`min_duration_seconds`/`max_duration_seconds`/
`aspect_ratios`. Check for this kind of endpoint before hand-maintaining a
table.

**The shape to copy** (both Ofox scripts implement it):

1. fresh cache (24h, `${XDG_CACHE_HOME:-$HOME/.cache}/<vendor>/`) → live
   fetch → stale cache → bundled snapshot → **no check at all**;
2. every fallback below "live" prints a NOTE to stderr — never silent;
3. the last rung is fail-open, per `CONTRIBUTING.md` rule 6: a missing
   capability list must never block a request that would have worked;
4. an unknown id is a local error against a **live** list, but is passed
   through to the API when only a **snapshot** is available — the snapshot
   may simply predate the model, and blocking would be worse than a wasted
   round trip;
5. an env escape hatch (`OFOX_SKIP_MODEL_VALIDATION=1`) for when the client
   is wrong and the user knows better;
6. a `refresh-snapshot.sh` next to the bundled snapshot, so regenerating it
   is one command rather than an archaeology exercise.

**Duplicated on purpose**: the fetch/cache/fallback logic is copied between
`ofox-video-core` and `ofox-image-core` rather than shared. Each skill must
work when installed alone, so a file shared across skill directories is not
an option (`CONTRIBUTING.md` rule 7). Note it in a comment so the next
reader doesn't "fix" it.

## Gotcha: a price field in a capability endpoint may not be a price you can quote

`/v1/models` reports `pricing.output_video_per_second`. It reads like the
number to quote. It is not:

- `bytedance/seedance-2.5` reports `0.11` — its **480p** rate — while its own
  `default_resolution` is `720p`, which really costs $0.24/s. Quoting the
  field would understate a default-resolution job by more than half.
- `bytedance/seedance-2.0-mini` reports `0.04`, which **is** its 720p rate.

So the field isn't consistently the cheapest tier *or* the default tier. It
is fine for ranking models by rough cost; it must never be turned into a
number shown to a user. Per-resolution tables (from each model's own page,
in `references/pricing.md`) are the quotable source. The same caution
applies to any single-number price in a catalog endpoint for a product whose
real price is a matrix.

## Gotcha: don't assume two endpoints of the same API expose symmetric metadata

The Ofox video models carry a rich `video_attributes` object. The obvious
next step — do the same for image models — does not work: image entries have
**no `image_attributes` equivalent**, and their `supported_parameters` list
is LLM-shaped (`temperature`, `top_p`, `max_tokens`, `stop`,
`response_format`) rather than the `size`/`quality`/`background` the images
endpoint actually accepts.

So `ofox-image.sh` validates only the model **id** dynamically and keeps
`--size`/`--quality`/`--output-format`/`--background` hardcoded from the
docs. This asymmetry is checked, not assumed, and is recorded in that
skill's `references/api-params.md` so nobody "fixes" it into a bug later.

**General form**: when a provider gives you good metadata on one endpoint,
verify it exists on the sibling endpoint before designing around it. Parity
is an assumption, not a guarantee.

## Gotcha: a publish CLI may ignore the version in your frontmatter

ClawHub's skill-format docs list `version` as a top-level frontmatter field,
so it's natural to assume the publish CLI reads it. Running
`npx clawhub skill publish <dir> --dry-run --json` shows otherwise: every
skill reported `"version": "1.0.0"` with `"latestVersion": null`, because
the CLI derives the published version from `--version` or the registry's
next patch — not from the file.

Carry the field anyway (the format documents it, and the server may surface
it), but don't claim a version problem is "fixed" because frontmatter now
has one. `--dry-run --json` is cheap and answers what the tool actually
does; its `fileCount` is also the quickest way to confirm a `references/`
file will really ship and that strays (`.DS_Store`) won't.

## Pattern: pin the upstream when a provider routes by weight

**Discovered**: 2026-08-30, adding provider support to `ofox-video.sh`.

An aggregator that serves one model from several upstreams usually routes
between them, and Ofox says so outright:

> "When no `provider` field is sent, ofox distributes the request by weight
> across the channels currently serving that model" — and "which provider
> serves any single request is not predictable."

That is fine until the upstreams differ in a way the user can feel. For
Seedance they differ in **moderation policy** (`volcengine`, ByteDance's
mainland platform, is stricter than `byteplus`, its platform for other
markets). The consequence is a genuinely confusing failure: the same prompt
passes one run and comes back `output_moderation_failed` the next, with
nothing for the user to point at, because they cannot see which upstream ran
it.

**The lesson**: when an aggregated API exposes an upstream selector, find out
whether the upstreams differ behaviorally before deciding to ignore it. If
they do, an unpinned default is a source of irreproducible bugs, not a
convenience.

### What to check before pinning

1. **Which models actually have a choice.** Measured across all eight video
   models: the four `bytedance/seedance-*` have two upstreams, the four
   `alibaba/*` have one. Only multi-upstream models need pinning — with a
   single upstream, weighted routing is already deterministic, so pinning
   changes nothing and only adds a hardcoded fact that can rot when the model
   later gains a second upstream. **Not pinning is the more robust choice
   there, not the lazier one.**
2. **Whether price differs.** Here it does not — verified tier by tier across
   both upstreams (480p/720p/1080p × t2v/v2v identical). Say so in the docs:
   a reader who sees "choose your upstream" will otherwise assume the choice
   is about money and pick wrong for the wrong reason.
3. **What the failure modes are**, and map them in the same change that makes
   them reachable. Adding `--provider` made `invalid_provider_type` and
   `provider_type_unavailable` possible, so both were mapped at once.

### Verify the mapping against the real API — it is free

Both codes were confirmed with real calls that cost nothing, because a
rejected create never makes a job:

| Sent | HTTP | `error.code` | `error.message` |
|---|---|---|---|
| a real slug that doesn't serve the model | 400 | `provider_type_unavailable` | "no available channel for the requested platform" |
| a slug outside the enum | 400 | `invalid_provider_type` | "unknown provider type" |

This is the cheap half of the earlier lesson about not inferring an API's
error shape from doc prose: a create that gets rejected is billable-free, so
deliberately triggering each documented error is a $0 way to confirm a
mapping instead of guessing it. Do this whenever adding a parameter that
introduces new error codes.

**Note the asymmetry that bit us before**: `provider_type_unavailable` was
once *guessed* from doc prose for the **image** endpoint and recorded as an
unverified invention. It is now confirmed for the **video** endpoint. Those
are different confirmations — do not let one launder the other.

### Shape that worked

- Default applied by a **prefix rule**, not a lookup, so the common path costs
  no network call. Legitimate only because the mapping was measured first.
- An explicit flag, an env var for a persistent default, and an `auto` value
  that opts back out — flag beats env var beats default.
- Validation against catalog data **when it is already at hand**, failing open
  when it is not: a check you could not run is never a reason to block a
  request that would have worked.
- The chosen upstream printed on the existing submit line, so a behavior
  change from "random" to "fixed" is visible without adding output noise.
- A `--print-payload` flag. It makes "does this parameter really reach the
  request body" testable without sending anything, and is genuinely useful for
  debugging. Safe here because the API key travels in a header, never the body
  — confirm that before adding one elsewhere.

## Gotcha: an input can be refused for what it depicts, not just how it's formed

**Discovered**: 2026-08-31, first real run of `ofox-video.sh chain`.

Feeding a frame containing a photoreal human into `bytedance/seedance-2.5`
image-to-video returns, at submission time:

```
HTTP 400  error.code: input_moderation_failed
Upstream message: The request failed because the input image 'content[1]'
may contain real person.
```

Nothing is generated and nothing is billed.

Two things made this invisible to reasoning:

1. **It is a content check, not a format check.** Every documented reference-
   image failure mode up to that point was structural — `bad_data_uri`,
   `download_failed`, `unreachable`, `not_image`, `too_large`. A valid,
   readable, correctly-encoded image can still be refused for its *subject*.
2. **The same mechanism already worked elsewhere.** `seedance-anime-drama`
   reuses a character reference across shots via `--frame-first-image` and
   has always worked — because an anime character sheet is not a photoreal
   person. The mechanism was proven; the content class was the variable, and
   nobody had varied it.

**The lesson**: when a feature's proven mechanism meets a new *kind* of input,
that is a new test, not a covered case. "We already do image-to-video" did not
mean "we can do image-to-video with this image".

**Distinguish the two moderation codes** — they behave differently and want
different advice:

| | `input_moderation_failed` | `output_moderation_failed` |
|---|---|---|
| When | at submission | after the job ran |
| Billed | no (nothing generated) | no (`usage` is null) |
| Fix | change the input, or `real_person: true` | change the prompt, or retry on the other upstream |

**Related, and deliberately left unverified**: `real_person: true` exists for
authorized real-person references and routes them through Ofox's
privacy-preserving preprocessing. Ofox documents that path for
`bytedance/seedance-2.0`. Whether it lifts the restriction on **2.5** was not
tested — so the script's error message names it as an option while saying it
is unconfirmed for 2.5. Naming an untested workaround as though it were a
known fix is the same mistake as inventing an error code.

## Pattern: check a hard dependency before the first paid call, not at the point of use

`chain` needs ffmpeg to carry a frame between shots. The naive placement is at
the point of use — after shot 1 has already been generated and paid for, when
there is a video to extract from. Then a missing ffmpeg costs a real shot and
delivers nothing usable.

It checks at argument-validation time instead, before any submission, and
refuses with an install hint plus a suggestion to use `generate` per shot
instead. Generalisation: **for any multi-step paid flow, verify every local
prerequisite for step N before paying for step 1.** The cost of the check is
a `command -v`; the cost of skipping it is someone's money.

The inverse also holds and is worth keeping straight: a dependency that is
merely an *enhancement* (the contact sheet, the concat join) must fail open
and never cost anyone their results. The distinction is whether the flow can
still deliver what was paid for without it.

## The prose-inference mistake, recurring — and what finally caught it

This file already warns against inferring an API's shape from documentation
prose instead of a real call. On 2026-08-31 the same mistake shipped again, in
the change whose entire purpose was estimate accuracy.

The v2v cost check tested `input_references[].type == "video"`. The API's value
is `video_url`. A v2v job was therefore priced at the t2v rate: estimated
$0.44, billed $0.56.

**Why the existing warning didn't prevent it.** The earlier instances were
about *error* shapes — obviously uncertain territory, so they got scrutiny.
This was a *request* field, in a code path the author was writing anyway, and
it felt too small to check. The size of the guess is not what makes it risky;
being a guess is.

**Why the test suite didn't catch it.** Every case in the suites drives the
script through its flags. `input_references` has no flag — it is only reachable
via `--extra-json` — so no test had ever sent one. **An escape-hatch parameter
is exactly where untested assumptions accumulate**, because the flags around it
are covered and the gap is invisible in a green run. When a script offers a
passthrough, write at least one test that goes through it.

**What actually caught it**: a real paid call whose printed estimate did not
match its printed bill. Both numbers being on screen, in the same output, is
what made a 27% gap impossible to miss. That is an argument for printing an
estimate and the real cost in the same place, beyond the user-facing reason.

### Corollary: measure a billing claim before writing it down

The same run disproved a claim this repo had been carrying:
`usage.video_seconds` "includes v2v input duration when applicable". A 4s input
producing a 4s output billed **4** seconds, not 8. The claim came from doc
prose and had never been checked. The v2v premium comes from the per-second
*rate*, not from counting input seconds.

Billing claims are worth the same skepticism as error codes: they are
load-bearing (someone budgets against them), cheap to verify (one small job
prints `usage` in full), and easy to get subtly wrong from prose alone.

## Pattern: an instruction the tool cannot execute is a defect, not a wording problem

Found 2026-08-31 by giving a sub-agent nothing but the SKILL.md files and
asking it to role-play delivering a video to a user.

The scenario skills said: "the script prints its own estimate before it submits
anything — relay what it prints." True line by line, and impossible to follow:
the estimate printed five lines above `curl -X POST`, with no pause and no
dry-run anywhere in the script. By the time an agent could relay that number,
the job existed and was billable.

Worse, this was a **regression introduced while improving the same feature**.
The scenario skills used to tell the agent to compute an estimate by hand from
a price table. Replacing that with "relay what the script prints" fixed a
staleness problem and silently created a timing one, because nobody asked
*when* the script prints it.

**The lesson**: when documentation tells an agent to do something with a
tool's output, check that the output exists at a point where the instruction
can still be acted on. "Relay X before Y" requires X to be available before Y
happens — an obvious-sounding property that is easy to lose when you change
where X comes from.

### Silence is the one output an agent cannot relay

The same review found `print_estimate` wrapped in `if [ -n "$duration" ]`, so
omitting a duration produced no estimate line at all. The docs covered the
"unavailable" case but not the absent one.

An agent can repeat a number. It can repeat "unavailable". It cannot notice
the absence of a line it was never told to expect — and it has no way to
distinguish "the tool said nothing" from "the tool said nothing because
everything is fine". **Any diagnostic an agent is instructed to relay must
print on every path**, including the failure paths, saying why when it has
nothing useful.

### Role-playing the consumer is a cheap way to find this class of bug

None of this was reachable from the test suite, which drives the script
through its flags and asserts on exit codes. These are defects in the
*instructions*, and the only way to exercise instructions is to have something
follow them with nothing else to go on.

Giving a sub-agent the skill files and no other context — explicitly barred
from spending money — surfaced eight issues in one pass, five of them real
defects. Worth repeating whenever the agent-facing documentation changes
materially. Two mechanical checks that came out of it and are worth running
directly:

- `grep -c` the scenario skills for capabilities the core skill added. A
  feature documented only in the core is invisible to an agent that loaded
  just the scenario skill (`batch` was missing from all four).
- `grep -c -- --out-dir` in any skill whose script writes files. Absent, an
  agent copies the example and drops output into the user's project root.

## Gotcha: a long-blocking command collides with the caller's timeout, and the collision costs money

`generate` polls until the job finishes, up to `--max-wait` (default 540s).
Claude Code's Bash tool defaults to a **120-second** timeout and caps at 600.
So the default configuration of the caller cannot outlast the default
configuration of the script.

When the tool call dies mid-poll, the result is the worst state this API has:
the job was created and is billable, and **its id was never printed**, so
there is nothing to `poll` and nothing to tell the user. The docs described
that state accurately and never named the action that avoids it.

**Why it went unnoticed for four tasks**: every real run in this project was
made with a manually raised timeout. The author's own invocations never
exercised the default path, so the trap was invisible from the inside. When
you set a non-default option every single time you use your own tool, that
option is where a bug will hide.

**The fix that generalises**: separate *submit* from *wait*. A `create`
subcommand that returns the job id in seconds means no timeout can strand a
job whose handle was never emitted; `poll` then runs in as many short calls as
needed. Offer the one-shot convenience too, but do not make it the only path.

**Multiply before you recommend**: `batch` runs takes serially, so its worst
case is `takes x max-wait` — four takes at the default is 36 minutes, beyond
any single tool call's ceiling. A feature can be individually fine and
collectively impossible; check the product, not just the unit.

## Pattern: fixing a documentation defect is a code change, and can regress like one

Three defects in this round were introduced by the previous round's fix:

- A `--dry-run` added so a price could be quoted before spending required an
  API key, so someone without a key still could not get a quote.
- Its estimate line kept the wording "Actual billing is reported below" —
  false under dry run, where nothing follows.
- `batch --dry-run` reused `generate --dry-run` for validation and let its
  narration through, printing **two** estimate lines. The second was the
  per-take figure the same commit's docs told readers never to quote, right
  after promising "exactly one line".

All three come from one habit: changing behavior and checking the new path,
without re-reading the surrounding text and adjacent paths as a whole. The
third is the sharpest — a promise and its violation were added in the same
commit, and the suite passed because each was tested separately.

**Practical check**: after adding a mode (dry-run, verbose, offline), grep the
docs for absolute claims about the output ("always prints", "exactly one",
"reported below") and re-verify each one *in the new mode*. Those claims are
where a new mode quietly turns documentation into fiction.

## Pattern: re-run the consumer role-play after fixing what it found

The first role-play review found eight defects. Fixing them introduced three
new ones. A second review — same setup, deliberately told nothing about the
first round — confirmed the original eight were gone (it read the new flow out
of the docs unprompted, which is the evidence the fix landed) and found twelve
more, including the timeout trap that four rounds of direct work had missed.

Two things make the repeat worth it:

1. **It verifies the fix from the consumer's position**, not the author's. "It
   reads the dry-run flow out of the docs without being told" is a stronger
   signal than any assertion about the docs' content.
2. **A fix changes the surface**, so the next review is not a re-run of the
   same test. The second pass found defects that only existed because of the
   first pass's fixes.

Keep the reviewer uninformed about prior findings. Telling it what was fixed
turns an independent check into confirmation of what you already believe.

