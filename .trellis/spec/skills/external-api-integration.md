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
