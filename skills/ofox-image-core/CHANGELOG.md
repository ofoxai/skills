# Changelog

All notable changes to the **ofox-image-core** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

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
