# Complete MVP test coverage for 4 scenario skills

## Goal

The 4 shipped scenario skills (`seedance-short-drama`, `seedance-ad-creative`,
`seedance-product-video`, `seedance-anime-drama`) and their 2 shared core
skills (`ofox-video-core`, `ofox-image-core`) have only been verified on the
happy path (real paid generation succeeds). The source task doc
(`2026-08-28_GitHub两类仓库操作手册.md` §5.5) requires 5 test items before a
skill can merge to main; items 3, 4, 5 have never been exercised. This task
closes that gap. **npm packaging and the four-directory publish (skills.sh /
LobeHub / ClawHub) are explicitly out of scope** — user decided to defer
those and keep this task scoped to raising the 4 already-built skills to the
doc's own quality bar.

## What I already know

- §5.5 test items and current status:
  1. `npx` install to local Claude Code — done (informal, during prior real-call testing)
  2. Natural-language trigger → real paid generation — done for all 4 scenarios (memory: seedance-skills-project-scope.md)
  3. Deliberately-wrong params → clear error — **not verified end-to-end**
  4. Install on a jq-less machine → correct install prompt — **not verified**
  5. Run in Claude Code + Codex CLI + OpenCode, each at least once — **only Claude Code verified**
- `ofox-video.sh` already has the plumbing item 3/4 need: `check_curl_jq()`
  checks curl/jq/OFOX_API_KEY and prints actionable install instructions
  (exit code 2, no network call); parameter validation happens before any
  network call (exit code 1, per the script's own documented exit-code
  contract at the top of the file). A `check` subcommand exists as a
  standalone doctor command. `ofox-image.sh` (527 lines) is the image-core
  equivalent, structure not yet inspected line-by-line.
- SKILL.md bodies already restate `OFOX_API_KEY`/curl/jq requirements in
  plain prose (not just frontmatter `metadata.openclaw`), which is exactly
  what §5.5 item 5 requires for Codex/OpenCode (they only parse frontmatter
  name+description, not metadata) — confirmed by reading
  `seedance-short-drama/SKILL.md` and `ofox-video-core/SKILL.md`.
- Local environment: `codex` CLI installed, `claude` CLI installed,
  `opencode` **not installed**, `jq` installed via Homebrew, `docker`
  available (can simulate a jq-less machine in a clean container).
- No existing `scripts/validate-skills.mjs` or CI in the repo yet (doc
  mentions it in §8 as multi-person-collab tooling, not part of the §7
  two-week acceptance line — out of scope here).
- Prior incident (memory): a forked sub-agent, given loose instructions,
  made an unauthorized real paid API call ($0.96). Any real network call in
  this task must happen in the main session, with the user told beforehand
  what it is and what it costs (if anything) — never delegated to a
  sub-agent that could re-run it unsupervised.

## Assumptions (temporary)

- Item 3 (bad params) can be fully covered by client-side validation cases
  (rejected before any network call, so genuinely free) plus, if useful,
  one case that passes client-side validation but gets rejected by the
  server with a 400 (a rejected job is never created, so per the doc's
  billing model this should also be $0 — but it is still a real network
  call using the real API key, so it will be called out explicitly before
  running).
- Item 4 (jq-less machine) can be simulated with a Docker container
  (e.g. plain `bash` or `ubuntu` image with `curl` but no `jq`) rather than
  needing a second physical machine.
- Testing the two core scripts (`ofox-video.sh`, `ofox-image.sh`) directly
  covers items 3/4 for all 4 scenario skills, since every scenario skill
  delegates execution to one of these two scripts rather than
  reimplementing validation. Per-scenario work for item 3/4 is limited to
  confirming each scenario's SKILL.md correctly instructs the agent to
  surface the core script's error output, not re-deriving validation logic
  per scenario.
- Item 5 or item 3/4 that turn up a real bug get fixed as part of this task
  (same pattern as the earlier ARG_MAX bug found during real testing) —
  this task is not pure test-writing, it includes any fix the tests surface.

## Open Questions

(none — both resolved below)

## Decisions (from user)

- **OpenCode**: skip live verification this round. OpenCode is not
  installed locally; SKILL.md bodies already state what OpenCode needs
  (env/bins in plain prose, not just frontmatter), so this is recorded as
  a known, deliberate gap rather than blocking the task. Install + live
  test deferred to whenever OpenCode is actually set up.
- **Server-side-rejection call**: allowed in the main session, but only
  after telling the user exactly which call is about to run and why it is
  confirmed to cost $0 (rejected before job creation) — never delegated to
  a sub-agent.

## Requirements (evolving)

- Verify `ofox-video.sh check` and equivalent dependency checks in
  `ofox-image.sh` correctly detect missing `jq` and print the documented
  install guidance, in a jq-less environment (Docker container).
- Verify at least 2-3 deliberately-invalid parameter combinations against
  both `ofox-video.sh` and `ofox-image.sh` produce clear, actionable error
  output, ideally without any network call (exit code 1 path).
- Run at least one real invocation of a scenario skill (natural-language
  trigger, not just direct script call) inside Codex CLI, to confirm the
  SKILL.md body alone (without relying on `metadata.openclaw`) gives Codex
  enough to work correctly.
- Resolve the OpenCode question above and act on the answer (install +
  test, or explicitly document as a known gap).
- Fix any real bug the above testing surfaces (in the relevant skill's
  script or SKILL.md), following the existing pattern of logging any new
  gotcha into `.trellis/spec/skills/external-api-integration.md`.
- Update `seedance-skills-project-scope.md` memory with the new
  test-coverage state once this task completes.

## Acceptance Criteria

- [x] `ofox-video.sh` and `ofox-image.sh` both fail cleanly with actionable
      output when `jq` is missing (tested via a PATH-sandboxed shell with
      curl but no jq — Docker daemon wasn't running locally, so a symlink
      farm PATH sandbox was used instead; equivalent coverage: `command -v
      jq` is what the script actually checks). Both `check` (exit 1) and
      `generate` (exit 2, per the documented exit-code contract) verified.
- [x] `ofox-video.sh` and `ofox-image.sh` both reject >=2 invalid parameter
      combinations each with clear error text, before making a network call
      where possible. Actually verified: 5 cases per script (missing
      required field, out-of-range/invalid enum values), all exit 1, all
      before any network call.
- [x] At least one scenario skill verified working end-to-end inside Codex
      CLI via natural-language trigger. `seedance-short-drama` +
      `ofox-video-core` symlinked into `~/.codex/skills/`, triggered via
      `codex exec` with no `OFOX_API_KEY` set: Codex discovered both
      SKILL.md files from the natural-language prompt alone, built the
      prompt, computed the cost estimate from pricing.md, ran the `check`
      subcommand, and stopped cleanly asking for the key — $0 cost, no
      network call reached the Ofox API.
- [x] OpenCode documented as a deliberate known gap (not installed this
      round) in memory / task notes — no live OpenCode test required
- [x] Any bug found during the above is fixed and, if it's a new
      non-obvious gotcha, recorded in
      `.trellis/spec/skills/external-api-integration.md`. **No bugs found**
      — all 5 test-matrix items passed cleanly on the first real run;
      nothing to fix, nothing new to log.
- [x] No npm publishing, no skills.sh/LobeHub/ClawHub submission actions
      taken as part of this task

### Bonus: real server-side rejection verified ($0 cost)

Beyond the required matrix, one real API call was made (with explicit
call-out beforehand, per the user's go-ahead): `ofox-video.sh generate
--model bytedance/does-not-exist-xyz ...`. This passes client-side
validation (the script does not restrict `--model` to a fixed list) and
hits the real API, which returned `HTTP 404` / `error.code:
model_not_found`. The script's `model_not_found` mapping matches real
behavior exactly, exit code 3 as documented, no job created, no charge.
This is the same class of "unverified assumption" that produced real bugs
in earlier sessions (e.g. the image API's error-shape assumption) — this
one held up.

## Definition of Done

- All acceptance criteria checked
- Any script changes committed with a clear message (no push)
- `seedance-skills-project-scope.md` memory updated to reflect real
  §5.5 test-coverage status (not just "shipped and paid-tested")

## Out of Scope

- npm package (`ofox-media-skills-cli`) creation or publish
- Submission to skills.sh / LobeHub / ClawHub
- Building the 5th+ scenario skill
- `scripts/validate-skills.mjs` / CI automation (§8, multi-person-collab
  tooling, not part of the §7 acceptance line)
- Multi-model fallback, batch cost stats, other previously-deferred V1 items

## Technical Notes

- Source task doc: `2026-08-28_GitHub两类仓库操作手册.md` (repo root,
  personal planning note, not committed to git) — §5.5 (test list), §5.6
  (publish threshold, not used here), §7 (two-week acceptance line)
- Prior state and lessons: memory `seedance-skills-project-scope.md`,
  `.trellis/spec/skills/external-api-integration.md`
- `skills/ofox-video-core/references/ofox-video.sh` (803 lines) — exit
  code contract at top: 1 = validation error (no network), 2 = env error
  (missing curl/jq/key)
- `skills/ofox-image-core/references/ofox-image.sh` (527 lines) — not yet
  inspected in detail, assume similar structure, verify during
  implementation
