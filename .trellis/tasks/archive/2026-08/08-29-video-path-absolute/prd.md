# Fix ofox-video-core: always report an absolute VIDEO_PATH

## Goal

`skills/ofox-video-core/references/ofox-video.sh` defaults `--out-dir` to `$PWD` and prints `VIDEO_PATH <out_dir>/<file>` on success. If a caller passes a relative `--out-dir` (or if the calling agent's cwd isn't obvious to the end user, e.g. inside a Claude Code session), the printed `VIDEO_PATH` can itself be a relative or otherwise non-obvious path — the user has no reliable way to know where their generated video actually landed. Since "here's your video" is the entire value proposition of this skill family, this is a real product gap worth fixing before more scenario skills are built on top of it (this repo ships publicly).

Decided already (in conversation, not re-litigated here): keep the default output location as `$PWD` (matches typical CLI convention, e.g. `wget`; user controls it via `--out-dir`) rather than switching to a fixed global folder — just make sure whatever path is reported is always absolute and always stated prominently.

## Requirements

- `ofox-video-core/references/ofox-video.sh`: resolve `out_dir` to an absolute, canonical path before it's used to build `outpath` in `download_result()`. Do this once, in the shared `poll_and_download()` function (used by both `generate` and `poll`), right after the existing `mkdir -p "$out_dir"` — e.g. `out_dir=$(cd "$out_dir" && pwd)` (portable bash builtins only, no new dependency, matches the curl+jq-only constraint). If the directory can't be created or entered (bad path, permissions), fail clearly (non-zero exit, actionable message) instead of silently proceeding with a wrong or empty path.
- `ofox-video-core/SKILL.md`: add an explicit instruction that the calling agent must state the full `VIDEO_PATH` as its own clear, standalone line in the reply to the user (not buried inside a paragraph) — since the file's location is the actual deliverable. Bump `metadata.version` (1.0.1 -> 1.0.2, bug fix, per `CONTRIBUTING.md`'s bump-on-every-change rule).
- `.trellis/spec/skills/index.md`: add a Quality Check bullet generalizing this — any skill in this repo that writes a file to disk must guarantee and prominently report an absolute path, not rely on the caller/user inferring cwd. This is for future scenario skills (anime-drama, product-video, etc.) so they don't repeat the same gap.
- Do not change the default output location itself (stays `$PWD`) and do not touch the two scenario skills' own files unless review surfaces something that actually needs it (they delegate to `ofox-video-core` and already say to report the script's printed values verbatim, so the fix should propagate through without edits there — verify this assumption during check, don't assume it).

## Acceptance Criteria

- [ ] Running `generate`/`poll` with no `--out-dir` (default `$PWD`) prints an absolute `VIDEO_PATH` (trivially true today, but must remain true and be explicitly verified).
- [ ] Running with a relative `--out-dir` (e.g. `--out-dir .` or `--out-dir some/subdir`) prints an absolute, resolved `VIDEO_PATH` — this is the actual bug being fixed, verify it changes behavior from before the fix.
- [ ] An unwritable/uncreatable `--out-dir` (e.g. a path under a directory without write permission) fails with a clear, actionable error and a non-zero exit — not a silent wrong path.
- [ ] `bash -n` and `shellcheck` pass on the modified script.
- [ ] No Chinese/CJK text introduced anywhere.
- [ ] `ofox-video-core`'s `metadata.version` bumped.

## Definition of Done

- Fix implemented, checked, and verified with real (free — no new billable job needed; can reuse an already-completed job id via `poll` the same way the previous bug fix was verified, or verify purely via local path-resolution tests plus `bash -n`/`shellcheck`, since this bug doesn't require hitting the real API to prove — the download path logic can be exercised with local/synthetic inputs).
- No git commit yet — that's a separate confirmation step after the check pass, same as the previous task.

## Out of Scope

- Changing the default output location from `$PWD` to a fixed global folder (explicitly decided against, for now).
- Any change to the two scenario skills beyond verifying (not assuming) that no change is needed there.
- Any new scenario skills (anime-drama, product-video, etc.) — separate future task.

## Technical Notes

- Prior task: `.trellis/tasks/archive/2026-08/08-29-seedance2-5-skills/` (archived) — built the three skills this fix applies to.
- Relevant spec: `.trellis/spec/skills/index.md`, `.trellis/spec/skills/external-api-integration.md` (the no-resubmit and don't-trust-docs-blindly patterns from the prior task; this task's lesson is a new, distinct one — "always report absolute paths for on-disk output" — and should be added to `index.md`'s checklist rather than duplicated into `external-api-integration.md`, which is scoped to billable-API-specific gotchas).
- `CONTRIBUTING.md` (repo root) — quality bar, version-bump rule.
