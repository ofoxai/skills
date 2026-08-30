# Video pricing

Two things live here: the Seedance 2.5 tables the scenario skills quote from,
and the cross-model ladder that matters when someone is generating several
takes to keep one.

## The cheap-to-expensive ladder

Text-to-video, per second, cheapest first. Each rate was read off that model's
own page on 2026-08-30; `—` means the model does not offer that resolution at
all. For the live base rate and current limits, run `ofox-video.sh models`.

| Model | 480p | 720p | 1080p | 4k | Duration | Notes |
|---|---|---|---|---|---|---|
| `bytedance/seedance-2.0-mini` | $0.02 | $0.04 | — | — | 4-15s | cheapest by far; drafts |
| `bytedance/seedance-2.0-fast` | $0.042 | $0.091 | — | — | 4-15s | |
| `bytedance/seedance-2.0` | $0.063 | $0.15 | $0.31 | $1.24 | 4-15s | only model offering `4k` |
| `alibaba/wan-2.7` | — | $0.10 | $0.15 | — | 2-15s | 3 aspect ratios only |
| `bytedance/seedance-2.5` | $0.11 | $0.24 | $0.48 | — | 4-30s | best quality, longest, most aspect ratios |
| `alibaba/happyhorse-1.1` | — | $0.13 | $0.17 | — | 3-15s | lip-sync oriented |

Video-to-video costs more than text-to-video on every model that offers it
(e.g. Seedance 2.0: $0.081 / $0.18 / $0.41 / $1.53; 2.0-fast: $0.05 / $0.11;
2.5: $0.14 / $0.30 / $0.568). Several pages quote a discounted rate — Seedance
2.0 is showing 10% off, 2.0-fast 30% off, 2.5's 1080p is a time-limited $0.48
against a $0.60 list — so a promo ending is a real reason a quote can drift.

Read the gaps carefully: at 720p, `seedance-2.0-mini` is **6x cheaper** than
`seedance-2.5`. Five 4-second drafts cost $0.80 on mini versus $4.80 on 2.5.
When someone is going to generate several and keep one, drafting cheap and
rendering the keeper on 2.5 turns a $5 experiment into a $1 one.

Two cautions:

- **Don't switch models on a user's behalf.** A different model is a different
  look, not just a different price. Offer the ladder, let them choose.
- **`output_video_per_second` from the models endpoint is not a quote.** For
  `seedance-2.5` it reports `0.11` — the 480p rate — while its default
  resolution is 720p at $0.24/s. Rank with it; quote from the tables here.

## Seedance 2.5 pricing

Source: `https://ofox.ai/models/bytedance/seedance-2.5` (verified
2026-08-29). Prices, especially the "time-limited" 1080p rate, can change —
re-verify against the live page before quoting a number you intend to hold
someone to, particularly for anything beyond a quick estimate.

## Per-second rate

| Resolution | Text-to-video (t2v) | Video-to-video (v2v) |
|---|---|---|
| 480p | $0.11/s | $0.14/s |
| 720p | $0.24/s | $0.30/s |
| 1080p | $0.48/s (list $0.60/s, time-limited) | $0.568/s (list $0.71/s) |

- Duration range: 4–30 seconds, any integer.
- Aspect ratios: 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 / adaptive.
- Audio is on by default (`generate_audio: true`) and is not billed
  separately in the table above — the per-second rate already covers it.
- "v2v" (video-to-video) applies when the request includes video input
  (e.g. a video in `input_references`); the two Seedance 2.5 scenario
  skills built on `ofox-video-core` use text-to-video and first/last-frame
  image-to-video only, so the **t2v** column is what applies to them.

## Cost formula

**Estimate — show this *before* generating, so the user isn't surprised:**

```
estimated_cost = duration_seconds * price_per_second(resolution, mode)
```

Example: a 5-second, 1080p, text-to-video clip ≈ `5 * 0.48 = $2.40`
(using the time-limited rate; `5 * 0.60 = $3.00` at list price if the
promo has ended — check the live pricing page if the number matters).

**Actual — report this *after* generating, don't recompute it:**

```
actual_cost = usage.video_cost   # from the poll response, once status is "completed"
```

`usage.video_cost` is a string with 10 decimal places and is the number of
record — it may differ slightly from the estimate (e.g. rounding, or a
promo rate that changed between estimate and completion). `ofox-video.sh`
prints this value directly (`VIDEO_COST`); never substitute the estimate
for it in a final report to the user.
