# Harden and re-test shipped skills: publish gate, quality polish, differentiator features

## Goal

The 9 skills in this repo pass the source plan's §5.5 test matrix, but a
fresh audit found three real validation defects in `ofox-video.sh`, three
frontmatter incompatibilities with ClawHub's actual spec, a CONTRIBUTING
violation in `cloudflare-drop`, and none of §3.3's differentiator features.
This task fixes all of that and lands the first two stages of the "gacha"
workflow (§3.3 items 3 and 5), so the repo is genuinely publish-ready and
does something no competing Seedance skill does.

## What I already know

### Audit results (2026-08-30, all $0, no paid calls)

Clean: 9/9 frontmatters have `name` == dir name, `description`, `license`,
`homepage`, `metadata.author`, `metadata.version`; `bash -n` and
`shellcheck -S warning` both silent on `ofox-video.sh` (803 lines) and
`ofox-image.sh` (527 lines); 6 invalid-parameter cases all exit 1 before any
network call; `cmd_check()` is purely local; `README.md` / `skills.sh.json`
/ on-disk skills in exact sync; §5.5 items 1-5 verified across Claude Code,
Codex CLI and OpenCode in prior archived tasks.

### Three real defects in shipped `ofox-video.sh`

Root cause for all three: one hardcoded global validation table instead of
per-model limits. Verified against live `/v1/models` data
(`research/ofox-models-endpoint.md`):

1. **Aspect ratio too permissive** — script accepts `3:2`, `2:3`, `9:21`;
   `seedance-2.5` supports none of them. They pass local validation, then
   the server returns a generic `invalid_request`.
2. **Duration validated for exactly one model** — the 4-30s check only fires
   when `model` is literally `bytedance/seedance-2.5`. The other 7 video
   models get no check at all and all have different ranges (`wan-*` 2-15s,
   `happyhorse-*` 3-15s, `seedance-2.0*` 4-15s).
3. **Resolution list wrong in both directions** — accepts `1K`/`2K` (no
   video model supports either), misses `4k` (which `seedance-2.0` does
   support, lowercase in the API), and lets `480p` through for `wan-*` /
   `happyhorse-*` which don't support it.

### `GET /v1/models` is public, keyless, and free

Verified live with `OFOX_API_KEY` unset → HTTP 200, 140 models, 8 with
`/v1/videos` in `supported_endpoints`. Each carries `video_attributes`
(modes, resolutions, default_resolution, min/max duration, aspect_ratios,
supports_audio), `supported_parameters`, `pricing.output_video_per_second`,
`is_deprecated`, `expiration_date`. Full table and the snapshot are in
`research/ofox-models-endpoint.md` + `research/models-snapshot.json`.

Caveat recorded there: `output_video_per_second` is **not** a quotable
price — for `seedance-2.5` it is the 480p rate while `default_resolution` is
720p; for `seedance-2.0-mini` it is the 720p rate. Safe for coarse ranking
only; precise estimates still need the per-resolution tier tables.

### The publish gate is smaller than the plan doc says

Per `research/publish-gate-reality-check.md`, checked against the live
ClawHub format spec and skills.sh schema:

- `_meta.json` — **not defined by ClawHub at all.** Required file set is
  just `SKILL.md`; optional set is supporting files + `.clawhubignore` +
  `.gitignore` + `.clawhub/origin.json` (CLI-written). Building it would
  produce a file nothing reads.
- `llms-install.md` — also not part of the format; a Cline convention, not
  consumed by any of the four target directories.
- Root `package.json` — the skills.sh schema is `additionalProperties:
  false` with only `$schema`/`schema`/`notGrouped`/`groupings`, and never
  references it. It is needed only for the npm package, which the plan doc
  itself puts in a separate repo and which the user has scoped out.

But three frontmatter gaps are real:

| Field | ClawHub reads | We have | Consequence |
|---|---|---|---|
| `version` | top-level | `metadata.version` only | publishes with no version |
| `homepage` | `metadata.openclaw.homepage` | top-level only | lower trust score (§5.6) |
| `envVars` / `primaryEnv` | `metadata.openclaw.*` | absent | installer can't explain or prompt for `OFOX_API_KEY` |

These are **additive** — top-level and nested keys coexist, and Anthropic's
Agent Skills frontmatter treats `metadata` as free-form and defines no
`version`, so adding what ClawHub wants breaks nothing for Claude Code or
skills.sh, and keeps `CONTRIBUTING.md`'s current rules true.

### Other quality defects

- `skills/cloudflare-drop` ships Chinese UI copy in `references/ttl.mjs`
  (`3 小时`/`45 分钟`/`90 秒`), `references/inject-countdown.mjs`
  (`链接有效性检测中…`, `链接将在 MM:SS 后过期`, `已过期，让主人重新生成`), plus
  the tests asserting on it. Violates `CONTRIBUTING.md` rule 1 (English
  only). Note this changes end-user-visible copy in an already-pushed skill.
- No `CHANGELOG.md` on any of the 6 Ofox skills (only `cloudflare-drop`).
- `ofox-video.sh` defaults `--model`; `ofox-image.sh` requires it. Avoidable
  inconsistency for the calling agent.

### Environment

`ffmpeg` 8.1.2 present; ImageMagick (`magick`/`montage`) **absent** — note
`hal-image` already depends on it and copes via CONTRIBUTING rule 6 (fail
open), which is the precedent for treating frame-extraction tooling as an
optional enhancement rather than a hard dependency. `clawhub` CLI not
installed (use `npx`); `npm` not logged in; `gh` logged in with `repo`
scope. `jq`, `curl`, `node` v24, `pnpm` all present.

### Safety constraint

Prior incident (memory): a forked sub-agent with loose instructions made an
unauthorized $0.96 paid call. Every real paid call in this task happens in
the main session, announced with its price immediately beforehand, never
delegated.

## Decisions (from user, 2026-08-30)

- **Scope**: publish gate + quality polish + §3.3 features, delivered in
  three stages; stages 1 and 2 land in this task, stage 3 (multi-model
  fallback) becomes its own task because it interacts with the no-resubmit
  rule and deserves isolated testing.
- **Validation architecture**: `/v1/models`-driven with a local cache
  (TTL), falling back to a bundled snapshot with a warning when the fetch
  fails. Error messages list that model's actual legal values.
- **No push / no merge to main** this round, per the standing rule for this
  line of work.
- **Paid regression**: one low-cost round approved in principle (~$1.8),
  each call announced with its price first.

## Decisions (mine, stated for confirmation)

- Drop `_meta.json`, `llms-install.md`, and root `package.json` from scope —
  no directory reads them (see research). If the npm package happens later
  it gets its own repo and its own `package.json`, per the plan doc.
- Retrofit the 3 pre-existing skills (`hal-vault`, `hal-image`,
  `cloudflare-drop`) with `metadata.openclaw.requires` + top-level `version`
  too — "one repo, one quality bar", and `cloudflare-drop` is being touched
  anyway. Their requirements differ (`CLOUDFLARE_API_TOKEN` + `npx`/wrangler;
  `magick`/`oxipng`; `hal-vault` + ssh), so each gets its own accurate
  declaration rather than a copy-paste.
- `batch` does **not** silently swap in a cheaper model — changing model
  changes the look. It generates N takes on the model the user chose, and
  the cost summary *mentions* the cheaper ladder as an option. Respecting
  intent beats saving money without being asked.
- Cache at `${XDG_CACHE_HOME:-$HOME/.cache}/ofox/models.json`, TTL 24h,
  bundled fallback snapshot trimmed to video+image models only (the full
  response is 164KB, too big to vendor).
- MIT vs MIT-0: recorded as a conscious pre-publish decision, not resolved
  here (no publish happens in this task).

## Requirements

### Stage 1 — foundation, publish gate, polish (all $0-verifiable)

1. Replace `ofox-video.sh`'s hardcoded validation tables with per-model
   limits derived from `/v1/models`: cache read → refetch on TTL expiry →
   bundled-snapshot fallback with a warning → validate `duration`,
   `resolution`, `aspect_ratio`, and mode (t2v/i2v/v2v) against that
   model's `video_attributes`. Error text names the model and lists its
   legal values. Never let a cache/network problem block a generate that
   would otherwise be valid — warn and fall back.
2. Same treatment for `ofox-image.sh` where the models endpoint carries
   equivalent attributes for image models (verify what it actually exposes
   before assuming symmetry).
3. Add top-level `version` (mirroring `metadata.version`) to all 9 skills;
   add `metadata.openclaw.homepage`, `primaryEnv`, and `envVars` (with
   human-readable descriptions) to the 6 Ofox skills; add accurate
   `metadata.openclaw.requires` + `homepage` to the 3 pre-existing skills.
4. `npx clawhub skill publish --dry-run` on at least the 4 scenario skills;
   fix whatever it flags; capture its output in the task notes.
5. Translate all Chinese copy in `cloudflare-drop` (source + tests) to
   English; keep the tests asserting on the new copy.
6. Add `CHANGELOG.md` to the 6 Ofox skills; bump every touched skill's
   version per `CONTRIBUTING.md`.
7. Update `CONTRIBUTING.md`'s frontmatter template with the new required
   fields so this doesn't regress.
8. Resolve the `--model` default inconsistency between the two core scripts.

### Stage 2 — the gacha chain (§3.3 items 3 and 5)

9. `ofox-video.sh batch --takes N` — submit N independent jobs for one
   prompt, poll them, download all, never resubmit a job that already
   exists (the no-resubmit rule applies per-take).
10. Cost summary: total, per-take, and cost-per-usable-take once the user
    marks which takes are usable. Sourced from each job's real
    `usage.video_cost`, never from the estimate.
11. Optional contact sheet: extract first/middle/last frame per take with
    `ffmpeg` and tile them with ImageMagick `montage`. **Fail open** per
    CONTRIBUTING rule 6 — if either binary is missing, skip the sheet,
    print the take paths and the cost summary, and say why the sheet was
    skipped. Declare both as optional in `metadata.openclaw`, not as
    `requires.bins`.

### Regression (both stages)

12. Re-run the full $0 matrix after changes: `bash -n`, `shellcheck -S
    warning`, the invalid-parameter cases (extended to cover the newly
    validated per-model limits), `check` subcommand, CJK scan,
    README/skills.sh.json sync.
13. One approved paid round against the code paths that actually changed —
    announced call-by-call with its price before running.

## Acceptance Criteria

- [ ] All three validation defects fixed and each proven by a test case that
      fails against the old hardcoded table and passes now, with no network
      call (e.g. `--model alibaba/wan-2.7 --duration 30` now exits 1 locally)
- [ ] `/v1/models` fetch works keyless; cache hit, cache expiry, and
      network-failure-fallback paths each exercised and observed
- [ ] `npx clawhub skill publish --dry-run` clean on the 4 scenario skills,
      output captured
- [ ] Zero CJK characters anywhere under `skills/`
- [ ] `bash -n` + `shellcheck -S warning` still silent on both scripts
- [ ] `batch --takes N` produces N downloaded files plus an accurate cost
      summary built from real `usage.video_cost` values
- [ ] Contact sheet renders when `ffmpeg` + `montage` are present, and is
      skipped with a clear reason when either is missing (both paths tested)
- [ ] `README.md` / `skills.sh.json` / on-disk skills still in exact sync
- [ ] `CONTRIBUTING.md` reflects every new repo-wide requirement

## Definition of Done

- All acceptance criteria checked
- New non-obvious gotchas recorded in
  `.trellis/spec/skills/external-api-integration.md`
- `seedance-skills-project-scope` memory updated
- Committed locally, not pushed

## Out of Scope

- Stage 3 (multi-model fallback) — its own task
- Pushing to GitHub, merging to main, PRs against external repos
- Actually publishing to npm / skills.sh / LobeHub / ClawHub
- `_meta.json`, `llms-install.md`, root `package.json` (nothing reads them)
- A 5th+ scenario skill
- Resolving MIT vs MIT-0 (pre-publish decision, no publish here)

## Research References

- [`research/ofox-models-endpoint.md`](research/ofox-models-endpoint.md) —
  `/v1/models` is public and keyless; full capability/pricing table for the
  8 video models; the three defects it exposes
- [`research/models-snapshot.json`](research/models-snapshot.json) — live
  response captured 2026-08-30 (164KB)
- [`research/publish-gate-reality-check.md`](research/publish-gate-reality-check.md)
  — what the four directories actually require; the three frontmatter gaps

## Technical Notes

- Source plan: `2026-08-28_GitHub两类仓库操作手册.md` (repo root, uncommitted)
  §3.3, §5.2, §5.5, §5.6, §7
- Prior tasks: `.trellis/tasks/archive/2026-08/08-30-*`
- Repo spec: `.trellis/spec/skills/external-api-integration.md`
- The no-resubmit rule (`api-params.md`) governs stage 2: each take is its
  own job; a slow poll is never a reason to re-POST.
