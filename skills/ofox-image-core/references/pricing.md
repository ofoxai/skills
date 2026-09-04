# Ofox image API pricing

Source: `https://ofox.ai/models/google/gemini-3.1-flash-image` (verified
2026-08-29 for the rate numbers below). Prices can change — re-verify
against the live model page before quoting a number you intend to hold
someone to.

## The rate that applies — settled against a real invoice

The model page states, for `google/gemini-3.1-flash-image` ("Nano Banana
2"):

| Item | Rate |
|---|---|
| Input tokens | $0.5 / M tokens |
| Output tokens | $3 / M tokens |
| Output image | $60 / M (units unclear from the page alone) |

The third row ("output image $60/M") used to be the open question: it could
have priced the image portion of `usage.output_tokens` at $60/M, or those
tokens could have billed as ordinary output at $3/M — a 20x spread.

**A real invoice line settled it on 2026-08-31.** A call reporting
`input_tokens=79, output_tokens=1120` was billed **$0.06723950**, matching
the $60/M reading to eight decimal places:

```
79 * 0.0000005  +  1120 * 0.00006
= 0.0000395     +  0.0672
= 0.06723950                       <- the invoice, digit for digit
```

So: **an image response's output tokens bill entirely at `output_image`, and
the `output` ($3/M) row does not enter into it.** The $3/M rate belongs to
this model's text-generation endpoint, not to `/v1/images/generations`.

## What to do instead

Every real response from `POST /v1/images/generations` includes a real
`usage` object:

```json
"usage": {
  "input_tokens": 14,
  "input_tokens_details": { "text_tokens": 14 },
  "output_tokens": 208,
  "total_tokens": 222
}
```

`ofox-image.sh` prints these three counts and, since the rate question was
settled, an `IMAGE_COST` line computed from them. It reads the rates from the
model list rather than hardcoding them, so a model with different pricing
gets its own figure. When no rates are available (offline, or a model missing
from the list) it prints no cost and says why — the token counts are always
exact, a computed cost is only as good as the rate table behind it.

**Key-name trap**: the two endpoints that publish rates disagree on spelling.
`/v2/models/catalog` calls them `input`/`output`; `/v1/models` — the list the
script actually loads — calls them `prompt`/`completion`. `output_image` is
spelled the same in both. Code reading either source must accept both.

**Which-model trap**: the rate lookup needs a model id, and the obvious place
to get one is the response's `model` field — but `openai/gpt-image-2` does not
send that field at all. The script used to default it to the literal string
`"unknown"`, look `"unknown"` up in the rate table, find nothing, and print
`could not compute a cost` for a request it had built itself. Two real, paid
calls were billed with no cost figure printed. Fixed in
`resolve_response_model()`, which keeps two cases deliberately apart:

| Response's `model` field | Id used for display and pricing | Reported as |
|---|---|---|
| absent / null / empty | the **requested** id | `MODEL_SOURCE request` |
| present, same as requested | the echoed id | `MODEL_SOURCE response` |
| present, **different** | the **echoed** id, plus a stderr warning | `MODEL_SOURCE response` + `MODEL_REQUESTED <asked-for id>` |

The third row is the one not to simplify away. A missing echo is silence and
means nothing was contradicted; a *different* echo means something upstream
routed, aliased or downgraded the request, and the invoice will follow the
model that actually ran. Rewriting it back to the requested id would compute
the cost off the wrong rate card and destroy the only evidence that the swap
happened.

## Verified real example

Real, paid, non-simulated call, 2026-08-29:

```bash
bash skills/ofox-image-core/references/ofox-image.sh generate \
  --model "google/gemini-3.1-flash-image" \
  --prompt "A simple red apple on a white table" \
  --quality low --size 512x512 --out-dir test-output
```

Result:

```
STATUS completed
IMAGE_PATH /path/to/your/project/test-output/ofox_image_20260829213234_6584.png
MODEL google/gemini-3.1-flash-image
SIZE 512x512
QUALITY low
USAGE_INPUT_TOKENS 8
USAGE_OUTPUT_TOKENS 1120
USAGE_TOTAL_TOKENS 1128
EXIT_CODE:0
```

**Size discrepancy found by inspecting the real file**: the response
claimed `"size": "512x512"`, but the actual downloaded PNG — verified with
`file` and `sips -g pixelWidth -g pixelHeight` — is really **1024x1024**.
`google/gemini-3.1-flash-image` appears to ignore the requested/echoed
`size` and always generate at its native 1024x1024 resolution. See
`references/api-params.md` and `SKILL.md` for the full gotcha writeup; the
point here is just that the token counts above are for a 1024x1024 image in
practice, not a 512x512 one, even though every field in the response said
otherwise.

**Cost**, using the formula confirmed on 2026-08-31:
`8 * 0.0000005 + 1120 * 0.00006` = **$0.06720400**. (When this example was
first written the rate question was open and this was recorded as "either
~$0.0034 or ~$0.067"; the invoice check confirmed the higher reading.)

### `mai-image-2.5-flash`'s own `SIZE` mismatch is three-way, not two

The Gemini gotcha above is a two-way mismatch: requested size vs. actual
size, with the response's echo agreeing with the request and both wrong.
`microsoft/mai-image-2.5-flash` — the model this task moved to second in the
chain — has a worse version of the same problem, found through three real,
paid calls made by a scenario skill built on this one (all requesting
`--size 1792x1024`): the response's own `SIZE` line, and the actual saved
file, and the original request each disagreed. Requested `1792x1024`,
response echoed `SIZE 1354x774`, saved file `1344x768` (ratio 1.75) — three
different numbers, not the two the Gemini case shows. Evidence: the `refs/`
entries of `content/ofox-cases/{anime-rooftop-confession,
yunqi-sparkling-ad, sneaker-motion-ad}/case.json` in the downstream
`home-page` project. Full writeup: `SKILL.md`'s `SIZE` gotcha section.

**This has not been checked against `openai/gpt-image-2`**, the model now
first in the chain — both `SIZE` findings above were observed on other
models, so whether `gpt-image-2` behaves like Gemini (ignores the request,
one consistent wrong answer), like `mai-image-2.5-flash` (three
disagreeing numbers), or correctly, is unknown as of this reorder. Re-observe
it the next time a scenario skill generates an image with the new default,
rather than assuming either prior finding carries over.

## Pre-flight estimates: the token anchor table

The formula above needs `usage.output_tokens`, which does not exist until the
response comes back. That is the whole asymmetry with the video side: a video
is priced per second and duration is an input, so a video job can be quoted
exactly before it is submitted; an image cannot.

`generate --dry-run` still has to print something, because the approval gate
requires a number or an explicit "no number, and here is why" — never a
figure the agent invented. What it prints comes from
`references/token-anchors.json`, the measured output-token count of a real
earlier call **with that same model**:

| Model | Measured output tokens | When | Rough cost/image at today's rate | Invoice-checked? |
|---|---|---|---|---|
| `google/gemini-3.1-flash-image` | **1120** | 2026-08-29, 3 calls | ~6.7 cents | **yes** — see the invoice section above |
| `microsoft/mai-image-2.5-flash` | **1024** | 2026-09-02, 2 calls | ~2.67 cents | no — formula only |
| `openai/gpt-image-2` | **196** | 2026-09-02, 2 calls | ~0.6 cents | no — formula only |

The sample counts here must match `samples` in `token-anchors.json` — that file
is what the script actually reads, this table only explains it. When they
disagree, the JSON wins and this table is the stale one.

The chain's **preferred** and **second** models (`gpt-image-2` and
`mai-image-2.5-flash`, in that order since the 2026-09-04 reorder — see
"Decision record: the chain was reordered on this finding" below) are both
measured, so a default `generate --dry-run` gives a rough number instead of
"cannot be predicted". The **"invoice-checked?"**
column is a separate, weaker-or-stronger claim than the token count next to
it — do not conflate the two:

- The **token count** (1120 / 1024 / 196) is an observation. It came straight
  out of a real response's `usage.output_tokens`.
- The **dollar figure** is that count run through the cost formula
  (`cost = input_tokens * pricing.input + output_tokens * pricing.output_image`,
  confirmed further down this page). The formula itself has only ever been
  checked against a real invoice line for **one** model,
  `google/gemini-3.1-flash-image` (2026-08-31, see above). For the other two
  rows, the dollar figure is what the formula predicts, not what a bill
  confirmed — `token-anchors.json`'s `cost_invoice_checked: false` says this
  explicitly for both. Reading the model page alone left the gemini rate 20x
  ambiguous before an invoice settled it; there is no reason to assume the
  other two vendors' pages are any less ambiguous, so treat their dollar
  figures as **formula-derived estimates**, not verified charges, until a real
  invoice line is checked against each one. Do not flip either `false` to
  `true` without one.

**Decision record: the chain was reordered on this finding.** `gpt-image-2`'s
per-token rate is 15% *higher* than `mai-image-2.5-flash`'s, but it uses 196
output tokens against 1024 — so a single image from `gpt-image-2` is actually
**~4.5x cheaper** than one from `mai-image-2.5-flash`, the opposite of what a
chain ordered by per-token rate implies.

On 2026-09-02, with this finding already in front of them, the repo owner
looked at both figures and deliberately kept `mai-image-2.5-flash` first —
see `token-anchors.json`'s chain-order history note for the reasoning at the
time, and its instruction that the next person who wanted to reorder the
chain should raise it first rather than doing it quietly.

**On 2026-09-04 the repo owner did exactly that** and asked for
`openai/gpt-image-2` first instead. `MODEL_CHAIN` in `ofox-image.sh` and the
chain table in `SKILL.md` now reflect that request. Cost was one input to
this decision, not the only one, on both occasions — the reasoning and the
date behind each call are the part worth keeping, not just the final order.

**Do not fill an unmeasured row by scaling another model's token count.**
Different vendor, different tokeniser, no reason to expect a similar count —
and a number derived that way is indistinguishable, in the table the user
approves, from one that was measured. One real call (a few cents) settles it;
nothing else does. Take `USAGE_OUTPUT_TOKENS` verbatim from the printed
output and update both the JSON file and this table.

### What the output-token count depends on — and does not

Measured 2026-09-02, on two prompts with nothing in common ("A simple red
apple on a white table" vs. "A wooden sailboat on a calm lake at sunrise,
wide shot"), both at `--quality low --size 1024x1024`:

| Model | Prompt | input tokens | output tokens |
|---|---|---|---|
| `microsoft/mai-image-2.5-flash` | apple | 14 | 1024 |
| `microsoft/mai-image-2.5-flash` | sailboat | 14 | 1024 |
| `openai/gpt-image-2` | apple | 14 | 196 |
| `openai/gpt-image-2` | sailboat | 14 | 196 |

Byte-identical `output_tokens` for two unrelated prompts, on both models.
Combined with `gemini-3.1-flash-image`'s three real calls (input tokens 8, 51
and 79, output tokens **1120 every time**), the working model is:

**`output_tokens` is fixed by model + size + quality. It does not depend on
prompt content, or on input token count.**

This is exactly what makes a single measured anchor usable for pricing a
*different* prompt later — if the count moved with what was being drawn, an
anchor measured on one prompt would say nothing about the cost of another,
and `--dry-run` would have no honest number to print at all. That said: **this
is two samples per model, not a proof.** It is a working model that has not
yet been contradicted, held with exactly that much confidence. If a future
call ever shows `output_tokens` moving with the prompt (or with `input
tokens`), that is a counterexample, not noise — record it in
`token-anchors.json` and stop trusting the anchor for that model.

`--size` was already known not to move the count for `gemini-3.1-flash-image`
specifically, because that model ignores `--size` outright (see the gotcha
above). What is new here is that content-independence holds across two
*different* vendors that do respect the requested size — so the size/quality
part of "model + size + quality" is doing real work, prompt content is doing
none.

Even a measured anchor is labelled **ROUGH** when it is printed. It is one
model's observed count, not a promise, and it excludes the input-token
component (the prompt), which was a fraction of a cent on every call observed
so far. The exact figure is always `IMAGE_COST`, computed after the fact from
the response's own counts.

## Cost formula (confirmed)

```
cost = usage.input_tokens  * pricing.input/prompt
     + usage.output_tokens * pricing.output_image
```

Both rates come from the model list, per model — never hardcode them, and
never fall back to a guess when they are missing. `ofox-image.sh` implements
this in `image_cost_for()` and prints the result as `IMAGE_COST`.

### Evidence

| Date | input | output | Computed | Invoice |
|---|---|---|---|---|
| 2026-08-31 | 79 | 1120 | 0.06723950 | **$0.06723950** |
| 2026-08-31 | 51 | 1120 | 0.06722550 | (same batch, not itemised separately) |
| 2026-08-29 | 8 | 1120 | 0.06720400 | (not checked at the time) |

The 2026-08-31 row is the one that carries the argument: an exact eight-
decimal match is not a coincidence between two readings 20x apart.

Ofox exposes **no billing endpoint** — `/v1/usage`, `/v1/billing`,
`/v1/credits`, `/v1/account`, `/v1/balance` and their `/v2` equivalents all
answer 404. The invoice figure above came from the console at
`https://app.ofox.ai`. That is why the cost has to be computed client-side
from rates and token counts: there is nothing to query.
