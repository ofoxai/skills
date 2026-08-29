# Journal - yunshen (Part 1)

> AI development session journal
> Started: 2026-08-29

---



## Session 1: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills

**Date**: 2026-08-29
**Task**: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills
**Branch**: `main`

### Summary

Shipped v1 of the Seedance 2.5 execution-layer skills: ofox-video-core (shared script wrapping the Ofox video API: create/poll/download/cost report, no-resubmit-on-timeout rule) plus two scenario skills (seedance-short-drama, seedance-ad-creative) that delegate to it. Real paid end-to-end tests ($1.32 total) confirmed the pipeline and caught a real bug: completed jobs don't reliably include mirror_urls, only unsigned_urls -- fixed with a fallback and captured in a new .trellis/spec/skills/ layer for future scenario skills.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e834198` | (see git log) |
| `a968012` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Fix ofox-video-core VIDEO_PATH to always be absolute

**Date**: 2026-08-29
**Task**: Fix ofox-video-core VIDEO_PATH to always be absolute
**Branch**: `main`

### Summary

Real end-to-end testing surfaced a UX gap: a relative --out-dir made the printed VIDEO_PATH ambiguous, and the calling agent could report a path the user couldn't reliably locate. Fixed by resolving out_dir to an absolute path in poll_and_download() (new exit code 6 for an uncreatable/unwritable out-dir), added a standalone-VIDEO_PATH-line reporting requirement to ofox-video-core's SKILL.md, and generalized the lesson into .trellis/spec/skills/index.md's Quality Check for future scenario skills.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f25a1e1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Add seedance-product-video; fix Seedance 2.5 image-to-video

**Date**: 2026-08-29
**Task**: Add seedance-product-video; fix Seedance 2.5 image-to-video
**Branch**: `main`

### Summary

Built seedance-product-video (e-commerce catalog videos). Real paid debugging (~$6 total across this and a scope-violating fork) uncovered the actual root cause of a Seedance 2.5 image-to-video failure that also affected the already-shipped seedance-ad-creative: the model requires aspect_ratio=adaptive when an image is attached, undocumented and outside the parameter's normal value list. Fixed ofox-video-core to auto-correct with a visible notice, added local-file-to-base64 support (remote URLs proved unreliable), surfaced previously-swallowed upstream error messages, and mapped a new output_moderation_failed error code. Corrected seedance-ad-creative's now-stale examples. Captured the general lesson in .trellis/spec/skills/external-api-integration.md. Also: a forked subagent exceeded its scope and made an unauthorized real paid API call mid-investigation -- flagged to the user immediately and filed as product feedback.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e38918f` | (see git log) |
| `f552e4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Add ofox-image-core (text-to-image execution layer)

**Date**: 2026-08-29
**Task**: Add ofox-image-core (text-to-image execution layer)
**Branch**: `main`

### Summary

Built ofox-image-core, the shared execution layer for Ofox's synchronous image-generation API (POST /v1/images/generations), scoped to text-to-image only for now -- the prerequisite for a future seedance-anime-drama task. Two real, user-approved paid calls found two more real bugs: (1) google/gemini-3.1-flash-image's response claims the requested size but actually always returns 1024x1024 -- the field can't be trusted; (2) the earlier-documented 'confirmed' error code (provider_type_unavailable) was never actually observed, just inferred from doc prose -- the real error shape is {error:{message,type,code}} with code as a bare HTTP status number and type as the real classifier. Both findings corrected in the skill's docs and in .trellis/spec/skills/external-api-integration.md. Real image-to-image (input_references) and video-to-video remain untested, deferred until a scenario actually needs them.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6e76c8b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Add seedance-anime-drama (image+video orchestration); fix ARG_MAX bug

**Date**: 2026-08-30
**Task**: Add seedance-anime-drama (image+video orchestration); fix ARG_MAX bug
**Branch**: `main`

### Summary

Shipped seedance-anime-drama, the first scenario skill to orchestrate two execution-layer skills: ofox-image-core generates one character reference image, then ofox-video-core reuses that exact image as --frame-first-image across every shot for real visual consistency. Real two-step paid test (image + video) succeeded end-to-end. Along the way, real testing found ofox-video-core's local-file image support was silently broken for any real photo over ~750KB since it launched: base64-encoding a large local file and passing it via jq --arg/--argjson (and even the final curl -d) hits the OS's ARG_MAX (1MB), producing 'Argument list too long' before any network call. Fixed by routing all three call sites through temp files (jq --rawfile/--slurpfile, curl --data-binary @file). Also found the earlier 'Nano Banana 2 always outputs 1024x1024' claim doesn't generalize -- a second real test produced 1408x768 -- output size is genuinely unpredictable, not a fixed fallback.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e88e2fa` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
