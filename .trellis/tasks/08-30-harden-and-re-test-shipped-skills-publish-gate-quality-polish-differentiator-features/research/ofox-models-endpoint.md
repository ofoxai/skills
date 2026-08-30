# Research: `GET /v1/models` — the key unlock for §3.3 multi-model work

Verified live 2026-08-30 by direct call, `OFOX_API_KEY` explicitly unset.
Raw response saved as `research/models-snapshot.json` (164,598 bytes).

## The endpoint is public and free

```
GET https://api.ofox.ai/v1/models      # HTTP 200, no Authorization header needed
```

Confirmed by `env -u OFOX_API_KEY curl ... https://api.ofox.ai/v1/models` →
HTTP 200. The docs (`https://ofox.ai/docs/develop/models`) state outright it
is "a public endpoint that does not require an API Key". 140 models total,
8 of them expose `/v1/videos` in `supported_endpoints`.

This matters because it means model capability and price data can be fetched
**at runtime, at zero cost, with no key** — it does not need to be hardcoded
into `pricing.md` / `api-params.md` where it silently rots.

## Per-model data actually available

Each entry carries (`bytedance/seedance-2.5` shown as the shape):

```json
{
  "id": "bytedance/seedance-2.5",
  "is_deprecated": false,
  "expiration_date": null,
  "pricing": { "output_video_per_second": "0.11" },
  "supported_parameters": ["prompt","duration","resolution","aspect_ratio",
                           "size","generate_audio","seed","frame_images",
                           "input_references","callback_url","provider"],
  "supported_endpoints": ["/v1/videos"],
  "video_attributes": {
    "modes": ["t2v","i2v","v2v"],
    "resolutions": ["480p","720p","1080p"],
    "default_resolution": "720p",
    "min_duration_seconds": 4,
    "max_duration_seconds": 30,
    "supports_audio": true,
    "aspect_ratios": ["21:9","16:9","4:3","1:1","3:4","9:16","adaptive"]
  }
}
```

## The 8 video models

| Model | base $/s | Resolutions | Duration | Aspect ratios | Modes |
|---|---|---|---|---|---|
| `bytedance/seedance-2.0-mini` | 0.04 | 480p,720p | 4-15s | 16:9,9:16,1:1,adaptive | t2v,i2v,v2v |
| `bytedance/seedance-2.0-fast` | 0.06 | 480p,720p | 4-15s | 16:9,9:16,1:1,adaptive | t2v,i2v,v2v |
| `bytedance/seedance-2.0` | 0.07 | 480p,720p,1080p,4k | 4-15s | 16:9,9:16,1:1,adaptive | t2v,i2v,v2v |
| `alibaba/wan-2.6` | 0.10 | 720p,1080p | 2-15s | 16:9,9:16,1:1 | t2v,i2v |
| `alibaba/wan-2.7` | 0.10 | 720p,1080p | 2-15s | 16:9,9:16,1:1 | t2v,i2v,v2v |
| `bytedance/seedance-2.5` | 0.11 | 480p,720p,1080p | 4-30s | 21:9,16:9,4:3,1:1,3:4,9:16,adaptive | t2v,i2v,v2v |
| `alibaba/happyhorse-1.0` | 0.13 | 720p,1080p | 3-15s | 16:9,9:16,1:1 | t2v,i2v,v2v |
| `alibaba/happyhorse-1.1` | 0.13 | 720p,1080p | 3-15s | 16:9,9:16,1:1 | t2v,i2v |

Model-page pricing tables (fetched separately, per-resolution tiers the
models endpoint does *not* break out):

- `alibaba/wan-2.7`: 720p $0.10/s, 1080p $0.15/s
- `bytedance/seedance-2.0-mini`: 480p t2v $0.02/s, 480p v2v $0.03/s,
  720p t2v $0.04/s, 720p v2v $0.05/s, all other combinations $0.05/s
- `bytedance/seedance-2.5` (already in `pricing.md`): 480p $0.11/$0.14,
  720p $0.24/$0.30, 1080p $0.48/$0.568 (t2v/v2v)

### Caveat: `output_video_per_second` is NOT a reliable quote

It does not consistently mean "cheapest tier" or "default-resolution tier":

- `seedance-2.5` reports `0.11`, which is its **480p** t2v price, while its
  `default_resolution` is 720p (actual 720p price: $0.24/s).
- `seedance-2.0-mini` reports `0.04`, which is its **720p** t2v price
  (its 480p price is $0.02/s) — and 720p *is* its default resolution.

So the field is safe for **coarse ranking** ("which model is in the cheap
tier") but must not be used to quote a user a number. Precise estimates
still need the per-resolution tier table.

## Three real defects this exposes in `ofox-video.sh` (today, shipped)

The script hardcodes one global validation list instead of deriving limits
per model. Against the live data:

1. **Aspect-ratio list is too permissive.** The script accepts
   `16:9 9:16 1:1 4:3 3:4 3:2 2:3 21:9 9:21 adaptive`. `seedance-2.5`
   actually supports only `21:9 16:9 4:3 1:1 3:4 9:16 adaptive` — so
   `3:2`, `2:3`, and `9:21` pass client-side validation and then get
   rejected by the server, wasting a round trip and surfacing a generic
   `invalid_request` instead of a precise local error.
2. **Duration is only validated for one model.** The script enforces 4-30s
   *only* when `model` is exactly `bytedance/seedance-2.5`. Every other
   model gets no duration check at all, and all 7 have different ranges
   (`wan-*` 2-15s, `happyhorse-*` 3-15s, `seedance-2.0*` 4-15s). E.g.
   `--model alibaba/wan-2.7 --duration 30` passes locally, fails remotely.
3. **Resolution list is both too permissive and too narrow.** The script
   accepts `480p 720p 1080p 1K 2K 4K`. No video model advertises `1K` or
   `2K`; only `seedance-2.0` advertises `4k` (lowercase in the API data,
   vs the script's uppercase `4K`). Meanwhile `wan-*` / `happyhorse-*`
   don't support `480p` at all, and the script would happily send it.

All three are the same root cause and have the same fix: derive validation
from `/v1/models` rather than from a hand-maintained constant.

## Implication for the §3.3 features

- **Multi-model fallback (item 4)** is fully buildable: real model ids,
  real capability ranges, real relative pricing, all fetchable free. The
  cheap→expensive ladder is a genuine 2-5x spread at equal resolution
  (720p t2v: mini $0.04 → wan-2.7 $0.10 → seedance-2.5 $0.24).
- **Gacha / contact sheet (item 5)** gets much cheaper with the ladder:
  drafting 5 takes at 480p on `seedance-2.0-mini` costs 5 x 4s x $0.02 =
  **$0.40**, versus $2.20 for the same 5 takes on `seedance-2.5`. Pick the
  winner, then render the final at 2.5. That is the real "抽卡" workflow
  and it is only possible on an aggregator.
- **Batch cost stats (item 3)** needs no new dependency at all — the script
  already prints `usage.video_cost` per job.

## Sources

- https://ofox.ai/docs/develop/models (endpoint is public, no key)
- https://api.ofox.ai/v1/models (called live, HTTP 200 without a key)
- https://ofox.ai/models/alibaba/wan-2.7
- https://ofox.ai/models/bytedance/seedance-2.0-mini
- https://ofox.ai/docs/api/videos (no models-list endpoint documented there)
