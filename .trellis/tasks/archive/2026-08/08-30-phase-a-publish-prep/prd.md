# Phase A: ClawHub metadata, per-agent install commands, upstream compatibility notes

## Goal

Close three documentation-only gaps identified in a gap analysis against the source plan (`2026-08-28_GitHub两类仓库操作手册.md`, not committed) §5.3/§5.5/§5.6/§3.3, ahead of any actual publish action (GitHub push, npm, ClawHub, LobeHub — all deferred to a separate future decision, not this task). Pure documentation/frontmatter changes across the 6 already-shipped skills — no script logic changes, no real API calls needed.

## What I already know

- Current skills: `ofox-video-core` (v1.1.1), `ofox-image-core` (v1.0.2), `seedance-short-drama` (v1.0.1), `seedance-ad-creative` (v1.0.2), `seedance-product-video` (v1.0.0), `seedance-anime-drama` (v1.0.0).
- None of the 6 `SKILL.md` files currently declare `metadata.openclaw` or `homepage` at all (verified via grep — zero matches).
- `README.md`'s Install section currently lists one bare `npx skills add ofoxai/skills@<name>` line per skill, with no `--agent` variants and no note about key reuse across agents.
- Source plan quotes (exact, for reference):
  - §5.3 item 1: "frontmatter：name、description（写清楚场景关键词，agent 靠这个决定要不要触发）、metadata 里声明依赖 curl 和 jq、环境变量 `OFOX_API_KEY`"
  - §5.6 (ClawHub bullet): "脚本里用到的每个环境变量、每个命令行工具，frontmatter 的 `metadata.openclaw.requires` 里都声明了。脚本用了 `OFOX_API_KEY`、curl、jq，frontmatter 就必须写 `requires.env: [OFOX_API_KEY]`、`requires.bins: [curl, jq]`。少一个就标'元数据不匹配'。" ... "frontmatter 有 `homepage`，指向仓库地址。没有会降信任分。"
  - §5.5: README install commands example: `npx skills add ofoxai/skills@seedance-short-drama --agent claude-code` (and `--agent codex`, `--agent opencode`, `--agent '*'`), plus: "已经用 ofox key 跑 Codex / Claude Code / Cline 的用户，装这个 skill 不需要新 key，同一个 key 直接出视频。"
  - §3.3 item 2: "兼容上游。不和 LeoYeAI、seedance-tvc-director 这些抢导演层，而是接它们的输出。SKILL.md 里写明：可以先用 LeoYeAI/seedance-skills 或 seedance-2-5-video-director 写提示词，再用 ofox skill 执行。"
- `CONTRIBUTING.md`'s own frontmatter template does NOT currently mention `metadata.openclaw` or `homepage` — this task adds fields beyond what `CONTRIBUTING.md` itself documents as required. Consider whether `CONTRIBUTING.md` should be updated too so this isn't a one-off addition future skills forget (use judgment, but don't skip this — a repo-wide standard should live in the repo-wide standard doc).

## Requirements

1. **`metadata.openclaw` + `homepage`** added to all 6 `SKILL.md` frontmatters:
   - `metadata.openclaw.requires.env`: the actual env vars each skill's underlying script needs (all 6 need `OFOX_API_KEY`, whether directly or via the core skill they delegate to — check each one's actual dependency rather than copy-pasting blindly).
   - `metadata.openclaw.requires.bins`: `curl`, `jq` for all 6 (verify against each skill's actual script/delegation).
   - `homepage`: pointing at the skill's own directory in the repo, e.g. `https://github.com/ofoxai/skills/tree/main/skills/<name>` — verify this is the right convention (check `CONTRIBUTING.md` for any existing convention on repo URLs, and check whether `hal-vault`/`hal-image`/`cloudflare-drop` already have a `homepage` field to match, or if this is new to the repo entirely).
   - Update `CONTRIBUTING.md`'s frontmatter template/checklist to include `metadata.openclaw.requires` and `homepage` as required fields going forward, so this doesn't silently regress on the next new skill. Decide whether to also retrofit `hal-vault`/`hal-image`/`cloudflare-drop` with these fields for consistency (recommend yes, for a uniform quality bar, but flag it as a call to make — check if it's reasonable in scope for this task or should be a one-line follow-up note instead).
   - Bump each touched skill's `metadata.version` (patch-level, per `CONTRIBUTING.md`'s bump-on-every-change rule).

2. **README.md install section**: add the `--agent claude-code` / `--agent codex` / `--agent opencode` / `--agent '*'` pattern. Scope: at minimum, the 4 user-facing scenario skills (`seedance-short-drama`, `seedance-ad-creative`, `seedance-product-video`, `seedance-anime-drama`) should show the full 4-variant pattern, since these are the skills an end user installs directly; use judgment on whether to also expand it for the 3 pre-existing skills (`hal-vault`/`hal-image`/`cloudflare-drop`) and the 2 core/library skills (`ofox-video-core`/`ofox-image-core`, which are typically pulled in by a scenario skill rather than installed standalone — a brief note saying so is more useful than a full 4-line block for those two). Avoid mechanically repeating 4 lines × 9 skills if that makes the README unreadable — find a layout that's both complete and legible (e.g. show the full pattern once with a placeholder skill name, then a compact list of just the skill names it applies to, plus the standalone core-skill note). Add the source plan's exact key-reuse sentence (adapted to this repo's actual skill names): "already running Codex / Claude Code / Cline with an Ofox key configured? installing one of these skills doesn't need a new key — the same key generates video/images immediately."

3. **Upstream compatibility note**: add a short section to `skills/ofox-video-core/SKILL.md` (the execution layer any prompt ultimately flows through) noting compatibility with prompt-writing "director" skills already popular for Seedance (name at least `LeoYeAI/seedance-skills` and `liyue-aigc/seedance-2-5-video-director`, per the source plan) — if a user already has a well-crafted prompt from one of those tools, they can call `ofox-video.sh generate` directly with it, skipping this repo's own scenario-specific prompt-crafting steps. Keep this framed as complementary, not competitive (matching the source plan's own framing: "不和...抢导演层，而是接它们的输出"). **Do not** open any actual PR against those external repos as part of this task — that's a separate, explicit-confirmation-required action the source plan itself notes as manual work (§5.8: "自己动手的：...PR review"), and is out of scope here.

## Acceptance Criteria

- [ ] All 6 `SKILL.md` files have accurate `metadata.openclaw.requires.env`/`requires.bins` and a `homepage` field.
- [ ] `CONTRIBUTING.md` documents these as required fields for future skills.
- [ ] `README.md`'s Install section shows the per-agent pattern clearly and completely without becoming unreadable, plus the key-reuse note.
- [ ] `ofox-video-core/SKILL.md` has the upstream-compatibility note.
- [ ] No Chinese/CJK text introduced anywhere.
- [ ] Version bumps applied consistently.
- [ ] No actual external action taken (no PR opened against third-party repos, no push, no publish) — pure local documentation changes.

## Definition of Done

- Passes `CONTRIBUTING.md`'s quality bar (the updated version of it).
- Committed locally (not pushed) — same as every prior task in this line of work.

## Out of Scope

- Actually pushing to GitHub, publishing to npm/ClawHub/LobeHub, or opening PRs against external repos — all separate, explicit-confirmation-required decisions per the source plan's own "自己动手" list, tracked as later phases (Phase B/C in this session's plan, not this task).
- Real cross-agent testing (Codex CLI, OpenCode) and the real `npx`-install test — these are blocked on a GitHub push happening first (`npx skills add` pulls from the remote), tracked separately.
- Any of the deeper §3.3 feature gaps (batch/gacha cost tracking, multi-model fallback, v2v/stitching, more scenarios) — separate future work, not documentation-only.

## Technical Notes

- No real API calls needed for this task — pure frontmatter/README/CONTRIBUTING.md edits. `bash -n`/`shellcheck` don't apply (no scripts touched) unless a script file is modified for some reason (it shouldn't be).
- Read `skills/cloudflare-drop/SKILL.md` and the other two pre-existing skills to check whether any convention for `homepage`-equivalent already exists before inventing one.
