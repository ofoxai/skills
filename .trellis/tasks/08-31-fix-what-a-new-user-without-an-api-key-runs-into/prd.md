# Fix what a new user without an API key runs into

## Goal

A third role-play — this time a **non-programmer with no Ofox account, no API
key, and an explicit fear of an accidental bill** — walked the whole journey
from "I want to try this" to "what did that cost me". The previous two reviews
played competent agents reading SKILL.md; this one played the actual first
customer, starting at the README.

The finding that matters most is not a bug. It is that **the single strongest
thing this repo can offer an anxious new user already works, and nothing tells
them it exists.**

## What I already know

All four verified by direct inspection before writing this.

### The buried headline: you can get a real quote with no account at all

`--dry-run`, `models` and `providers` all work with `OFOX_API_KEY` unset —
confirmed by running them under `env -u OFOX_API_KEY`. So someone who has not
signed up can price a 15-second shot, compare 480p against 1080p, and cost out
a four-take batch, for free, before deciding whether to register.

Nothing says so:

- README mentions `dry-run` **0 times**
- `ofox-video-core/SKILL.md` has a whole section on `--dry-run` framed as
  "quote before spending" and states **0 times** that it needs no key
- the *Availability check* section implies the opposite order — run `check`
  first, and if it fails, go get a key. An agent following it pushes the user
  to a signup form in the first minute.
- The one place it is stated correctly is a source comment at
  `ofox-video.sh:433` ("safe before signing up"), which neither the user nor
  the agent ever sees.

### The README is written for people who already have a key

Measured against `README.md`: `app.ofox.ai` appears **0 times**, price figures
**0 times**, `curl`/`jq` **0 times**. Its only substantive mention of
`OFOX_API_KEY` opens "Already running Codex / Claude Code / Cline with an Ofox
key configured?" — addressed to someone who has one.

A reader with no account finishes the README believing installation is all
there is, and first learns otherwise from `check` — a command the README also
never mentions.

(The `check` error message itself is good: signup URL, menu path, `export`
line, and a note that the key is shown once. The README is what fails here.)

### A promise the repo cannot keep

README line 40 says a scenario skill "pulls in the one(s) it needs
automatically". But:

- `skills.sh.json` has only `$schema` and `groupings`. The live skills.sh
  schema is `additionalProperties: false` — **there is no dependency field to
  declare one in.**
- `seedance-short-drama`'s `metadata.openclaw.requires` declares `env` and
  `bins` only; nothing names `ofox-video-core`.

Every runnable command in the scenario skills is
`bash ../ofox-video-core/references/ofox-video.sh …`, which only resolves if
both skill directories sit side by side. If the single-skill install does not
in fact bring the core along, the user sees:

```
bash: ../ofox-video-core/references/ofox-video.sh: No such file or directory
```

That message contains no mention of a skill, does not name what is missing,
and does not say what to install. A non-programmer reads it as "this is
broken" and stops. This was the one point the reviewer flagged as likely to
end the journey outright.

### `models` leads with a price that is wrong for the default

`models` prints `BASE $/s` — for `bytedance/seedance-2.5` that is `0.11`,
which is its **480p** rate, while the skill defaults to 720p at **$0.24**.
The reviewer's persona did exactly what a person does: multiplied 0.11 by 15,
got $1.65, and was off by 118%.

`pricing.md` already warns never to quote this field. So the repo knows the
number misleads — and still shows it as the largest, first number a new user
meets. The three lines of English fine print under the table read as a footer.

### `check` reports presence as if it were validity

`OFOX_API_KEY=sk-not-a-real-key bash ofox-video.sh check` prints
`OK: curl, jq, and OFOX_API_KEY are all present.` and exits 0. The wording is
accurate (*present*, not *valid*) but a new user reads "OK" as "I'm set up",
then hits an auth error on their first real run having just been told the
environment was fine. Not a money risk — a confidence risk.

## Decisions (mine)

- **Lead the README with the free path.** "Price it before you sign up" is the
  best first impression this repo has for the exact reader most likely to
  bounce. It goes near the top, with a runnable command, not in a footnote.
- **Say plainly that this is a paid API**, roughly what a clip costs, and that
  `curl`/`jq` are needed. Withholding that until `check` is not a kindness.
- **Stop promising automatic dependency resolution.** There is no field to
  express it in, so the honest fix is to change the sentence and recommend
  installing the repo rather than a single scenario skill — plus a named
  troubleshooting entry so the raw path error is recognisable.
- **`models` shows the price for each model's own default resolution**, since
  that is the rate a caller who doesn't pass `--resolution` will actually pay.
  The column gets labelled with the resolution it refers to.
- **`check` distinguishes present from valid** in its own wording, and points
  at the free `--dry-run` path for anyone who doesn't have a key yet.

## Requirements

1. README: a "try it before you sign up" section with a real command; a plain
   statement that this is a paid API with an order-of-magnitude cost; `curl`/
   `jq` prerequisites; a link to `app.ofox.ai`.
2. README: correct the dependency sentence; recommend the whole-repo install
   for scenario skills.
3. `ofox-video-core/SKILL.md`: state that `--dry-run`/`models`/`providers`
   need no key, and reorder the availability-check guidance so a keyless user
   is quoted first and pointed at signup second.
4. Scenario skills: same keyless-quote note, plus a troubleshooting entry for
   the `No such file or directory` path error naming the missing skill.
5. `models`: report each model's default-resolution rate, with the column
   labelled accordingly.
6. `check`: wording that separates presence from validity, and names the
   keyless path.
7. Tests, free by construction.

## Acceptance Criteria

- [x] README states the paid-API fact, cost figures ($3.60 / $0.44),
      prerequisites, the signup link, and a runnable keyless quote
- [x] README no longer claims automatic dependency resolution, and names the
      path error that results from a single-skill install
- [x] `grep -c 'dry-run' README.md` > 0 (was 0)
- [x] `models` labels its price column `$/s AT DEFAULT` and shows
      seedance-2.5 at **0.24**, not the misleading 0.11
- [x] `check` says the key is present but unverified, and a keyless `check`
      names the three commands that still work
- [x] All four scenario skills carry the keyless section and the path-error
      entry
- [x] Existing suites green; shellcheck clean; zero CJK

## Verification

| Check | Result |
|---|---|
| newuser tests | 22/22 (new) |
| create / dryrun / chain / pricing / provider / batch / validation | 17 / 19 / 18 / 17 / 27 / 21 / 36 |
| image validation | 18/18 |
| shellcheck | zero warnings |
| Total spend | $0.00 — every fix was verifiable for free |

Before/after on the numbers that mattered:

| | Before | After |
|---|---|---|
| README mentions of `dry-run` | 0 | present, with a runnable command |
| README mentions of `app.ofox.ai` | 0 | in the signup step |
| README price figures | 0 | $3.60 / $0.44 |
| README `curl`/`jq` | 0 | a prerequisites line |
| `models` rate for seedance-2.5 | 0.11 (480p, misleading) | 0.24 (its 720p default) |

## Two bugs in my own test, found while running it

The suite initially failed on things that were already correct:

- `REPO` resolved one directory short (`skills/` instead of the repo root), so
  every README assertion read a file that wasn't there.
- The `check` assertion grepped for `not verif` while the output said "has NOT
  been verified" — the word *been* in between.

Both were test defects, not product ones. Worth noting because a red test that
is itself wrong costs the same debugging time as a real failure, and briefly
looks like the feature is broken.

## The finding that was not a bug

The most valuable result was that the best capability for this reader already
worked and was undiscoverable. Placement of a blocker-removing feature is a
product decision, not a docs detail — recorded in the spec, along with the
rule that a warning in one document ("never quote this field") does not
neutralise a misleading display in another.

## Definition of Done

- All criteria checked; CHANGELOG entries; version bumps
- Committed locally on the dev branch, not pushed

## Out of Scope

- Publishing; `main` stays where it is
- Making the single-skill install actually resolve dependencies — no field
  exists for it; this task fixes the promise, not the packaging

## Technical Notes

- Full transcript and the ten observations:
  `scratchpad/new-user-journey.md` (published as an artifact for review)
- The reviewer ran only zero-cost commands and spent $0.00
