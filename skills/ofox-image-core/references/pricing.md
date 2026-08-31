# Ofox image API pricing

Source: `https://ofox.ai/models/google/gemini-3.1-flash-image` (verified
2026-08-29 for the rate numbers below). Prices can change — re-verify
against the live model page before quoting a number you intend to hold
someone to.

## Do not compute a per-image dollar figure from the rates below alone

The model page states, for `google/gemini-3.1-flash-image` ("Nano Banana
2"):

| Item | Rate |
|---|---|
| Input tokens | $0.5 / M tokens |
| Output tokens | $3 / M tokens |
| Output image | $60 / M (units unclear from the page alone) |

The third row ("output image $60/M") is ambiguous as documented — it likely
prices the image-token portion of `usage.output_tokens` at a different
per-token rate than ordinary text output tokens, rather than being a flat
per-image price, but the model page's phrasing does not make this precise
enough to turn into a formula with confidence. **Do not hardcode a guessed
per-image dollar figure from this phrasing** — the same discipline
`ofox-video-core/references/pricing.md` applied to its own rate table
(compute from a real response, don't trust a documentation page's wording
alone).

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

`ofox-image.sh` prints these three counts directly
(`USAGE_INPUT_TOKENS`/`USAGE_OUTPUT_TOKENS`/`USAGE_TOTAL_TOKENS`). The real
per-image cost depends on actual token usage; see below for a verified
example once one exists — compute it by cross-referencing these real counts
against the documented $/M token rates above (and, if it turns out to
matter, the correct interpretation of the "$60/M output image" row), not by
plugging a documentation-derived guess into a formula ahead of time.

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

**Cost — two possible interpretations, neither confirmed against a real
balance/billing-history check**:

Using the documented rates (input $0.5/M tokens, output tokens $3/M,
output image $60/M):

- Input: `8 / 1,000,000 * $0.5` = ~$0.000004 (negligible either way).
- **(a) If the 1120 output tokens bill as ordinary output tokens at
  $3/M**: `1120 / 1,000,000 * $3` = **~$0.0034** total.
- **(b) If the 1120 output tokens bill as "output image" tokens at
  $60/M**: `1120 / 1,000,000 * $60` = **~$0.067** total.

That's roughly a 20x spread between the two interpretations, and the
response has **no `usage.total_cost`-equivalent field** (unlike the video
API's job responses) to settle it directly. This has **not** been resolved
against ground truth — nobody has checked the actual balance change for
this specific call in the Ofox console. Do not treat either (a) or (b) as
certain; whoever needs a firm dollar figure (e.g. for a scenario skill's
own cost estimate to a user) should check the real balance/billing history
at `https://app.ofox.ai` for this call before quoting one number with
confidence.

## Cost formula (still not fully resolved)

```
actual_cost = input_cost + f(usage.output_tokens, rate_table)
```

where `f` is one of:

- `output_tokens / 1e6 * $3`  (interpretation a — plain output-token rate)
- `output_tokens / 1e6 * $60` (interpretation b — "output image" rate)

Which of the two `f` applies is exactly the open question above. Until a
real balance/billing-history check confirms one, `ofox-image.sh` reports
only the raw `usage` token counts (see `SKILL.md`) and does **not** print a
computed dollar figure — printing one would mean picking a and b
arbitrarily and presenting a guess as fact.
