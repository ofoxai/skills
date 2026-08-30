# Fix v2v detection in the cost estimate and record measured v2v billing

## Goal

The cost estimate added in ofox-video-core 1.5.0 detects video-to-video by
looking for `.type == "video"` inside `input_references`. The API's actual
type value is **`video_url`**. So a v2v request is estimated at the t2v rate
and the user is quoted low: a real run estimated $0.44 and billed $0.56, 27%
more. The whole point of 1.5.0 was that a wrong estimate is worse than none —
this defect is exactly that failure, in the feature built to prevent it.

The same run also settled the v2v billing question our own docs got wrong, so
that gets corrected in the same change.

## What I already know

Measured 2026-08-31 with one real paid call ($0.56):

- Request: `bytedance/seedance-2.5`, 4s, 480p, `input_references` carrying one
  `{"type":"video_url","video_url":{"url":"..."}}`.
- Result: `VIDEO_SECONDS 4`, `VIDEO_COST 0.5600000000` — i.e. 4s x $0.14/s,
  the **v2v** tier. The estimate printed `~$0.44` (the t2v tier).
- **Input duration is NOT billed on top.** Input was 4s and output was 4s; had
  the input counted, `video_seconds` would have been 8. `api-params.md`
  currently says `usage.video_seconds` "includes v2v input duration when
  applicable" — that claim does not hold for this case and was never measured.
- The `input_references` element types are `image_url`, `audio_url`,
  `video_url` (per the create-video docs, now confirmed for video by a real
  accepted request).
- A video input must be a **URL**; no base64 data URI form is documented, and
  none was tested. An Ofox-CDN `unsigned_urls` link worked: the upstream
  fetched it with no auth (verified separately with an unauthenticated ranged
  GET returning HTTP 206 `video/mp4`).

## Root cause

`cmd_generate`'s estimate branch was written from an assumption about the
field value rather than from a real request, in the same change that added the
estimate. It has never been exercised, because nothing in the test suite sends
`input_references` — the suites cover the flags, and this path is only
reachable through `--extra-json`.

This is the same failure mode already recorded in
`.trellis/spec/skills/external-api-integration.md` (inferring an API's shape
from prose instead of a real call), committed by the same author who wrote
that entry. Worth noting in the fix, not just fixing.

## Requirements

1. Detect v2v by `type == "video_url"` (and accept a bare `video` as a
   tolerated alias rather than silently ignoring it).
2. A regression test that fails against the current code: an
   `--extra-json` request carrying a `video_url` reference must estimate at
   the v2v rate.
3. Correct `api-params.md`'s `usage.video_seconds` description: input duration
   was measured **not** to be billed on top, with the measurement stated.
4. Document the `input_references` video shape now that it is confirmed by a
   real accepted request, including that it is URL-only and that an Ofox
   `unsigned_urls` link is a working source.
5. Record what the v2v run did and did not settle: the output opened on very
   nearly the input's closing frame, but the scene (a static cup) cannot
   distinguish "continues from the last frame" from "regenerates a similar
   frame from a style reference" — so no claim either way.
6. Note in the docs that for multi-shot continuity, `chain` is the better
   tool: cheaper ($0.11/s vs $0.14/s), takes local files instead of requiring
   a public URL, and anchors on an actual frame rather than a soft reference.

## Acceptance Criteria

- [x] A `video_url` reference estimates at the v2v rate — test failed at $0.44
      before the fix, passes at $0.56 after
- [x] A bare `video` type is tolerated rather than silently mispriced
- [x] A request with only image references still estimates at t2v
- [x] `api-params.md` no longer claims input duration is billed, and states
      the measurement that disproved it
- [x] The v2v reference shape and its URL-only constraint are documented
- [x] Existing suites green; shellcheck clean; zero CJK

## Verification

| Check | Result |
|---|---|
| pricing tests | 17/17 (was 14, +3 for v2v) |
| chain / provider / batch / validation | 18 / 27 / 21 / 36 |
| image validation | 18/18 |
| shellcheck | zero warnings |
| Cost of finding the bug | $0.56, the v2v run |
| Cost of fixing it | $0 |

## Why this was worth a task rather than a one-line edit

The one-character fix was the smallest part. What the run actually produced:

1. A shipped defect in the feature built to prevent that defect.
2. A disproved billing claim this repo had been carrying from doc prose.
3. Confirmation of the `input_references` video shape and its URL-only
   constraint — which is what makes a v2v feature expensive to build (it needs
   somewhere to host the input) and is why that stays out of scope.
4. A gap in how the suites are written: `input_references` has no flag, so no
   test had ever driven the `--extra-json` passthrough. Escape hatches are
   where untested assumptions collect, and a green suite hides it.

Items 2-4 all went into the spec. Item 4 is the one most likely to catch
something else later.

## Definition of Done

- All acceptance criteria checked
- CHANGELOG entry + version bump
- Committed locally, not pushed

## Out of Scope

- Building a v2v flag or scenario skill — this run showed `chain` is the
  better tool for continuity, and v2v's distinct use (style reference from an
  existing video) needs somewhere to host the input first
- Testing whether a base64 data URI works for video input
- Any push or publish
