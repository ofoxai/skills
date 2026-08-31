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
