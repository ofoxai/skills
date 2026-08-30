# Install OpenCode CLI and verify scenario skill runs

## Goal

Close the last open item from §5.5's test matrix (see the prior task
`08-30-complete-mvp-test-coverage-for-4-scenario-skills`, archived): run one
scenario skill inside OpenCode via natural-language trigger, the same way
it was already verified for Codex CLI. OpenCode was not installed locally
last time, so this was deliberately left as a known gap — closing it now
fully completes the "4 scenario skills meet the doc's own quality bar" MVP.

## What I already know

- OpenCode is `opencode-ai` on npm (bin: `opencode`) / `opencode` on
  Homebrew (formula description: "AI coding agent, built for the
  terminal", https://opencode.ai) — confirmed both point to the same tool.
- `codex` and `claude` CLIs on this machine are both installed as global
  npm packages under an fnm-managed Node (paths under
  `~/.local/state/fnm_multishells/.../bin/`), not via Homebrew — installing
  OpenCode the same way (`pnpm add -g opencode-ai`, per this user's stated
  pnpm preference for Node tooling) keeps the install method consistent.
- Established test method (already used for Codex, same risk profile):
  symlink `ofox-video-core` and `seedance-short-drama` into wherever
  OpenCode looks for user skills, run it non-interactively with
  `OFOX_API_KEY` unset, and confirm it discovers both `SKILL.md` files from
  the natural-language prompt alone (not relying on `metadata.openclaw`,
  since §5.5 item 5 specifically calls out that Codex/OpenCode only parse
  frontmatter name+description), builds a prompt, and stops cleanly asking
  for the missing key. This makes the whole test $0 / no real network call
  reaches the Ofox API, consistent with the prior task's safety approach.
- OpenCode's on-disk skill directory convention is not yet confirmed (need
  to check its docs/config or the installed tool itself: likely something
  like `~/.config/opencode/skills/` or an `AGENTS.md`-adjacent convention,
  Codex used `~/.codex/skills/<name>/SKILL.md`).

## Requirements

- Install OpenCode CLI locally.
- Determine where OpenCode expects user-installed skills.
- Symlink `ofox-video-core` + `seedance-short-drama` there.
- Run OpenCode non-interactively (or the closest equivalent it supports)
  with `OFOX_API_KEY` unset, prompt matching the short-drama trigger
  phrasing, and observe whether it finds/uses the skill correctly.
- Update the `seedance-skills-project-scope` memory to reflect OpenCode
  now verified (closing the last known gap from the prior task).
- If OpenCode's skill-loading turns out to need something the SKILL.md
  doesn't currently provide (e.g., a different manifest format), record
  that as a real finding — this is genuinely new information, not a
  known gotcha to just look up.

## Acceptance Criteria

- [x] OpenCode CLI installed and runnable (`opencode --version` ->
      1.18.25). Installed via `pnpm add -g opencode-ai`; pnpm blocks
      postinstall scripts by default, ran `node postinstall.mjs` manually
      once to complete setup (matches how `codex`/`claude` are installed
      on this machine — global npm/pnpm packages, not Homebrew).
- [x] `seedance-short-drama` (+ `ofox-video-core`) confirmed discoverable
      and actionable by OpenCode via natural-language trigger, at $0 cost.
      OpenCode reads skills from `~/.claude/skills/` (confirmed via
      `opencode debug skill`, alongside `~/.agents/skills/` and
      project-local `.claude/skills/`) — symlinked both skills there,
      `opencode debug skill` listed them immediately. `opencode run
      "generate scene 3..."` (no `OFOX_API_KEY` set) correctly loaded both
      SKILL.md files, read `pricing.md`, ran the `check` subcommand,
      computed the same $3.60 estimate Codex produced independently, and
      stopped asking for the missing key and the missing script text — no
      real Ofox API call made.
- [x] Memory updated to close out the OpenCode gap

## Out of Scope

- Any real paid API call (not needed to verify skill-discovery/trigger
  behavior, per the same reasoning used for the Codex test)
- npm/four-directory publish, 5th scenario skill — unrelated, still
  deferred per existing decisions

## Technical Notes

- Prior task/PRD: `.trellis/tasks/archive/2026-08/08-30-complete-mvp-test-coverage-for-4-scenario-skills/prd.md`
- Memory: `seedance-skills-project-scope.md`
