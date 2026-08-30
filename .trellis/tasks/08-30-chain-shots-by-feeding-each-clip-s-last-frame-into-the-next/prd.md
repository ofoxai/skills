# Chain shots by feeding each clip's last frame into the next

## Goal

One Seedance job is one continuous take (4-30s). Today every scenario skill
tells the user that a multi-shot sequence means separate `generate` calls
stitched by hand, with nothing carrying visual continuity between them — the
character, lighting and set can all drift between clips. Chain them instead:
generate shot 1, pull its last frame, feed that as shot 2's first frame, and
so on. Every piece this needs already exists and is proven; what's missing is
the orchestration.

**v2v video-extension is explicitly not this task.** That path needs a
capability never tested here and costs more; deferred by the user.

## What I already know

Everything this composes is already working and verified:

- `--frame-first-image` accepts a local file and base64-encodes it into a
  data URI. Local files are *preferred* over remote URLs — a publicly
  reachable URL was rejected by the upstream more than once (bot/hotlink
  protection), while the same image from disk worked.
- The ARG_MAX bug that used to break large local frames is fixed (`jq
  --rawfile` / `--slurpfile`, `curl --data-binary @file`).
- `bytedance/seedance-2.5` image-to-video **requires** `aspect_ratio:
  adaptive`; the script already forces it and prints a NOTE rather than
  overriding silently. A useful consequence for chaining: shot 2+ inherit
  their framing from the fed frame, so the sequence stays dimensionally
  consistent for free.
- **i2v bills at t2v rates** (confirmed by a real run: 4s x $0.11 at 480p).
  Estimates are now catalog-driven, so an N-shot estimate needs no new price
  data.
- ffmpeg frame extraction is already proven in this skill by
  `make_contact_sheet` / the `contact-sheet` subcommand.
- `batch` establishes the house pattern for multi-job runs: estimate first,
  one job at a time through `cmd_generate` (so the no-resubmit rule holds for
  free), stop on first failure, report real per-job cost.
- `seedance-anime-drama` already chains *a character* across shots by reusing
  one reference image. This task chains *continuity* across shots by reusing
  the previous shot's own output.

## The load-bearing assumption

**Whether a fed last frame actually produces visual continuity is unverified.**
The plausible failure modes are real:

- a final frame can carry motion blur, making shot 2 open soft;
- the model may treat the frame as a still to animate *from rest* rather than
  as motion to continue, giving a visible hitch at every seam;
- lighting/colour can still drift even with a matched opening frame.

This is the whole value of the feature, so it has to be settled by a real
paid run, not by reasoning. If continuity turns out poor, the honest outcome
is to say so in the docs (and possibly ship it anyway as "consistent framing,
not seamless motion") rather than to imply a quality it doesn't deliver.

## Decisions (mine)

- **A `chain` subcommand on `ofox-video-core`, not a new scenario skill.**
  Continuity is a mechanism every multi-shot scenario wants (short-drama,
  anime-drama, ad-creative), not a scenario of its own. Putting it in the core
  lets all four skills use it without a fifth skill to install.
- **One `--shot` per prompt**, repeatable, in order. A `--shots-file` (one
  prompt per line) covers longer sequences without an unreadable command line.
- **Don't extract the literal final frame.** Grab slightly before the end
  (~0.1s) to dodge trailing black/fade frames, and fall back to the true last
  frame if that fails.
- **Stop on first failure**, like `batch`: shots already generated are kept
  and reported with real cost. A broken shot 3 must not burn shots 4..N.
- **Optional concat into one file**, ffmpeg-only, fail open: no ffmpeg means N
  separate clips plus a clear note, never a lost shot. Same contract as the
  contact sheet.
- **Shot 1 accepts a normal `--aspect-ratio`**; shots 2+ are i2v and therefore
  adaptive, inheriting framing from the fed frame. Say this once rather than
  letting a user wonder why their flag stopped applying.

## Requirements

1. `chain --shot "..." --shot "..." [--shots-file FILE]`, generating each shot
   in order through the existing `cmd_generate` path.
2. Each shot after the first gets the previous shot's near-final frame as
   `--frame-first-image`.
3. Estimate the whole sequence before spending anything (N x duration x rate),
   and report real total plus per-shot cost from each job's `usage.video_cost`.
4. Stop on first failure; keep and report completed shots; exit non-zero.
5. Optional concat of the finished shots into one file (`--no-concat` to skip);
   fail open when ffmpeg is missing.
6. Report absolute paths for every artifact.
7. Document honestly what chaining does and does not guarantee, once the real
   run has told us which it is.
8. Tests, free by construction, in the shape of the existing suites.

## Acceptance Criteria

- [x] `chain` generates N shots in order, each after the first fed by its
      predecessor's frame
- [x] Frame extraction verified against a real clip (valid image, correct
      dimensions, provably from the end and not the start)
- [x] Estimate covers all N shots and appears before any submission
- [x] A failed shot stops the run with completed shots kept and reported —
      **proven by a real failure**, not a simulated one: the first paid run
      hit the real-person restriction on shot 2 and stopped, having spent
      $0.44 instead of $1.32
- [x] Concat produces one playable file when ffmpeg is present, skipped with
      a reason when not
- [x] All reported paths are absolute
- [x] **The real paid run settled continuity**: shot 2 opened on very nearly
      the exact frame it was fed — cup position and scale, window frame, table
      grain, light direction all carried over — then followed its own prompt.
      Real continuity, not just matched framing. Brightness shifts slightly
      across a seam. Docs say exactly this.
- [x] Existing suites green; shellcheck clean; zero CJK

## Verification

| Check | Result |
|---|---|
| chain tests | 18/18 |
| pricing / provider / batch / validation | 14 / 27 / 21 / 36 |
| image validation | 18/18 |
| cloudflare-drop | 57/57 |
| shellcheck | zero warnings |
| Live run 1 (real-person, 3 shots) | stopped correctly at shot 2, $0.44 |
| Live run 2 (object, 2 shots) | both completed + joined, $0.88, matched estimate |
| Total spend | $1.32, exactly the approved budget |

## The finding that mattered more than the feature

`bytedance/seedance-2.5` image-to-video **refuses reference frames containing
a real person** — `HTTP 400 / input_moderation_failed`, "may contain real
person", nothing generated, nothing billed.

This was invisible to reasoning for two reasons, both now recorded in
`.trellis/spec/skills/external-api-integration.md`:

1. Every previously documented reference-image failure was *structural*
   (`bad_data_uri`, `not_image`, `too_large`). A perfectly valid image can be
   refused for its **subject**.
2. The mechanism was already proven — `seedance-anime-drama` has always reused
   a character reference successfully. But an anime sheet is not a photoreal
   person. A proven mechanism meeting a new *kind* of input is a new test.

Consequence for the product: chaining works for products, landscapes,
illustration and anime, and **not** for live-action human sequences. Each of
the four scenario skills now states its own answer rather than sharing a
general caveat.

`input_moderation_failed` was previously unmapped (it fell through as
"unrecognized error code") and is now distinguished from
`output_moderation_failed`, which happens after a job runs and wants entirely
different advice.

## Definition of Done

- All acceptance criteria checked
- CHANGELOG entry + version bump
- Committed locally, not pushed

## Out of Scope

- v2v video extension (deferred by the user)
- Editing beyond a straight concat (transitions, trimming, audio mixing)
- A fifth scenario skill
- Any push or publish

## Technical Notes

- `--frame-first-image` local-file handling, the adaptive-ratio rule, and the
  ARG_MAX fix are all documented in `references/api-params.md`
- `make_contact_sheet()` is the working precedent for ffmpeg usage and its
  fail-open contract
