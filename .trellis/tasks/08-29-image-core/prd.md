# Add ofox-image-core shared execution layer

## Goal

Add a second shared execution-layer skill, `ofox-image-core`, wrapping Ofox's image generation API the way `ofox-video-core` wraps the video API. This is the prerequisite for `seedance-anime-drama` (source plan §3.2: "先出角色设定图再生视频" — generate a character reference image first, then feed it into video generation), and is scoped to just the image-generation layer itself — anime-drama's two-step orchestration is a separate follow-up task, matching how `ofox-video-core` shipped before any scenario skill used it.

## What I already know

- Ofox's images API (`https://ofox.ai/docs/api/openai/images`) is **synchronous** — no job id, no polling, unlike the video API. This makes `ofox-image-core` structurally simpler than `ofox-video-core`.
- `POST https://api.ofox.ai/v1/images/generations`, same `Authorization: Bearer $OFOX_API_KEY` auth. Models: `openai/gpt-image-2`, `google/gemini-3.1-flash-image` (Nano Banana 2 — verified exact string, not `-preview`), `bailian/qwen-image-3.0-pro`.
- Response is always `data[0].b64_json` (base64) — no URL option, ever. Must decode and save to a file, mirroring the "always report an absolute path" lesson from `ofox-video-core`'s own history (`.trellis/spec/skills/index.md`'s Quality Check bullet already generalizes this).
- Full detail, params, response shape, and known gotchas (Gemini doesn't support `n`; Qwen's image-to-image field name `input_references`... actually `input_images`, and any other spelling is *silently* ignored, not an error) are in `research/ofox-images-api.md` — read it before implementing, don't rediscover.
- `.trellis/spec/skills/index.md` and `external-api-integration.md` (the no-resubmit rule doesn't obviously apply the same way to a synchronous API with no create-then-poll shape, but the "don't trust docs about field presence, verify with a real call" and "absolute path reporting" lessons both apply directly).
- Pricing is NOT well-understood from docs alone (token-based, unclear per-image conversion) — must be derived from a real response's `usage` fields, not guessed from the model page's token rates.
- `CONTRIBUTING.md` — English-only, frontmatter shape, safety contract, real-machine-tested commands.

## Requirements

- `skills/ofox-image-core/SKILL.md` + `references/ofox-image.sh` + `references/api-params.md` + `references/pricing.md` — mirroring `ofox-video-core`'s structure (frontmatter per CONTRIBUTING.md; name: `ofox-image-core`; description noting it's a library skill for scenario skills to build on, similar framing to `ofox-video-core`'s own description).
- Safety contract for `OFOX_API_KEY` — same discipline as `ofox-video-core` (read only from shell env, never printed/logged, check-once-then-proceed, fail-open on missing key with the same `https://app.ofox.ai` signup guidance).
- `ofox-image.sh`: bash + curl + jq only. Scope to `POST /v1/images/generations`, text-to-image only (no `input_images`, no `/v1/images/edits` — see Out of Scope). Responsibilities: validate parameters client-side before any network call (model name, size, quality — reject unsupported combinations, e.g. `n` with a Gemini model, per the research doc's documented constraint); build the request; POST; on success, base64-decode `data[0].b64_json` and write to a file (absolute path, printed as its own line, same discipline as `ofox-video-core`'s `VIDEO_PATH`); print the real `usage` token counts and (once verified — see below) a computed real dollar cost; map error codes/messages the same way `ofox-video-core` does (always surface the raw `error.message`, don't just show a generic mapped explanation) — this API's specific error vocabulary hasn't been fully explored yet; verify against real errors during implementation/testing, don't just guess from the two examples in the research doc.
- No polling/no-resubmit-rule complexity needed (synchronous API) — but note in `SKILL.md` that a client-side network failure with no response is still ambiguous the same way it is for a `POST`, and a retry is only safe if genuinely no response was received (same reasoning as the video skill's exit-5 case, adapted).
- `references/pricing.md`: do not publish a guessed per-image dollar figure from the model page's token-rate phrasing alone. Compute the actual cost of at least one real generated image (from its real `usage` response, cross-referenced against the documented $/M token rates) and document that as a concrete, verified example, flagging that per-model/per-size cost will vary with actual token usage.
- Update `README.md`'s Skills table (new row; decide the Group — could stay `Video` or become a new `Image` group, since this repo will now have skills across two output media; use judgement, but be consistent — check whether `Video` should be renamed or a new group added) and `skills.sh.json`.

## Acceptance Criteria

- [ ] Real end-to-end test: at least one real `generate` call (cheapest viable size/quality/model) succeeds — image decoded, saved to an absolute path, real cost computed and reported. Get explicit user go-ahead before spending (same gate as every prior real test this session) — this is genuinely new spend, not a reuse of an existing free-pollable job (there's no job id/poll mechanism here, every real verification costs money).
- [ ] At least one error path verified for real (bad model, or an unsupported param combination like `n` on Gemini) — confirm it fails clearly, cheaply, and (if a per-request pricing model means errors are unbilled here too) confirm billing behavior rather than assuming it matches the video API's semantics.
- [ ] No Chinese/CJK text anywhere in new files.
- [ ] `README.md`/`skills.sh.json` updated and consistent.
- [ ] `bash -n`/`shellcheck` clean.

## Definition of Done

- Passes `CONTRIBUTING.md`'s quality bar.
- Real (paid, user-approved) end-to-end test passes, with verified real pricing documented (not guessed).
- Committed locally (not pushed).

## Out of Scope

- `seedance-anime-drama` itself (the two-step character-image-then-video orchestration) — separate follow-up task, built on top of both `ofox-image-core` and the existing `ofox-video-core`.
- `POST /v1/images/edits` (multipart, OpenAI-models-only image editing) and Qwen's `input_images` image-to-image path — text-to-image only for this pass; add later if a scenario actually needs "edit this existing image" rather than "generate a fresh reference image."
- Any change to `ofox-video-core` or the three existing video scenario skills.
- Testing `bailian/qwen-image-3.0-pro` for real (document it as a supported model per the API docs, but the real end-to-end test only needs to cover one model — prefer whichever is actually needed for anime-drama, i.e. `google/gemini-3.1-flash-image`, unless it turns out to be broken/unsuitable, mirroring how the video-core work discovered real per-model quirks only through testing).

## Technical Notes

- This task's own research: `research/ofox-images-api.md` — full param/response/gotcha detail, read before implementing.
- Prior work for structural precedent: `.trellis/tasks/archive/2026-08/08-29-seedance2-5-skills/` (original `ofox-video-core` build) and `.trellis/tasks/archive/2026-08/08-29-product-video/` (the real-testing-uncovers-real-bugs pattern — expect the docs to be incomplete here too, budget for at least one round of "this didn't say X" discovery).
- Given today's session already involved one subagent (a fork) making an unauthorized real paid call, and this task's every real verification is inherently a new spend (no free-poll equivalent), be extra disciplined here: state the exact planned test (model/size/quality, and an estimated cost range even if imprecise) and get explicit go-ahead before each real call, don't bundle assumptions about "this one's obviously cheap" the way video-duration/resolution made cost obviously boundable.
