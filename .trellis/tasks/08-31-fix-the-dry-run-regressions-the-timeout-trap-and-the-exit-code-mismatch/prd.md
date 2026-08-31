# Fix the dry-run regressions, the timeout trap, and the exit-code mismatch

## Goal

A second independent role-play review — a sub-agent given only the SKILL.md
files, told nothing about the previous round — confirmed the eight defects
fixed last task are gone, and found twelve more. Three of those were
**introduced by that fix**. One (the timeout trap) is the most serious defect
found in this line of work so far, and it was invisible to me because I have
been manually overriding the very default that triggers it.

## What I already know

Every claim below re-verified by direct execution before writing this.

### Introduced by the previous task's `--dry-run` work

| # | Defect | Measured |
|---|---|---|
| B1 | `batch --dry-run` prints **two** `Estimated cost:` lines | Second is the inner `cmd_generate --dry-run` leaking `~$0.88` on stderr — the per-take figure both SKILL.md files explicitly say not to quote. The same doc promises "exactly one line". |
| B3 | Dry runs claim "Actual billing is reported below" | Nothing follows; the script stops. An agent relays this verbatim. |
| C2 | `--dry-run` still requires `OFOX_API_KEY` | `check_api_key` runs before the dry-run branch. It sends no authenticated request, so a user without a key cannot even be quoted a price — contradicting the repo's own fail-open-on-missing-key rule. |

### Pre-existing

| # | Defect | Measured |
|---|---|---|
| A1 | **The timeout trap.** `DEFAULT_MAX_WAIT=540`, so one `generate` can block 9 minutes. Claude Code's Bash tool defaults to 120s and caps at 600s. `batch --takes 4` is serial: worst case 4 x 540 = 36 min, which **cannot fit in any single tool call**. | Hitting the tool timeout lands in the exact worst state core SKILL.md describes: job created and billable, job id never printed. The docs describe that state without naming the one action that avoids it. |
| A2 | `--dry-run` doesn't validate `--out-dir` | A bad path exits 0 under dry-run, then costs a real job before failing with exit 6. Docs claim a dry run "catches a bad parameter for free". |
| A3 | `check` exits **1** with no key | The exit-code table defines 1 as "usage/parameter error — fix the flag and retry freely" and 2 as environment error. An agent following the table reads a missing key as a bad flag. |
| C1 | `batch` never prints a seed | Four takes differ only by an unprinted random seed, so "take 3 was best, render that one properly" — the single most natural follow-up — is impossible. Both SKILL.md files recommend exactly that workflow. |

### Information gaps

- **D1** Scenario skills point at `api-params.md` for the exit-code table; that
  file only has the `error.code` table. The exit codes live in core SKILL.md.
- **D2** Scenario skills never say to hand the user the `CONTACT_SHEET` path —
  the one artifact the whole "pick one" flow exists to produce.
- **D3** Nothing says to show the user the prompt before spending. They are
  paying for that prompt, not for the parameters.
- **D4** No duration expectation anywhere, so an agent cannot say "this takes
  about three minutes".

### Verified clean (checked, not assumed)

Chinese-dialogue language handling, `--out-dir` propagation through `batch`,
absolute `VIDEO_PATH`, estimate-vs-bill separation, real rates, both upstreams
priced identically, the real-person `chain` limitation, and the no-resubmit
rule (exit 4 vs 5).

## Decisions (mine)

- **A1 is fixed by decoupling submit from wait, not by tuning a number.** Add
  a `create` subcommand that submits and returns the job id immediately, in
  seconds. `poll` already exists. Then a caller with a short timeout does
  `create` → `poll` → `poll`, and a tool timeout can never strand a job whose
  id was never printed. `generate` stays as the one-shot convenience for
  callers that can wait, with its time budget documented.
- **`batch` gets the same escape**: document that its worst case is
  `takes x max-wait` and that `--max-wait` is the lever, plus the
  `create`-per-take alternative for long runs.
- **C1 is fixed by generating the seeds ourselves.** When `batch` isn't given
  a `--seed`, generate one per take, pass it explicitly, and print it. That
  turns "render take 3 properly" into a real, reproducible command instead of
  a reroll — the seed becomes the handle the workflow was always assuming.
- **B1 is fixed by capturing the inner call's stderr** and only surfacing it
  on failure. Reusing `cmd_generate` for validation is right; leaking its
  narration is not.
- **A3**: `check` returns 2 for a missing key/binary. It is an environment
  check; that is what 2 means.
- **D3 is a real product point, not a doc nit.** The user is paying for the
  prompt. Scenario skills will require showing it alongside the quote.

## Requirements

1. `create` subcommand: submit, print `JOB_ID`/`POLLING_URL`, exit. No polling.
2. `batch --dry-run` prints exactly one `Estimated cost:` line; inner
   validation errors still surface.
3. Estimate wording under `--dry-run` doesn't promise a bill that never comes.
4. `--dry-run` works with no `OFOX_API_KEY`.
5. `--dry-run` validates `--out-dir` (create/enter it) like a real run.
6. `check` exits 2 on a missing binary or key.
7. `batch` assigns and prints a per-take seed when none is given; the `TAKE`
   line carries it, and the summary says how to re-render one take.
8. Docs: the timeout budget and the `create`→`poll` pattern; expected
   durations; exit codes reachable from the scenario skills; `CONTACT_SHEET`
   delivery; showing the prompt before spending.
9. Tests, free by construction.

## Acceptance Criteria

- [x] `create` submits and returns a job id without polling — **verified live**
      ($0.08, approved): returned in **1.9 seconds** against `generate`'s
      540-second worst case; `poll` then retrieved the video and billed $0.08
      exactly as estimated
- [x] `batch --dry-run` prints exactly one estimate line (the total); a bad
      parameter still reports its reason
- [x] No dry-run output promises billing "below"
- [x] `--dry-run` succeeds with `OFOX_API_KEY` unset, on all three subcommands
- [x] A bad `--out-dir` fails under `--dry-run` with exit 6, before any spend
- [x] `check` exits 2 with no key
- [x] `batch` prints `seed=N` per take, and the summary shows the re-render
      command
- [x] Scenario skills cover exit codes, contact-sheet delivery, prompt review,
      timeouts and durations
- [x] Existing suites green; shellcheck clean; zero CJK

## Verification

| Check | Result |
|---|---|
| create tests | 17/17 (new) |
| dryrun / chain / pricing / provider / batch / validation | 19 / 18 / 17 / 27 / 21 / 36 |
| image validation | 18/18 |
| cloudflare-drop | 57/57 |
| shellcheck | zero warnings |
| Live `create` → `poll` | 1.9s to job id; video retrieved; $0.08 billed = estimate |
| Total spend | $0.08 |

## Found by the live run itself

`create` echoed `--out-dir` back verbatim, so a relative path stayed relative
— and the `poll` command it prints as the next step carried that same relative
path. Since the entire point of `create` is that the follow-up happens as a
separate call, possibly from another working directory, that path either
downloads somewhere unexpected or fails. Fixed to resolve before reporting,
matching `VIDEO_PATH` and `CONTACT_SHEET`.

Also re-confirmed under real failure: the poll hit a `curl 35` mid-flight and
retried the **poll**, not the create.

## Why the timeout trap survived four rounds of work

Every real generation in this project was run with a manually raised tool
timeout. The default path — 120s tool limit against a 540s script budget —
was never exercised from the inside, so the collision was invisible to the
author while being the first thing a fresh consumer would hit.

The general form is in the spec: **an option you set every single time you use
your own tool is where a bug will hide**, because your usage never tests the
default.

## Definition of Done

- All criteria checked; CHANGELOG entries; version bumps
- Committed locally on the dev branch, not pushed

## Out of Scope

- Publishing; the `main` branch stays at the previously published state
- Reworking `generate` into `create`+`poll` internally — `generate` keeps
  working exactly as it does

## Technical Notes

- Found by a second sub-agent role-play, restricted to zero-cost commands and
  deliberately told nothing about the prior round. It read the dry-run flow
  out of the docs unprompted, which is the evidence the last fix landed.
- The timeout trap is a case of the author not seeing their own tool's
  defaults: every real run in this project was made with a manually raised
  timeout, so the default path was never exercised.
