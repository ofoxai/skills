# Changelog

All notable changes to the **ofox-image-core** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

## 1.10.3 — the link to the shared approval gate can miss without the file being gone

Docs only; no change to the script, the tests, the API calls or the billing.
This skill links `../ofox-video-core/references/approval-gate.md` three times.
That relative path resolves only when the core skill's directory is named
after the skill — true for skills.sh, ClawHub and `npx ofox-skills`, and
**false for LobeHub**, which unpacks each skill to
`~/.agents/skills/ofoxai-skills-<name>`. There the file sits under
`ofoxai-skills-ofox-video-core` and the link points at a name nothing uses.
This is the core-to-core half of the same breakage the four scenario skills
carry, and it was missing from the original file list.

"Before you spend" now says the link assumes a directory name, carries a probe
over the five known locations, and — the part that matters — states that a
link which does not resolve is **not** a reason to skip the gate: the rule is
the paragraph above it and the dry run below it either way, and only the
spec's detail travels with `ofox-video-core`.

The "four things a scenario skill must not re-implement" list keeps telling
scenario skills to link the gate rather than paraphrase it, and now adds that
the directory-name caveat travels with the link — a "Where the core skill
lives" probe near the top of a scenario skill is what stops that link reading
as a missing file.

## 1.10.2 — the changelog for 1.10.1 quoted the literal it had just removed

**Changelog text only; no change to the script, the tests, the API calls or
the billing.** The 1.10.1 entry below originally explained the scanner finding
by quoting the old test-fixture literal verbatim, so the published 1.10.1
still carried `suspicious.exposed_secret_literal`. ClawHub's stored scan report
(`clawhub scan download`, staticScan v2.4.26) placed it at `CHANGELOG.md:14`,
the line of the quote. A key-shaped string in prose explaining its own removal
is still a key-shaped string to the scanner.

- **The 1.10.1 entry is reworded in place** to describe the literal without
  reproducing it. This file ships in the bundle and is scanned like any other
  file; nothing key-shaped belongs in it, in any version's entry.
- **What this does *not* fix, and will not**: the same stored report carries a
  second static code for this skill, `suspicious.potential_exfiltration`, at
  `references/ofox-image.sh:302`, with the message that the script "base64-encodes
  a local file and sends it over the network". Line 302 is the decode helper: it
  turns the API's base64 *response* into the image file on disk. Nothing local
  is encoded on that path and nothing is sent. It is a false match on `base64`
  and `curl` sharing one script, and rewriting a correct decode to dodge an
  unpublished heuristic is the bet the 1.10.1 entry declined to make. It stays.
- **Also left alone**: the LLM review (skillSpector 2.3.5) rates the
  refusal-handling section of `references/api-params.md` HIGH for reporting
  that a prompt refused on one model passed unchanged on another. That section
  records a measured result with a bill attached; it stays as written. Expect
  the public page to keep showing `suspicious` for this skill on those two
  grounds — this entry says so rather than claiming otherwise.

## 1.10.1 — the fake key in the tests read as a real one to a scanner

**Test fixtures only; no change to the script, the API calls or the billing.**
ClawHub's public page for this skill showed `suspicious` at high confidence
after the 2026-09-08 publish. The machine reason was a single code —
`suspicious.exposed_secret_literal` from staticScan v2.4.26 — and it was
correct about the pattern even though it was wrong about the risk: every test
file opened by exporting `OFOX_API_KEY` with a 33-character hyphenated literal
written inline — one whose text says, in words, that it is not a real key. A
static scanner matches the shape of the assignment; it does not read the value
and take its word for it.

- **The literal now goes through a variable**, and the variable's name has no
  `KEY` in it: `PLACEHOLDER=placeholder` then `export OFOX_API_KEY="$PLACEHOLDER"`.
  What changed is the *pattern*, not the length — picking a shorter secret-ish
  string would have been betting on a threshold nobody published.
- ⚠️ **`newuser.test.sh` had a worse one.** Its "a present key is not a verified
  key" case set the variable inline to a joke value carrying the `sk-` prefix a
  real OpenAI-style key has — which is exactly what made the string funny and
  exactly what made it scan badly. Same treatment.
- **Nothing about the tests' meaning moved.** The scripts only require the
  variable to be non-empty; the "present but unverified" case only requires it
  to be set. All 4 test files in this skill still pass.
- **What this does *not* fix**: the LLM-written `security.summary` on the same
  verify call reads differently from the machine code — it talks about dotenv
  sourcing and redirectable endpoints. Those are design properties, argued for
  elsewhere in this file, and no reason code is attached to them. This entry
  claims the static-scan code only.

## 1.10.0 — a key the agent was forbidden to load, in a file the user had already pointed at

**Documentation and `check` output only; no change to how a request is built
or billed.** This one came out of a real session on Codex: the user was
asked to `export OFOX_API_KEY`, replied that it was already in `.env`, then
gave the absolute path, then said "just read it" — and was refused all three
times. Nothing was generated. The refusal was correct per the text: the safety
contract's first line read *"`OFOX_API_KEY` is read **only from the shell
environment** — never from a dotenv file"*, and the only reading available to
an agent is that it may not touch the file even on request.

- **The first safety-contract line is split in two, because it was describing
  two different actors in one sentence.** The script's constraint is real and
  stays hard: `ofox-image.sh` parses no dotenv, ever. The agent's constraint was
  collateral damage from sharing the sentence. It now reads separately: you may
  load the key from a dotenv file *once the user has authorized it*, via
  `set -a; . <path>; set +a` in the shell you'll call the script from.
  Authorization is still the precondition — this is not licence to go hunting
  for `.env` files nobody mentioned.
- **The missing-key recovery bullet now carries the same second path.** This is
  the part that actually mattered. An agent hitting a missing key reads the
  nearest instruction, not the contract twelve screens up, and that bullet said
  `export` and only `export`. Splitting the contract alone would have left the
  dead end exactly where it was.
- **`check`'s stderr gained one line for the same reason** — the terminal user
  who runs the script directly was getting the same single-path advice.
- ⚠️ **New warning, because sourcing a dotenv is not as narrow as it looks.**
  `set -a; . <path>; set +a` imports *every* variable in the file. One of them
  is `OFOX_API_BASE_URL`, which `ofox-image.sh` honours (`ofox-image.sh:144`) — a stray value
  there silently redirects every API call in the session to somewhere else.
  Read the file before you source it. The `.env` that prompted this entry
  contained exactly that variable.

## 1.9.1 — the key requirement, moved to the front of a description that gets truncated

Docs only; no script changes, no advice changed. `description` now **opens**
with one sentence: `Requires OFOX_API_KEY — create one at
https://app.ofox.ai.` The dependency itself is unchanged and was already
declared in `metadata.openclaw.requires.env`, which stays exactly as it
was — that is the route ClawHub and openclaw read. Nothing a caller does
changes.

**Two separate blind spots, measured 2026-09-06 against Codex CLI 0.149.1 with
a project-level install of this repo.** It listed all nine skills, but asked
which environment variables `seedance-product-video` needs before use it
answered that it could not tell from the visible skill metadata. The first
cause is the obvious one: some agents read only the frontmatter's `name` and
`description`, never `metadata`. The second only surfaced on a controlled
retry — same agent, same question, the requirement added to the **end** of the
description and nothing else changed — where the answer did not budge. Pressed
for a verbatim quote, the agent said the description in its context was
truncated and did not include the final sentence; it put its own visible tail
at about 257 characters, and the fragment it could still quote ends at
character 320 of the real text. So the window is roughly 300 characters, and
these descriptions run 828 to 1200. "Reads the description" is not the same as
"reads all of it".

**What that costs, beyond the key.** Inside a ~300-character window the
`Use when ...` trigger examples of all four scenario skills fall outside: they
begin at character 431 (`seedance-ad-creative`), 594
(`seedance-product-video`), 641 (`seedance-anime-drama`) and 690
(`seedance-short-drama`). This skill's own `Load this skill directly only when ...` clause begins at
character 583, likewise outside. A truncating agent has never matched any of them
on an example — it matches on the opening summary alone. Anything that has to
reach such a reader belongs in the first ~300 characters, which is why this
sentence leads instead of trailing, and why it is 58 characters rather than the
106 first drafted: that position is the scarcest space in the skill, and every
character spent there displaces a character of trigger material.

**Why character 0 and not the end of the opening sentence.** The first
sentence-ending period sits at character 268 in `ofox-image-core`, 430 in
`seedance-ad-creative` and 593 in `seedance-product-video`. Placed there the
sentence would straddle or clear the window in exactly those three, and
reaching a boundary at all in two of them would mean repunctuating shipped
prose. Character 0 is the only position that is inside the window under both
the 257- and the 320-character reading, for all six skills, without altering a
word of the existing text.

Two readers were never affected and are unchanged by this: Claude Code reads
the description in full, and OpenCode read at least the first 1075 characters
of `seedance-product-video` — it answered `OFOX_API_KEY` correctly even from
the trailing version.

## 1.9.0 — correction: it was the jacket, not the ages; and a refusal that names nothing has to be bisected

Docs only; no script changes.

**Correction to 1.8.0.** That entry said the safety refusal cleared because the
prompt dropped its age numbers, softened minor-coded wardrobe detail and
rewrote a strike as two forces meeting. Three edits went out together, so
nothing was isolated, and the emphasis fell on the two that turn out to have
nothing behind them. A single-variable bisect on 2026-09-06 — a control plus
five steps at
`--quality low --size 1024x1024`, about 0.037 USD billed and the one refused
step free — walked from a prompt known to pass toward the prompt known to fail
and stopped on one word: `cropped`, in `cropped jacket` — a
bare-midriff garment, so most plausibly a sexual-content read, though the
endpoint names no category and that part stays inference. The two prompts
either side of that step are identical byte-for-byte apart from the word, and
one is refused while the other is not.

**Three strengths of result, kept apart.** The setting and the powers were each
swapped on their own in a step that passed, so those two are cleared. The
weapons and the covered faces are not: they came out of the prompt one at a
time and then together while the cause was still being guessed at, and it was
refused every time — enough to say neither is the cause on its own, not enough
to call either safe, because nothing that passed on this model has carried
them. The blade that did get through went through `mai-image-2.5-flash`, a
different filter. The ages and
the blow-landing strike wording are a third case again: every step started from
the retry that had already dropped both, so the bisect inherits them and cannot
speak to either. The entry also states the asymmetry behind all three, which is
what both corrections turned on — a refusal shows what is not sufficient to fix
a refusal, and only a passing call can show a clause is safe, and only for what
that call carried.

Reading back, the 1.8.0 retry that "worked" had also turned `black over-knee
socks` into `dark tights` in the same batch, which is the likelier cause — so
the wardrobe edit was in 1.8.0's list, filed under
"minor-coded" when the evidence now points at the garment itself. **The
age-number and rewritten-strike claims have no isolating evidence in this
repo** and are recorded as untested rather than as advice. If you were
following 1.8.0, the thing to change first on a refused character prompt is the
wardrobe wording, not the subject matter. `SKILL.md`'s one-line pointer at that
row changed with it: it used to send readers there for "what got through on the
retry", which is exactly the attribution being corrected, and now names the
isolated trigger and both repair routes.

**A refusal here carries no category, so guessing is the expensive route.** All
six refusals in that session returned the identical string `Your request was
rejected by the safety system`. Six semantic guesses against that silence all
missed; the five written down afterwards were weapons, the covered face,
realistic combat versus fantasy powers, a rooftop parapet read as self-harm,
and wet clothing clinging to the body. A new
subsection in `references/api-params.md`, "When a refusal names no category,
bisect rather than guess", writes up the procedure that did converge: start
from a prompt that passes, change one thing per call, and bisect inside the
step that fails. It leads with the control — re-running the known-good prompt
unmodified — because a refused control means the filter moved and every
comparison after it is unreadable.

**The escape hatch was real and buried.** `microsoft/mai-image-2.5-flash` had
already been observed producing a bladed character sheet that
`openai/gpt-image-2` refused twice with this same error, but that lived only in
a task record, which is why nobody reached for it during six refusals. The
error table now lists two repair paths for a safety refusal, not one: rewrite
the clause, or re-run unchanged on `--model microsoft/mai-image-2.5-flash`.
About 2.67 cents against 0.6 cents at the cheap pair — usually less than a
third rewrite, and the route to take when the refused element is one the shot
wants to keep.

## 1.8.0 — the safety system has its own error type, and an age number was enough to trip it

Docs only; no script changes. `error.type` on `/v1/images/generations` had
exactly one confirmed value since 2026-08-29, `invalid_request_error`. A real
call on 2026-09-06 returned a second: **`image_generation_user_error`**, HTTP
400, upstream message *"Your request was rejected by the safety system"* with
an Azure request id. Nothing billed.

What tripped it is worth recording because it is ordinary scenario input, not
an edge case. The prompt was an opening frame for an anime fight and named
ages explicitly — `a 17-year-old girl`, `an 18-year-old boy` — while describing
a strike landing on a person (`his right fist … driving forward into her`).
Removing the age numbers (`a young woman` / `a young man`), easing the
minor-coded wardrobe detail, and rewriting the clash as two forces meeting in
the air rather than a blow landing on a body passed on the very next call with
everything else unchanged.

The error table in `references/api-params.md` carries the row; `SKILL.md`'s
claim that `invalid_request_error` was "the only value confirmed so far" is
corrected rather than left to age.

## 1.7.0 — the quote said 0.6 cents, the bill said 15.4, and `--dry-run` had no opinion about `standard`

Two guards, both for failures that already happened on real runs and neither
of which anything in this skill was set up to catch.

**The estimate is pair-aware, and never optimistic.** On 2026-09-04 a scenario
skill generated a real frame at `--quality high --size 1792x1024`, was quoted
**~0.6 cents**, and was billed **15.4 cents** — 5063 output tokens against
the 196 the anchor had been measured at (`low` / `1024x1024`). 26x, on one
model, from two flags; and the flags were on screen directly above the wrong
price, because the lookup read one number per model
(`.anchors[<model>].output_tokens`) and never saw what was requested. The
approval gate faithfully relayed the smaller number, which is the part that
makes this a spend bug rather than a display bug.

- **A measurement at the request's own `--quality` and `--size` is quoted
  as-is**, and the line now carries the pair: `measured 2026-09-04 at
  --quality high --size 1792x1024`. The pair travels with the price into the
  approval table, so someone reading only the quote can see whether it
  belongs to what they asked for.
- **When no measurement exists at that pair, the DEAREST point the model has
  is quoted, labelled `ROUGH UPPER BOUND`**, with the pair it borrowed from.
  Nothing is interpolated between two measured points, and nothing is ever
  borrowed across models — that rule is unchanged and still tested.
- **`auto`, and an omitted `--size`, take the bound path.** The API picks in
  both cases, so there is no pair to match and matching one anyway is exactly
  the optimism that cost the 15.4 cents. **Consequence worth knowing: a cheap
  `--quality low` call with no `--size` now shows `gpt-image-2`'s 15.4-cent
  ceiling rather than its 0.6-cent point.** Naming the pair
  (`--quality low --size 1024x1024`) is what gets the exact figure back. An
  over-quote labelled a ceiling is recoverable; an under-quote that has
  already been approved is not.
- **A ceiling built on one sample says so.** `microsoft/mai-image-2.5-flash`
  has exactly one measured point, so its "bound" for a large high-quality
  frame is 2.66 cents — a figure a real bill could plainly exceed if its token
  count climbs with size the way `gpt-image-2`'s does. The line prints a
  second `Weak ceiling` note in that case and says to measure the pair rather
  than lean on the label. Two-point models do not get the caveat, because a
  caveat printed unconditionally is a caveat nobody reads.
- Data: `references/token-anchors.json`'s `quality`/`size` fields are now
  load-bearing rather than documentation, and `additional_measurements[]` is
  read as real points rather than as a note — `gpt-image-2`'s 5063-token entry
  is what the ceiling above is made of. A measured point with no pair recorded
  can no longer be priced against a request at all, and a test fails if one
  appears. The file's own instruction to raise this change with the repo owner
  rather than make it quietly was followed; approved 2026-09-05.

**`--quality` is validated against the model that will actually run.** It was
validated against the union of every model's values (`auto low medium high
standard hd`), so `standard` passed validation, passed `--dry-run`, and then
died at submission with `Invalid value: 'standard'. Supported values are:
'low', 'medium', 'high', and 'auto'` — the day `MODEL_CHAIN`'s head became
`openai/gpt-image-2` (2026-09-04). Five copy-pasteable commands across two
other skills shipped broken that way and a dry run caught none of them. Now
the combination fails at `--dry-run`, exit `1`, no network call, nothing
billed.

- **The error names the model even when nobody named it.** With no `--model`
  passed the id comes from `MODEL_CHAIN`, and an error about
  `openai/gpt-image-2` is unconnectable to anything the user typed unless it
  says where the model came from. It says so, and offers both fixes: an
  accepted `--quality`, or pinning a `--model` that takes the value —
  naming `microsoft/mai-image-2.5-flash` specifically when the value is
  `standard`.
- **The whitelist has exactly one row, and that is the design, not a TODO.**
  `openai/gpt-image-2`'s four values come from the API's own enumeration, read
  verbatim off the 400. Everything else keeps the full union: what exists for
  the other models is evidence that a value *works* (`standard` on
  `mai-image-2.5-flash`, nine real runs; `low` on
  `google/gemini-3.1-flash-image`, three) — not an enumeration of what they
  take. **A false rejection here is worse than the 400 it would prevent**: the
  400 costs a round trip and no money, while a false rejection blocks the work
  outright with no way around it short of editing the script. So an absence of
  evidence stays permissive, and `model_qualities()` gains a row only when a
  model has enumerated its own set. A test asserts the row count, so the next
  row has to be argued for.

- Documentation: `SKILL.md` rewrites "The estimate is rough, and sometimes
  impossible" around the three-outcome line shape and the four selection
  rules, replaces the per-model `--quality` pass/fail table with one that
  separates first-hand enumeration from the permissive fallback, and adds a
  fourth scenario-skill "do not re-implement this" item covering both the
  per-image price and the `--quality` value — the two things those five broken
  commands had hardcoded. `references/api-params.md` and
  `references/pricing.md` carry the same correction against the fields and the
  anchor table they belong to; `pricing.md`'s "neither is fixed by this
  write-up" is now a record of what was fixed and what is still on a human.
- Tests: 149 cases, up from 108. `dryrun.test.sh` gains 25 — the verbatim
  bug reproduction (`--quality high --target-aspect 16:9`) now quoting the
  5063-token point and explicitly *not* the 196-token one, the pair printed in
  the line, an unmeasured pair taking the labelled ceiling, `auto` and omitted
  `--size` doing the same, no interpolation between 196 and 5063, the weak
  single-sample ceiling, one estimate line on every path, and every anchor
  carrying its pair. `validation.test.sh` gains 16 — `standard` and `hd`
  rejected for `gpt-image-2`, all four of its enumerated values still
  accepted, the rejection reachable with no `--model` and naming the resolved
  model and its origin, `standard` still accepted on the model that takes it
  and on unenumerated models, `hd` still accepted where nothing was observed,
  the union check still firing first, `check` still working with no model in
  hand, and the one-row table asserted. No existing assertion was changed;
  one existing case's **input** moved from `--quality standard` to
  `--quality low --size 1024x1024`, because that input is now invalid by
  design and an omitted size is deliberately unmatchable — the assertion and
  its `0.0059` figure are untouched.

## 1.6.0 — 16:9 was never requestable, and the third agent to hand-crop a frame is one too many

**The size enum this API accepts contains no 16:9 and no 9:16 entry, and
cannot.** `1792x1024` is 1.7500 against 16:9's 1.7778; `1024x1792` is 0.5714
against 9:16's 0.5625. That is not a model defect and no flag removes it — it
is a structural gap between this endpoint's `size` enum and the video API's
`aspect_ratio` values, so **every 16:9 or 9:16 frame this skill has ever
produced was cropped by hand afterwards**, and three separate agents
re-derived "measure the file, then crop" from first principles before anyone
wrote the fact down. Nothing in this skill said it. That is what 1.6.0 fixes,
in the script rather than in advice.

- **`--target-aspect W:H` and `--target-size WxH`: state the ratio you
  actually need, and the script keeps it.** It picks the request size from the
  enum (for 16:9, `1792x1024` — 98.4% of the pixels survive the crop, against
  `1536x1024`'s 84.4%), generates, **measures the written file with
  `ffprobe`**, and centre-crops to exact integer multiples of the reduced
  ratio. Both crops previously done by hand fall out of that one rule:
  `1344x768 → 1344x756` and `1792x1024 → 1792x1008`. `--target-size` adds a
  pixel floor — cheapest accepted size that clears it, then scaled down to
  exactly those pixels. Never scaled up.
- **Why this was worth code and not a paragraph: `adaptive` turns a two-cent
  mistake into a video bill.** Attaching an image to `bytedance/seedance-2.5`
  forces `aspect_ratio: adaptive`, so the frame's own ratio becomes the
  finished clip's ratio whatever the video flags say. A 1.75 frame delivers a
  1.75 clip, and the correction is another paid generation. An
  almost-right image is the expensive outcome here, not the safe one — which
  is why a target that cannot be met **fails loudly** (exit `1` when no
  accepted size can cover it, exit `3` when the delivered file comes back too
  small) rather than emitting a frame that is 0.03% off and looks fine.
- **`SIZE_ACTUAL`, on every run, whether or not a target was set.** The
  response's own `size` field has now been wrong on two of the three models
  measured, and on `microsoft/mai-image-2.5-flash` it is a *three-way*
  mismatch — requested `1792x1024`, response said `1354x774`, file measured
  `1344x768`, three separate paid runs. So the script measures the file
  itself, prints it as its own line, and says on stderr when the two
  disagree. `openai/gpt-image-2` honouring `--size` exactly is **one run**
  (2026-09-04) and is recorded as one observation, not a guarantee — and that
  same run still needed a crop, because 1792x1024 is not 16:9 either.
  Honouring the request is not the same as producing a usable ratio.
- **`IMAGE_PATH` is still the file to attach, and the original still exists.**
  With a target, the cropped frame takes the plain output name and the API's
  untouched bytes are kept beside it as `<name>-uncropped.<ext>`, reported as
  `IMAGE_PATH_UNCROPPED`. An existing caller parsing `IMAGE_PATH` therefore
  gets the correct-ratio file without changing a line, and a human who wants
  a different crop still has the original. If the crop fails the plain name is
  never written at all — there is no state in which a wrong-ratio frame sits
  where the right one was promised.
- **An explicit `--size` is respected, never silently replaced.** It is only
  warned about, and only when it cannot cover a `--target-size`. The
  selection runs when `--size` was omitted.
- **`ffmpeg`/`ffprobe` are required only by the two new flags**, and are
  checked **before anything is spent** (exit `2`, the same class as a missing
  `curl`). They are not a new dependency for this repo —
  `ofox-video-core` already measures and cuts media with them — and `check`
  deliberately does not test for them, so a caller who never crops is
  unaffected. The failure message names the install command *and* the way
  out: drop the flag and everything else, `--dry-run` pricing included, still
  works.
- Documentation: `SKILL.md` gains "The size enum cannot express 16:9 or 9:16"
  with the full ratio table, the `adaptive` propagation consequence, and a
  per-model measurement table replacing the prose version; the scenario-skill
  rules gain a third "do not re-implement this" item for the crop step, since
  a scenario skill producing a video first frame should treat one of the two
  target flags as mandatory. `references/api-params.md` carries the same
  ratio table against the `size` field it belongs to.
- Tests: `references/test/targetsize.test.sh`, 45 cases — the enum's lack of a
  16:9 entry asserted rather than assumed, the two real hand-crops as
  regression cases, the size-selection choice per ratio and per pixel floor,
  exactness of the cropped ratio, both loud failures, the explicit-`--size`
  warning, malformed and conflicting targets, and the missing-`ffmpeg` guard
  including the case where no target flag is set and `ffmpeg` must not matter.
  The three existing suites pass unchanged (63 cases), for a total of 108.

## 1.5.0 — one real run on the new default model: 26x the estimate, a 400 on `standard`, and an exact `--size`

**A single paid `openai/gpt-image-2` run on 2026-09-04 — `--quality high
--size 1792x1024`, `USAGE_OUTPUT_TOKENS 5063`, `IMAGE_COST 0.154035` — billed
15.4 cents against this repo's own 0.6-cent estimate. About 26x.** Nothing
malfunctioned to produce that: the anchor said 196 output tokens, the script
printed the anchor, and the anchor had been measured at `low` / `1024x1024`
with nothing on the row recording that fact. Three findings came out of the
one run; all three are written down here, and **no behaviour changed** — the
only edit to `references/ofox-image.sh` is its comments, and all 63 tests in
`references/test/` still pass untouched.

- **Anchors now record the `--quality`/`--size` pair they were measured at.**
  `references/token-anchors.json` gains a `quality` and a `size` field on all
  three anchors, and `openai/gpt-image-2` gains an `additional_measurements`
  entry for the new point (5063 output tokens at `high` / `1792x1024`,
  `cost_per_image` 0.154035, `samples` 1, `cost_invoice_checked` **false** —
  the figure is the job's own reported `IMAGE_COST`, not an invoice line; the
  formula behind it is still reconciled against a real bill on
  `google/gemini-3.1-flash-image` only). The 196-token point is kept intact
  rather than corrected: it is still true for the pair it was measured at,
  which is exactly the point. A new `_what_the_count_does_depend_on` note
  states the rule the run bought — **an anchor is only valid for the pair it
  was measured at** — and `_how_to_add_a_row` now requires the pair to be
  recorded with any new count.
- **Deliberately *not* fixed: the lookup.** `.anchors[<model>].output_tokens`
  is still what `--dry-run` prints for every request, whatever quality and
  size it asks for, so the 26x gap is now documented rather than closed.
  Teaching it to select a point by pair — or to default to the dearest
  measured point — changes what every caller is quoted, which makes it a
  product decision, not a typo; `token-anchors.json` says to raise it the way
  `_chain_order_history` requires a chain reorder to be raised. Until then
  `SKILL.md` and `references/pricing.md` both tell the caller to read the
  anchor's own `quality`/`size` before relaying the line, and to quote the
  measured point that matches the run they are about to make.
- **No per-image figure in this skill is unqualified any more.** Every place
  that quoted "~0.6 cents" or "~2.67 cents" — the chain table in `SKILL.md`,
  the anchor table in `references/pricing.md`, the `MODEL_CHAIN` comment's
  own reasoning — now names the pair the figure belongs to. The chain table
  also carries the limit on its own ranking: the 4.5x gap between the top two
  models was measured at one pair only, and the 26x spread *within* one model
  is larger than it, so "which model is cheaper" is a narrower claim than it
  reads as.
- **`--quality` is a per-model enum, and `standard` is not portable.** The
  same run's first attempt was refused outright: `openai/gpt-image-2` +
  `--quality standard` → HTTP 400, `Invalid value: 'standard'. Supported
  values are: 'low', 'medium', 'high', and 'auto'`, **nothing billed**. That
  value had worked on every image call this repo had ever made — nine of them
  — and became an instant 400 the moment 1.4.0 moved `gpt-image-2` to the
  head of the chain: a per-model enum turning a default change into a
  breaking one. `SKILL.md`'s "Required flags" and
  `references/api-params.md` now carry a per-model pass/fail table, and
  `SKILL.md`'s own `--dry-run` example passes `high` instead of `standard`,
  since a dry run cannot catch this (the script validates `--quality` against
  the union of all models' values, so the rejection can only come from the
  API). The new error-table row records the status and the message and marks
  `error.type`/`error.code` as **not captured**, rather than borrowing the
  values from the row above it.
- **`gpt-image-2` honours `--size` exactly — and still needed a crop.**
  Request, response echo and the saved file's real pixels all read
  `1792x1024`, where `google/gemini-3.1-flash-image` disagrees two ways and
  `microsoft/mai-image-2.5-flash` three. This answers the open question 1.4.0
  asked someone to re-observe. It changes nothing about the standing advice,
  and the same run is why: 1792x1024 is 1.75, not 16:9, so the frame had to be
  cropped to `1792x1008` before a `bytedance/seedance-2.5` job would inherit
  the right ratio (an attached frame forces `aspect_ratio: adaptive`).
  **Measure the file and crop regardless of model** — what varies per model is
  how large the correction is, not whether one is needed.
- **1.4.0's "`gpt-image-2` has no output samples in this repo yet" is
  retired.** It has one, and the two surprises above are what it produced.
  One run is still one run: pin `--model microsoft/mai-image-2.5-flash` if the
  look matters more than the price for a given use case.
- `references/pricing.md`'s anchor table said `gpt-image-2` was measured on
  2 calls where `token-anchors.json` says 3. Corrected to 3, per that table's
  own rule that the JSON wins.

## 1.4.0 — the priority chain's order reversed: `gpt-image-2` first

**`MODEL_CHAIN` now resolves to `openai/gpt-image-2` by default, not
`microsoft/mai-image-2.5-flash`.** New order:
`openai/gpt-image-2 microsoft/mai-image-2.5-flash
google/gemini-3.1-flash-lite-image microsoft/mai-image-2.5`.

This is a deliberate reversal of a deliberate decision, not an unreviewed
reorder. On 2026-09-02, with `gpt-image-2` already shown to cost ~4.5x less
per image than `mai-image-2.5-flash` despite its higher per-token rate
(196 output tokens against 1024, measured that day), the repo owner looked
at both figures and kept `mai-image-2.5-flash` first anyway — recorded in
`references/token-anchors.json`'s chain-order history note, along with the
instruction that the next person who wanted to reorder the chain should
raise it first. On 2026-09-04 the repo owner did exactly that and asked for
`gpt-image-2` first instead. This release carries out that request.

- **`SKILL.md`'s priority-chain table is now ranked by measured cost per
  image**, not by the rate card's per-output-token price — the two rankings
  disagree, and the table used to be ordered by the wrong one. A new "The
  2026-09-04 reversal" subsection records the history above in the skill's
  own docs, not only here.
- **`MODEL_SOURCE request` is now the common case for a default `generate`
  call**, not an edge case — `openai/gpt-image-2` never echoes a `model`
  field, and it is now the model a default call resolves to.
- **A new, unrelated `SIZE` finding surfaced while re-checking this
  default**: `microsoft/mai-image-2.5-flash` — now second in the chain —
  was found, through three real calls made by a downstream scenario skill,
  to disagree with itself on `--size` three ways at once (requested
  `1792x1024`, response echoed `1354x774`, saved file `1344x768`), not just
  the two-way mismatch already documented for `google/gemini-3.1-flash-image`.
  Neither `SIZE` finding has been checked against `gpt-image-2`; both
  `SKILL.md` and `references/pricing.md` now say so and ask for a fresh
  observation the next time a scenario skill generates with the new
  default. `gpt-image-2` also has no generated-output samples in this repo
  at all yet — its measured figures are token counts, not a look at what it
  draws.
- **Test coverage moved with the default**: `dryrun.test.sh`'s assertions
  that the default `generate --dry-run` resolves to and prices the chain's
  preferred model now target `gpt-image-2`'s own anchor (196 tokens, ~0.6
  cents) instead of `mai-image-2.5-flash`'s; the anti-borrow check now
  guards against either previous default's token count (1120 or 1024)
  leaking into the new one's estimate.
- `references/token-anchors.json`'s `_why_the_cheapest_measured_model_is_not_first`
  note is renamed `_chain_order_history` and now records both decisions —
  keeping mai-flash first on 2026-09-02, then reversing that on 2026-09-04 —
  rather than only the first one. The rule it carries is unchanged: raise a
  reorder before making it.

## 1.3.0 — the chain's top models are measured, and a missing `model` echo no longer costs you the cost

**Bug fix: `openai/gpt-image-2` runs printed no `IMAGE_COST` at all.** Its
responses carry no `model` field. The old code defaulted that to the literal
string `"unknown"`, looked `"unknown"` up in the rate table, found nothing, and
reported `could not compute a cost` — for a request the script had built itself
from a model id it knew. Two real, paid calls were billed with no cost figure.

The fallback deliberately keeps two cases apart rather than collapsing them:

- **No `model` field** (absent, `null` or empty) — nothing was contradicted, the
  upstream just didn't echo. The **requested** id is used for display and
  pricing, and the new `MODEL_SOURCE request` line says so, so nobody reads the
  `MODEL` line as something the API confirmed.
- **A `model` field naming a different id** — that is an upstream route, alias
  or downgrade. The **echoed** id wins for both display and pricing, a warning
  goes to stderr, and `MODEL_REQUESTED` records what was asked for. Rewriting it
  back to the requested id would price the call off the wrong rate card and
  erase the only evidence the swap happened.

**New output lines**: `MODEL_SOURCE` (`response` | `request`) on every
successful generate, and `MODEL_REQUESTED` only when it differs from `MODEL`.
`MODEL_SOURCE` is unconditional for the same reason `Estimated cost:` is — an
agent can relay a line it was told to expect, but cannot notice one that was
never printed.

**Token anchors for the chain's top two models** (`references/token-anchors.json`),
so a default `generate --dry-run` now quotes a rough figure instead of "cannot
be predicted": `microsoft/mai-image-2.5-flash` 1024 output tokens (~$0.0267/image),
`openai/gpt-image-2` 196 (~$0.0060/image). Both measured 2026-09-02 at
`--quality low --size 1024x1024`.

- **The count does not depend on the prompt.** Two unrelated prompts produced
  byte-identical `usage` on both models; Gemini's three calls reported 1120
  output tokens at input lengths of 8, 51 and 79. `output_tokens` looks fixed by
  model + size + quality — which is the whole reason one anchor can price a
  later run with a different prompt. Two samples per model, not a proof.
- **The dollar figures are formula-derived and invoice-unchecked.** Only
  `google/gemini-3.1-flash-image` has ever been reconciled against a real bill;
  `cost_invoice_checked` records that per row and must not be flipped without an
  invoice line. The model page alone once supported two readings 20x apart.
- **Cheaper per token is not cheaper per image.** `gpt-image-2` costs 15% more
  per output token than `mai-image-2.5-flash` and **4.5x less per image**
  (196 tokens vs 1024). `MODEL_CHAIN` was ordered on the per-token rate; it is
  not reordered here on two samples, but `SKILL.md` and `references/pricing.md`
  now flag that the rate card is the wrong thing to rank on.

## 1.2.0 — a default model, a `--dry-run`, and the gate that pays for both

**Behavior change: `--model` is now optional.** Omit it (or pass `auto`) and
the script walks a cheapest-first priority chain and uses the first model that
is actually available. Passing `--model <id>` still pins any model, exactly as
before, so existing callers are unaffected.

- **The chain lives in one place**, `MODEL_CHAIN` in `references/ofox-image.sh`:
  `microsoft/mai-image-2.5-flash` → `openai/gpt-image-2` →
  `google/gemini-3.1-flash-lite-image` → `microsoft/mai-image-2.5`, cheapest
  first by the catalog's `output_image` rate. Skills built on this one resolve
  a model by calling the script; none of them keeps a copy of the list.
- **Fallback is reported, never silent.** A preferred model that is missing
  from the model list, doesn't serve `/v1/images/generations`, or is
  deprecated gets skipped, and the run prints `MODEL_FALLBACK_FROM`,
  `MODEL_FALLBACK_REASON` and `MODEL_PRICE_DELTA` ("1.80x the preferred rate").
- **The model is resolved before anything is quoted.** There is deliberately
  no path where the model is chosen after a price was approved.
- **New `--dry-run`**, matching `ofox-video-core`'s: validate, resolve the
  model, create and check `--out-dir`, build the payload, print the estimate,
  then return — before the `POST`. Nothing submitted, nothing billed, and no
  `OFOX_API_KEY` required, so a job can be priced before signing up.
- **The estimate is honest about being rough, or refuses.** Images bill per
  output token and the count only exists in the response, so the figure is
  anchored to a real measured call with the *same* model, from the new
  `references/token-anchors.json`, and is labelled `ROUGH`. A model with no
  measurement gets "cannot be predicted" and the reason — never another
  model's token count, which in an approval table would be indistinguishable
  from a measured one. Exactly one `Estimated cost:` line either way, printed
  on a real run too.
- `google/gemini-3.1-flash-image` is the only measured anchor so far (1120
  output tokens). The chain's top two models are recorded as **awaiting
  measurement**, which is why a default `generate --dry-run` says the cost
  cannot be predicted today. Two real calls fix that; nothing else does.
- **Why a default is acceptable now, when 1.1.0 documented refusing one as
  deliberate:** the objection was that defaulting silently picks a price. The
  new shared approval gate
  (`ofox-video-core/references/approval-gate.md`) puts the resolved model and
  its cost in front of the user before every spend, so it no longer does. That
  reasoning is written into SKILL.md next to the default, not just here.
- `models` now prints the chain and the model it resolves to right now.
- **An unquantifiable price gap names the right model.** When one of the two
  rates is missing, `MODEL_PRICE_DELTA` says which model lacks a published
  rate. It no longer blames the preferred model in every case, and no longer
  claims the missing rate was "part of why it was skipped" — `resolve_model`
  never looks at pricing when deciding what to skip, so that reason could
  not be true. A wrong reason in an approval table is worse than no reason.
- **A chain with nothing usable in it says so on stdout.** That case sets
  `MODEL_CHAIN_EXHAUSTED` (not the fallback fields — nothing was fallen back
  *to*), so the caller can tell the user that the model in the table is one
  the script already expects the API to reject. Previously the reason was
  recorded internally and dropped from the structured output, leaving only
  stderr prose.
- New `references/test/dryrun.test.sh` (25 cases: the dry run's early return,
  the single estimate line, every fallback reason, each price-delta branch,
  the exhausted chain, and that no anchor is ever borrowed across models).
  Free by construction.

## 1.1.0 — every image model Ofox serves, not a hardcoded three

- **`--model` is checked against the live model list.** It was previously
  matched against three hardcoded ids, so the script locally rejected the other
  eleven models the API actually serves — `openai/gpt-image-1.5`,
  `google/gemini-3-pro-image`, `volcengine/doubao-seedream-5.0-pro`,
  `microsoft/mai-image-2.5` and the rest all failed before a request was made.
- A model that exists but doesn't serve `/v1/images/generations` (a video
  model, say) is now rejected with that specific reason.
- **New `models` subcommand**: lists the image models and their per-output-token
  price. No API key needed — `GET /v1/models` is public.
- Same fallback ladder as `ofox-video-core`: fresh cache (24h) → live → stale
  cache → bundled `references/models-snapshot.json` → no check. Every fallback
  is announced. An unknown id is rejected against a live list but deferred to
  the API when only a snapshot is available.
- **Unchanged on purpose**: `--size`, `--quality`, `--output-format` and
  `--background` stay hardcoded from the docs. Unlike the video API, the models
  endpoint exposes no per-model capability data for image models — there is no
  `image_attributes` to match `video_attributes` — so only the model id can be
  validated dynamically.
- `--model` stays required with no default, now documented as deliberate: the
  image models differ roughly 4x in price with no obvious winner, so defaulting
  would silently pick a price.
- New `references/refresh-snapshot.sh` and `references/test/validation.test.sh`
  (18 cases; accept cases warm the model cache from the real endpoint and then
  point the API base somewhere unroutable, so no case can reach the real
  generations endpoint even with a live key exported).
- Frontmatter: top-level `version` and `metadata.openclaw.homepage`/
  `envVars`/`primaryEnv` for ClawHub.
