# Add seedance-anime-drama scenario skill (character image + video orchestration)

## Goal

Add `seedance-anime-drama` (source plan §3.2: "把这段小说改成动漫分镜并生成视频" — turn a novel/script excerpt into an anime-style storyboard shot). This is the first scenario skill that orchestrates across *two* execution-layer skills rather than one: `ofox-image-core` generates a character reference image first, then `ofox-video-core` generates the shot using that image as `--frame-first-image`. The value-add over `seedance-short-drama` is real visual character consistency across shots (an actual reference image, reused verbatim across every shot of that character) instead of relying on repeated text description alone.

## What I already know

- `ofox-image-core` (v1.0.2) and `ofox-video-core` (v1.1.0) are both shipped, checked, and real-tested. Read both `SKILL.md`s in full — this skill delegates to both, duplicating none of their request/error/path-reporting logic.
- Confirmed real behavior relevant here: `google/gemini-3.1-flash-image` (Nano Banana 2) always outputs 1024x1024 regardless of requested `size` — don't fight this, just accept whatever comes back and don't promise a specific size to the user. `bytedance/seedance-2.5` + `frame_images` auto-forces `aspect_ratio: adaptive` (transparent to this skill, `ofox-video-core` handles it and prints a NOTE — no special handling needed here).
- `seedance-short-drama`'s existing character-consistency workaround (repeat the exact same text description across shots, since jobs are stateless) is the problem this skill actually solves properly — reference it in "When NOT to use"/differentiation, don't duplicate its text-only approach.
- `.trellis/spec/skills/index.md` and `external-api-integration.md` (delegation pattern, no-resubmit rule, absolute-path reporting, the "verify with a real call, don't trust docs" lessons — several of which are Ofox-API-specific facts already baked into the two core skills this one calls).
- `CONTRIBUTING.md` — English-only, frontmatter shape, safety contract.
- Neither core skill has been tested with genuinely non-Latin (e.g. actual Chinese-novel) input text — the "小说" in the trigger phrase is Chinese, but the *skill file itself* must stay English-only per CONTRIBUTING.md; the *prompts a user gives at runtime* (novel text, in whatever language) are not the skill's shipped content and aren't subject to that rule. Don't conflate "SKILL.md must be English" with "the tool can only handle English story text."

## Requirements

- `skills/seedance-anime-drama/SKILL.md`: frontmatter per CONTRIBUTING.md (name == directory name, concrete "use when" triggers e.g. "turn this novel excerpt into an anime video", "make an anime-style storyboard clip of this scene", "generate a manga-drama shot with this character", license: MIT, metadata.author: ofoxai, metadata.version: "1.0.0").
- **Two-step flow, explicit and visible to the user at each step**:
  1. From the user's story/script excerpt, extract (as the calling agent's own reasoning — not the script's job) a precise, reusable character description (appearance: age, build, hair, clothing, distinguishing features) and an anime/manga art-style descriptor. Build a text-to-image prompt and call `../ofox-image-core/references/ofox-image.sh generate` (default model `google/gemini-3.1-flash-image`) to produce ONE character reference image. Show the image path and note it will be reused for every shot of this character.
  2. For each shot: build an anime-style video prompt (scene action, dialogue if any, camera framing) and call `../ofox-video-core/references/ofox-video.sh generate --frame-first-image <the character reference image's absolute path>` (a local file — `ofox-video-core` already auto-base64-encodes local paths) plus the usual video params. Reuse the *same* character image path across every shot featuring that character, exactly the way `seedance-short-drama` reuses the same text description — this is the mechanism that gets real visual consistency instead of hoped-for consistency.
- **Cost estimate covers both steps**, shown before calling either API: an image-generation cost range (honestly caveated — `ofox-image-core`'s own `pricing.md` doesn't have a single confirmed dollar figure yet, present it the same honest way that file does, don't invent false precision) plus the video cost estimate (using `ofox-video-core/references/pricing.md`'s formula, which *is* solid). State clearly that generating N shots of the same character only pays the image cost once (step 1), not once per shot.
- Multiple characters in one shot: **out of scope for v1** (see below) — scope this skill to one primary character reference per shot's `--frame-first-image` slot, matching `ofox-video-core`'s existing single-frame-image capability; if the story needs two characters interacting, generate the primary/foreground character's reference and describe the other character in the video prompt's text (same text-based approach `seedance-short-drama` already uses for secondary detail).
- **One job = one continuous shot** — same constraint `seedance-short-drama` already documents (Seedance 2.5 doesn't do multi-cut editing within one job); a multi-scene "storyboard" from a novel excerpt means multiple `generate` calls, one per shot, confirm scope with the user rather than assuming how many shots.
- Art-style prompt guidance specific to this scenario: anime/manga visual vocabulary (cel-shading, anime proportions, screentone/manga panel look if the user wants a manga-panel aesthetic vs. a more animated-film look) — ask which look the user wants rather than assuming one.
- Failure-mode table: covers both `ofox-image-core`'s exit codes/errors (the size-unreliability gotcha, the corrected error-shape understanding) and `ofox-video-core`'s (including the `aspect_ratio: adaptive` auto-override behavior, which will fire silently-but-noted since this skill always uses `--frame-first-image`).
- Update `README.md` (new row, Group `Video` since it produces video like the other scenario skills — `ofox-image-core` established a separate `Image` group for the *generation-layer* skill, but this scenario skill's end product is video) and `skills.sh.json`.

## Acceptance Criteria

- [ ] Real end-to-end test: generate one character reference image, then generate at least one shot using that image as `--frame-first-image`, following this skill's own documented flow exactly. Get explicit user go-ahead before spending (two separate real costs: one image-generation call, one video-generation call) — estimate both before asking.
- [ ] The generated shot's video visibly uses the character reference (can't be verified by the agent programmatically, but the mechanism — passing the same real image file as `--frame-first-image` — is what's being verified, not the model's output quality).
- [ ] Skill clearly differentiates itself from `seedance-short-drama` (text-only consistency) in both directions.
- [ ] No Chinese/CJK text anywhere in the shipped SKILL.md (the *example* story/prompt text used for the real test may be in any language — that's a runtime input given by whoever tests it, not shipped skill content).
- [ ] `README.md`/`skills.sh.json` updated and consistent.

## Definition of Done

- Passes `CONTRIBUTING.md`'s quality bar.
- Real (paid, user-approved) end-to-end test passes for both steps.
- Committed locally (not pushed).

## Out of Scope

- Multiple characters with separate reference images composited into one shot.
- `ofox-image-core`'s `/v1/images/edits` or image-to-image path (e.g. "regenerate this character in a new outfit") — a fresh reference image per character is enough for v1.
- Automated multi-shot storyboard planning (deciding how many shots a novel excerpt needs) — the calling agent/user decides shot count and content; this skill only handles the craft + execution of one shot at a time.
- Any change to `ofox-image-core` or `ofox-video-core` themselves, unless real testing surfaces an actual bug the way it did for the three prior scenario-skill tasks (budget for that possibility, don't assume it won't happen — it has every time so far).

## Update (2026-08-29): real testing found a real bug in `ofox-video-core`'s local-file support

Step 1 (image generation) succeeded for real (`google/gemini-3.1-flash-image`, real character image, 1408x768, 885KB PNG — also revealing that the earlier "always 1024x1024" finding was based on a single data point and does not generalize; output size appears genuinely unpredictable, and this response's `size`/`quality` fields came back as `unknown` this time too, another response-shape inconsistency).

Step 2 (video generation, using that real image as `--frame-first-image`) failed with `jq: Argument list too long` before ever reaching the network — a real, reproducible bug: `ofox-video-core/references/ofox-video.sh`'s `resolve_image_ref()` base64-encodes a local file into a `data:...;base64,...` string, then passes that entire string as a `jq --arg` command-line argument when building the `frame_images` payload (`ofox-video.sh` around the `frame_first_ref`/`frame_last_ref` handling). This hits the OS's `ARG_MAX` (`getconf ARG_MAX` = 1,048,576 bytes on this machine) — the 885KB PNG's base64 encoding was 1,179,996 bytes, already over the limit. **Any real photo whose base64 encoding exceeds ~1MB (roughly any real photo over ~750KB) breaks the local-file feature entirely** — this isn't an edge case, it's the common case for real reference photos, and it affects every scenario skill that recommends local files (`seedance-ad-creative`, `seedance-product-video`, and now `seedance-anime-drama`). No charge was incurred (400 before job creation).

**Required fix in `ofox-video-core`**: stop passing the base64 data URI as a `jq --arg`/`--argjson` command-line value. Write it to a temp file and use `jq --rawfile` (reads a file's raw content into a jq variable, not subject to `ARG_MAX` since it's not an exec argument) instead, for both `frame_first_ref` and `frame_last_ref`. Clean up the temp file after use (including on error paths). Re-verify with the *same real image* that just failed (free — no need to spend more on a fresh image, reuse the one already generated in Step 1, still on disk).

This task's scope now includes this fix before finishing anime-drama's own real end-to-end test (the fix is required for that test to even be possible).

## Update (2026-08-29): `ofox-video-core` bug fixed and verified offline

The `jq: Argument list too long` bug described above is fixed in
`skills/ofox-video-core/references/ofox-video.sh`
(`metadata.version` bumped 1.1.0 → 1.1.1). Root cause was broader than just
`resolve_image_ref`'s two call sites: the resolved base64 data URI was also
re-embedded via `jq --argjson` when merging the `frame_images` array (and
`--extra-json`) into the request payload, and the fully-assembled payload
was then passed to `curl -d "$payload"` — three separate command-line-
argument exec calls, any one of which would have failed once the string got
large enough. All three now route the large value through a temp file
instead: `jq --rawfile`/`--slurpfile` for the jq steps, `curl --data-binary
@file` for the POST. Temp files are created immediately before each single
use and removed immediately after, mirroring the script's existing
`tmp_body` convention — no temp file survives past the one call that needs
it, on every path including an early `return 1`.

**Verified entirely offline (no call to `api.ofox.ai`, no spend)**:
- `bash -n` and `shellcheck` both clean on the modified script.
- Reproduced the *old* bug directly: extracted the pre-fix `jq --arg`
  pattern into an isolated script and ran it against a synthetic 900KB
  random file (base64 length 1,200,000 bytes, over this machine's
  `ARG_MAX` of 1,048,576) — failed with `Argument list too long`, matching
  the real failure exactly. Also reproduced this via `git stash` running
  the literal old script against the real 885KB PNG from the Step-1 test
  (`test-output/anime-drama/ofox_image_20260829230044_51014.png`) — same
  failure, confirmed A/B against the fixed version.
- Ran the *fixed* `cmd_generate` payload-building logic (via the real
  script, `OFOX_API_BASE_URL` pointed at an unreachable/local address so no
  request ever reaches Ofox) against that same real 885KB PNG: resolved,
  base64-encoded, and merged into the request payload with no argument-
  length error, failing only at the network layer (`curl: (7) Failed to
  connect`, exit 5, correct no-resubmit messaging).
- Stood up a local mock HTTP server (loopback only) and pointed
  `OFOX_API_BASE_URL` at it: the fixed script successfully POSTed a real
  1,180,314-byte JSON body containing the real PNG's exact base64 data
  (verified byte-for-byte via the `iVBORw0K...` PNG signature and an exact
  string round-trip check), with `aspect_ratio` correctly auto-forced to
  `adaptive`, `frame_type: first_frame`, and all other fields intact.
- Regression-checked (same unreachable-address technique): small local
  image, remote `https://` URL, both `--frame-first-image` +
  `--frame-last-image` together, `--extra-json`, and plain text-to-video —
  all reach the network layer exactly as before, no behavior change.

`skills/ofox-video-core/SKILL.md`'s local-file section now documents the
fix (temp-file + `--rawfile`/`--slurpfile`/`--data-binary`, not command-line
args) so a future contributor doesn't reintroduce the same pattern.
`.trellis/spec/skills/external-api-integration.md` has a new gotcha entry
for the general lesson (large values must never be passed as command-line
arguments to `jq`/`curl`/any exec'd command — an OS-level `ARG_MAX` limit,
not an API-documentation gap like the file's other entries).

The real, paid end-to-end test for this task (Step 2: generate a video shot
using the Step-1 character image as `--frame-first-image`, for real,
against `api.ofox.ai`) has **not** been run as part of this fix — it is
deliberately left for the main session to run, per this dispatch's
instructions, using the same real image already on disk from Step 1 (free
to reuse, no new image-generation spend needed).

## Technical Notes

- Prior work: `.trellis/tasks/archive/2026-08/08-29-image-core/` and `.trellis/tasks/archive/2026-08/08-29-product-video/` (the most recent precedents — read their research docs if more Ofox API detail is needed).
- `.trellis/spec/skills/external-api-integration.md` — three real gotchas already documented (mirror_urls fallback, aspect_ratio adaptive, image SIZE-field unreliability, error-shape correction) — this skill's implementation should already account for all of them via the two core skills it calls; if real testing surfaces a *new* gotcha, add a fourth entry rather than treating it as one-off.
- Given every prior task in this line of work has surfaced at least one real bug via real testing, budget implementation time for that possibility rather than assuming this one will be clean.
