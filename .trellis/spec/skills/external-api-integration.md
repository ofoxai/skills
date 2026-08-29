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
