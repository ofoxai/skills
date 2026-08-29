# Add seedance-product-video scenario skill

## Goal

Add the third scenario skill from the source plan's week-2 batch (`2026-08-28_GitHub两类仓库操作手册.md` §3.2, not committed): e-commerce product video — turning a static product photo into a clean, catalog-style video (e.g. "make this product photo a 360-degree white-background showcase, 5 seconds"). Same execution pattern already proven twice (`seedance-short-drama`, `seedance-ad-creative`): a thin scenario layer over `ofox-video-core`, no new execution-layer code needed — this scenario is pure image-to-video, a capability `ofox-video-core` already has (`--frame-first-image`).

## What I already know

- `ofox-video-core` (already built, checked, real-tested, currently `metadata.version: "1.0.2"`) already supports image-to-video via `--frame-first-image`/`--frame-last-image`, and its `SKILL.md` now requires the calling agent to state `VIDEO_PATH` as a standalone absolute-path line (fixed in the prior task `08-29-video-path-absolute`).
- `seedance-ad-creative` already demonstrates the "prefer image-to-video over text description when a real product photo is available, for label/logo fidelity" pattern — this scenario is a close cousin but distinct: ad-creative is cinematic/mood-driven brand advertising (dramatic lighting, camera moves, artistic tone), while product-video is utilitarian e-commerce catalog content (clean white/plain background, literal 360-rotation or simple showcase motion, no dramatic lighting) — the two skills' triggers and prompt-craft guidance must stay clearly differentiated so an agent picks the right one.
- `.trellis/spec/skills/index.md` and `external-api-integration.md` capture the reusable conventions (delegate to `ofox-video-core`, no-resubmit rule, absolute-path reporting) — read these, don't rediscover them.
- `CONTRIBUTING.md` — English-only, frontmatter shape, version starts at `1.0.0`.

## Update (2026-08-29): real testing surfaced a shared bug, scope expanded

While gathering the real end-to-end test for this skill, extensive real (paid) API investigation — verified independently via free polls, see `research/seedance-2.5-image-to-video.md` — found that `ofox-video-core`'s current image-to-video support is broken specifically for `bytedance/seedance-2.5` (the default model): it requires `"aspect_ratio": "adaptive"`, a value not in the script's whitelist, and every other value fails. This affects `seedance-ad-creative` too (already shipped, also recommends `--frame-first-image` with the default model). Two more real, verified findings also need fixing: reference-image reliability (prefer base64 over some remote URLs), and a swallowed `error.message` that would have surfaced the actual fix sooner. Scope is now: fix `ofox-video-core`, update both affected scenario skills, then complete this skill's own real test using the fixed script. Full detail: `research/seedance-2.5-image-to-video.md`.

## Requirements

### ofox-video-core fixes (new, shared — see research doc for exact detail)

- Add `adaptive` to `VALID_ASPECT_RATIOS`.
- When an image is attached (`--frame-first-image`/`--frame-last-image`) and the model is `bytedance/seedance-2.5`: force `aspect_ratio` to `adaptive`, and print a visible notice if this overrides a different value the caller passed (never silently override).
- Support a local file path for `--frame-first-image`/`--frame-last-image` in addition to remote URLs: auto-detect a local readable file and base64-encode it into a `data:` URI (no new dependency beyond what's already used).
- `print_api_error()`: always print the response's `error.message` alongside the mapped friendly explanation, not only when `error.code` is unrecognized — a specific detail (e.g. a minimum image width) can live in the message even when the code is a generic one like `invalid_request`.
- Add `output_moderation_failed` to the error-code mapping: post-generation failure, not billed (verify no `usage` field), safe to retry with a different prompt (a new request, not a resubmission).
- Bump `metadata.version`.

### seedance-ad-creative updates (already shipped, needs a correction)

- Its documented `--frame-first-image` example currently shows an explicit `--aspect-ratio` that (per the fix above) gets silently overridden today, or will be force-set to `adaptive` once fixed — update the prose/example so it doesn't claim an aspect ratio takes effect when it won't, and mention preferring a local file over a remote URL where available.
- Add `output_moderation_failed` to its failure-mode table.
- Version bump.

### seedance-product-video (this skill, new)

- `skills/seedance-product-video/SKILL.md`: new scenario skill. Frontmatter per `CONTRIBUTING.md` (name == directory name, concrete "use when" triggers e.g. "make this product photo a 360-degree showcase", "turn this photo into a white-background product video", "make a clean turntable video of this item", license: MIT, metadata.author: ofoxai, metadata.version: "1.0.0"). Write its `--frame-first-image` guidance and examples *already knowing* the `adaptive` override behavior and local-file preference — don't write it the old way and have to re-fix it immediately after.
- Delegate entirely to `../ofox-video-core/references/ofox-video.sh` (relative path, same as the other two scenario skills) — do not duplicate request/poll/download/error logic. Reference (don't restate) `ofox-video-core`'s safety contract, no-resubmit rule, and absolute-`VIDEO_PATH`-reporting requirement.
- Prompt craft specific to this scenario: describing the product precisely (shape/material/color, matching ad-creative's framing guidance where it overlaps, since accurate product description matters for both), explicit "pure white background" / "clean studio background, no props" language, camera motion described as smooth/simple (360-degree turntable rotation, or a slow single-axis orbit) rather than the more elaborate cinematography vocabulary used in `seedance-ad-creative` — this scenario is about clarity and product accuracy, not mood.
- Strongly prefer (practically require) `--frame-first-image` with a real product photo over pure text description — state plainly why: literal product accuracy (exact shape, printed text/logo, color) matters more here than in any other scenario, and pure text-to-video is much more likely to invent an inaccurate product.
- Recommended defaults: aspect ratio and resolution suited to e-commerce listing use (e.g. `1:1` or `4:3` for marketplace listings, call out `16:9`/`9:16` as alternatives depending on where the video will be used — ask the user rather than assuming a single fixed default, since e-commerce platforms vary widely); duration short (5–10s, matching the "5 秒" example in the trigger); audio typically not needed for a pure product-rotation clip (`--generate-audio false` as the scenario default, unlike short-drama/ad-creative which default to audio on) — but confirm this against `ofox-video-core`'s actual default/flag behavior, don't assume.
- Cost estimate before generating, referencing `../ofox-video-core/references/pricing.md`'s formula (same pattern as the other two scenario skills), with a worked example.
- Failure-mode table: reuse `ofox-video-core`'s exit-code/error-code table (including the new exit `6` for output-path failures) plus scenario-specific entries — likely overlapping heavily with `seedance-ad-creative`'s image-related failure modes (`bad_data_uri`/`download_failed`/`unreachable`/`not_image`/`too_large`, label/product distortion), reuse that skill's wording pattern rather than reinventing it, but verify duration/resolution-specific defaults referenced in the table match what this skill actually recommends.
- Update `README.md`'s Skills table (new row, Group `Video`, plus the Install section's `npx skills add` line) and `skills.sh.json` (add `seedance-product-video` to the existing `"Video"` grouping).

## Acceptance Criteria

- [x] Root cause of the image-to-video failure independently verified (not just asserted) — done: job `f3a2b2ab-d252-4567-809a-eb6f4dfe0ada` confirmed `completed`/$0.96 via a fresh, independent `GET` poll from the main session; the fixed-script download path was also exercised for free against this same job.
- [ ] `ofox-video-core`'s fixes (adaptive whitelist + auto-override + notice, local-file base64, full error.message surfacing, output_moderation_failed mapping) implemented and checked.
- [ ] `seedance-ad-creative`'s image-to-video guidance corrected to match verified real behavior.
- [ ] Real end-to-end test of *this* skill's own documented `generate` invocation (as shipped, not a manual workaround) succeeds using the fixed script — job completes, video downloaded, absolute `VIDEO_PATH` printed, real cost reported. Prefer reusing free verification (poll of an already-completed job) wherever it proves the same thing as a fresh paid call; only spend new money if genuinely needed to prove something not yet covered, and confirm with the user first for any new non-trivial spend.
- [ ] Skill's guidance clearly differentiates itself from `seedance-ad-creative` (both in its own "When NOT to use" section and in `seedance-ad-creative`'s existing one, if that needs a cross-reference added — check whether `seedance-ad-creative` should link to this new skill given the overlap).
- [ ] Invalid parameter still produces the same clear `ofox-video-core` error (this skill has no reason to break that, but verify by calling exactly what the SKILL.md documents).
- [ ] No Chinese/CJK text anywhere in the new/modified files.
- [ ] `README.md` and `skills.sh.json` updated and consistent (name matches directory/frontmatter everywhere).

## Definition of Done

- Passes `CONTRIBUTING.md`'s quality bar.
- Real (paid, user-approved) end-to-end test passes.
- Committed locally (not pushed), same as the prior two tasks in this line of work.

## Out of Scope

- `seedance-anime-drama` — needs a new `ofox-image-core` execution layer (Nano Banana / `google/gemini-3.1-flash-image` via `POST https://api.ofox.ai/v1/images/generations`) plus a two-step image-then-video orchestration; tracked as a separate future task, not part of this one.
- `bytedance/seedance-2.0`'s own image-to-video behavior beyond what's already verified (it works without the `adaptive` requirement) — not investigating further, out of scope.
- Fully enforcing the ~300px minimum reference-image width client-side (would require an image-inspection dependency beyond curl+jq) — document it, don't enforce it in this pass.
- Publishing to npm/skills.sh/LobeHub/ClawHub (still deferred repo-wide, per the original v1 PRD).

## Technical Notes

- Prior work: `.trellis/tasks/archive/2026-08/08-29-seedance2-5-skills/` and `.trellis/tasks/archive/2026-08/08-29-video-path-absolute/` (both archived) — read their PRDs/research if more API detail is needed beyond what's already in `.trellis/spec/skills/`.
- This task's own research: `research/seedance-2.5-image-to-video.md` — the verified root cause, exact job ids, and exact required fix list. Read this before implementing; it has the specifics this PRD only summarizes.
- Ofox images API (for the *out-of-scope* anime-drama follow-up, noted here only so it isn't lost): `POST https://api.ofox.ai/v1/images/generations` and `POST https://api.ofox.ai/v1/images/edits`, models `openai/gpt-image-2` / `google/gemini-3.1-flash-image` (this is "Nano Banana 2" — verify the exact model-id string, possibly `-preview` suffixed, against `https://ofox.ai/models/google/gemini-3.1-flash-image-preview` before building) / `bailian/qwen-image-3.0-pro`, response image at `data[0].b64_json` (base64, not a URL — different shape than the video API's URL-based response, note this for whoever builds `ofox-image-core`), pricing not in the endpoint doc itself (check the model catalog page).
