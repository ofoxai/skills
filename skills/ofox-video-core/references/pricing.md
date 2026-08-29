# Seedance 2.5 pricing

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
