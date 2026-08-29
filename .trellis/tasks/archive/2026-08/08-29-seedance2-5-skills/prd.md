# seedance2.5-skills: ofox-video-core + short-drama + ad-creative execution skills

## Goal

Ship the first execution-layer Seedance 2.5 skills into `ofoxai/skills` (this repo). Every existing Seedance skill on GitHub only writes a prompt for the user to paste elsewhere; none of them call an API, poll, download the result, or report cost. We fill that gap: a user says one sentence to their agent, and the skill calls the Ofox video API, polls to completion, downloads the mp4 locally, and prints the real cost. Every installed user needs an Ofox API key, so every install is a registered Ofox user — this is the growth mechanism behind the traffic/backlink goals in the source plan (`2026-08-28_GitHub两类仓库操作手册.md`, not committed to git).

## What I already know

- This repo (`ofoxai/skills`) is a public, skills.sh-distributed monorepo. Existing skills: `hal-vault`, `hal-image`, `cloudflare-drop`. `CONTRIBUTING.md` sets the quality bar every skill must clear.
- `CONTRIBUTING.md` hard requirements: English only (name/description/body/examples — no Chinese anywhere in the shipped skill); frontmatter must have `name` (kebab-case, == directory name), `description` (concrete "use when..." triggers), `license: MIT`, `metadata.author: ofoxai`, `metadata.version` (semver, bump on every change); a safety contract stated near the top when the skill touches anything sensitive (here: the API key); every command must be tested on a real machine, no invented flags; fail-open unless safety requires fail-closed; self-contained (no private links).
- `skills/cloudflare-drop` is the closest in-repo precedent: wraps a real external call (Wrangler), verifies the result honestly (never claims success it can't back up — `URL_UNVERIFIED` discipline), reports which mode it ran in, versioned frontmatter. This is the pattern to imitate.
- External reference `EvoLinkAI/gpt-image-2-gen-skill` (fetched and read) confirms two non-obvious patterns worth adopting: (1) check the API key env var once on load — if missing, give a signup link + one-line offer, and don't re-prompt once validated; (2) once a paid job is submitted, never resubmit it just because polling is taking a while — that double-charges the user. `ofox-video-core`'s polling logic must guard against this explicitly.
- GitHub Seedance skills already surveyed in the source plan (dexhunter/seedance2-skill, songguoxs/seedance-prompt-skill, LeoYeAI/seedance-skills, nutllwhy/seedance-tvc-director, liyue-aigc/seedance-2-5-video-director, huangbai-AI/sd-2-5-prompt, etc.) are all prompt-only — no code pattern worth copying from them, only the confirmation that the execution layer is empty.
- Ofox video API is fully public (`https://ofox.ai/docs/api/videos`, verified 2026-08-29 — re-check before relying on exact numbers later, docs can change):
  - Create: `POST https://api.ofox.ai/v1/videos`, header `Authorization: Bearer $OFOX_API_KEY`, returns `202` + `{id, status, polling_url}`.
  - Params: `model` (`bytedance/seedance-2.5`), `prompt`, `duration` (integer seconds, 4–30 for Seedance 2.5), `resolution` (480p/720p/1080p/1K/2K/4K), `aspect_ratio` (16:9/9:16/1:1/4:3/3:4/3:2/2:3/21:9/9:21), `size` (WIDTHxHEIGHT, alternative to resolution), `generate_audio` (bool, default true), `seed`, `frame_images` (first/last frame image-to-video), `input_references` (≤9 images / ≤3 audio ≤15s each / ≤1 video), `real_person` (bool), `callback_url` (HTTPS webhook), `provider`.
  - Poll: `GET https://api.ofox.ai/v1/videos/{id}`. States: `pending/queued/in_progress/completed/failed/cancelled/expired`. On completion: `mirror_urls` (CDN-signed, persistent — prefer this for download over `unsigned_urls`, which can expire in 24h), `usage.video_seconds`, `usage.video_cost` (string, 10 decimal places).
  - Errors (`error.code`, never parse `error.message`): 400 `invalid_request`/`invalid_callback_url`/`references_conflict`/`too_many_references`/`cancel_not_supported`/`cancel_failed`; 401 `unauthorized`/`invalid_api_key`/`upstream_auth_failed`; 402 `insufficient_credits`; 404 `not_found`/`model_not_found`; 429 `rate_limited`; 502 `upstream_error`/`route_error`; 500 `internal_error`.
  - Seedance 2.5 pricing (`https://ofox.ai/models/bytedance/seedance-2.5`, verified 2026-08-29): 480p $0.11/s (t2v) / $0.14/s (v2v); 720p $0.24/s / $0.30/s; 1080p time-limited $0.48/s (list $0.60/s) / $0.568/s (list $0.71/s).
  - Get-key page: `https://app.ofox.ai` (Settings → API Keys → Create New Key after login).
- Local dev setup already done: `.env.example` (committed, template) + `.env` (gitignored, holds a real test key already provided by the user) + `.gitignore` updated.
- `gh` is authenticated (`repo` scope); this working directory is the actual `ofoxai/skills` clone, so push access is presumptively fine (only confirmed for real on first push attempt).

## Assumptions (temporary)

- Seedance 2.5 scenarios needing only text-to-video and first/last-frame image-to-video (no video-to-video input) are sufficient for the two v1 scenarios; `video-extend-edit` (video input) is out of scope.
- The user (yunshen) is the sole developer for v1 — no multi-person CODEOWNERS/branch-protection setup needed yet (source plan §8 describes a team split that doesn't apply here).

## Open Questions

- **Blocking, deferred to test time (not blocking PRD/build)**: running the real end-to-end generation test (source plan §5.5) spends real money against the user's Ofox balance (e.g., ~$0.44 for a 4s 480p clip, more at 1080p). Must get explicit go-ahead from the user immediately before the first real API call — do not spend without asking each time credits would be used non-trivially.

## Requirements

- Add `skills/ofox-video-core/`: `SKILL.md` + `references/ofox-video.sh` (bash + curl + jq only) + `references/api-params.md` + `references/pricing.md`. Script responsibilities: create task, poll `polling_url` until terminal state, download the video from `mirror_urls` to the current working directory, print the file path and `usage.video_cost`. Must guard against resubmitting a job on slow polling (track submitted job id, never re-POST for the same logical request).
- Add `skills/seedance-short-drama/SKILL.md`: multi-shot / dialogue / realistic-human scenario. Prompt template guidance, recommended params, cost estimate before generating, common-failure guidance (mapped from the Ofox error codes above).
- Add `skills/seedance-ad-creative/SKILL.md`: cinematic brand-ad scenario. Same structural requirements as short-drama.
- Both scenario skills call into `ofox-video-core`'s script rather than duplicating API logic.
- Update `README.md` Skills table (one row per new skill, Group = Video) and `skills.sh.json` (new entries for the three skills).
- All three `SKILL.md` files: English only, complete frontmatter per `CONTRIBUTING.md` (name/description/license/metadata.author/metadata.version), safety contract for `OFOX_API_KEY` handling stated near the top, key-check-once-then-proceed flow (no re-prompting once validated), fail-open when the key is simply missing (guide to `https://app.ofox.ai`, don't hard-block the conversation).

## Acceptance Criteria

- [ ] `ofox-video-core` script successfully creates a job, polls to completion, downloads a real mp4, and prints accurate cost — verified with one real API call (after explicit user go-ahead for the spend).
- [ ] `seedance-short-drama` and `seedance-ad-creative` each trigger correctly from natural language in Claude Code and produce a downloaded video + cost report.
- [ ] Deliberately passing an invalid parameter (e.g. unsupported resolution) produces a clear, actionable error, not a raw stack trace or silent hang.
- [ ] Fresh install on a machine without `jq` shows a correct, actionable install prompt (not a cryptic failure).
- [ ] Each of the three skills triggers correctly in at least Claude Code (Codex CLI / OpenCode checks tracked but not blocking v1 sign-off if unavailable in this environment).
- [ ] `README.md` Skills table and `skills.sh.json` updated and consistent with `CONTRIBUTING.md`'s layout rules.
- [ ] No Chinese text anywhere in the shipped `SKILL.md` files, scripts, or references.

## Definition of Done

- All three skills pass `CONTRIBUTING.md`'s quality bar (English-only, complete frontmatter, safety contract, real-machine-tested commands, fail-open, self-contained).
- Real commands tested on this machine at least once each (per Acceptance Criteria).
- PR opened against `ofoxai/skills` `main` (this task does not decide whether to merge/push — that's a separate confirmation before any `git push`).

## Out of Scope

- `awesome-seedance-2.5` collection/showcase repo (separate initiative, deferred — depends on the `ofox.ai/seedance-2-5-prompts` landing page existing first, per source plan §4.1).
- Publishing to npm, skills.sh submission-for-search, LobeHub import, ClawHub publish (source plan §5.6) — v1 ships the skills into the repo and tests them locally; distribution is a follow-up task once these two scenarios are proven.
- The standalone `ofox-media-skills-cli` npm package.
- Multi-model automatic fallback (Wan 2.7 / HappyHorse retry-on-rejection).
- Batch generation + first/mid/last-frame comparison grid ("抽卡") tooling.
- The other 12 scenarios from the source plan's scenario table (anime-drama, product-video, talking-head, ugc-ads, shorts-reels, product-demo, keyframe-animation, video-extend-edit, image-edit, product-image, music-video, explainer).
- Multi-person CODEOWNERS / branch protection setup (source plan §8) — single-developer flow for now.

## Technical Notes

- Source plan (context, not committed): `2026-08-28_GitHub两类仓库操作手册.md` at repo root, sections §3.2, §5.
- Repo conventions: `CONTRIBUTING.md`, `skills/cloudflare-drop/SKILL.md` (pattern reference).
- External reference read in full: `EvoLinkAI/gpt-image-2-gen-skill/SKILL.md` (frontmatter shape, key-check flow, error-code-to-friendly-message mapping, no-resubmit-on-timeout rule).
- Ofox API reference is also captured in Claude's cross-session memory (`ofox-video-api` and `seedance-skills-project-scope` entries) — re-verify against `https://ofox.ai/docs/api/videos` if this task resumes far in the future, since pricing/params can drift.
- `.env` / `.env.example` already set up at repo root for local script testing; the shipped `ofox-video.sh` itself must read `$OFOX_API_KEY` directly from the shell environment, not from a dotenv file (no added dependency, works when installed on any user's machine via `npx skills add`).
