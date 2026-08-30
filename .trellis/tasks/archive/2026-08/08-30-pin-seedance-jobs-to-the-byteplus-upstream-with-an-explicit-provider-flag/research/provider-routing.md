# Research: Ofox upstream provider routing

Verified live 2026-08-30 against the docs and the real API, with
`OFOX_API_KEY` unset where noted.

## The field

Video requests take a top-level `provider` object (chat models nest it under
`extra_body`):

```json
{ "model": "bytedance/seedance-2.5", "provider": { "type": "byteplus" } }
```

Documented keys: `provider.type` (the pin) and `provider.options.<slug>`
(per-provider passthrough; only the matched provider receives its block). No
`sort`/`order`/`fallback`/`allow_fallbacks` keys are documented. `provider`
appears in `seedance-2.5`'s `supported_parameters` in `GET /v1/models`, so it
is real for our models, not chat-only.

## The default is explicitly unpredictable

> "When no `provider` field is sent, ofox distributes the request by weight
> across the channels currently serving that model."

and from the video-specific page:

> "a model served by several providers is distributed by weight across the
> available channels, and which provider serves any single request is not
> predictable."

Every scenario skill currently sends no `provider`, so two identical runs can
land on different upstreams with no way for the user to tell which.

## Which providers serve which model

Discoverable **publicly and keylessly** (verified: `OFOX_API_KEY` unset →
HTTP 200):

```
GET https://api.ofox.ai/v2/models/catalog/{owner}/{slug}?include=provider_price
```

Returns `provider_cards[]`. Measured:

| Model | Providers |
|---|---|
| `bytedance/seedance-2.5` | `byteplus`, `volcengine` |
| `bytedance/seedance-2.0-mini` | `byteplus`, `volcengine` |
| `alibaba/wan-2.7` | `aliyun` only |

**A single-provider model has nothing to choose.** Any default we apply must
not be sent to a model that cannot serve it — that is a `400`.

## The two that matter

| | `volcengine` | `byteplus` |
|---|---|---|
| Platform | Volcengine Ark — ByteDance's **mainland China** platform | BytePlus — ByteDance's platform for **markets outside mainland China** |
| Moderation | "Standard moderation" | "Allows not-for-all-audiences (NSFW) content" |
| Price | identical | identical |

Price verified tier by tier from both `provider_cards` for `seedance-2.5`:
480p/720p/1080p × t2v/v2v match exactly ($0.11/$0.24/$0.48 and
$0.14/$0.30/$0.568). **Pinning is never a cost decision** — it is a region,
reliability and content-policy decision. Docs must say so or a reader will
assume otherwise.

Docs state: "`provider.type: 'byteplus'` must be set explicitly when such
content is required."

## Full provider slug list

`openai`, `anthropic`, `gemini`, `azure_foundry` (alias `foundry`),
`aws_bedrock` (alias `bedrock`), `google_vertex` (alias `vertex`), `aliyun`,
`volcengine`, `byteplus`, `deepseek`, `moonshot`, `zhipu`, `minimax`, `grok`,
`jina`, `tencent`. Only `byteplus`, `volcengine` and `aliyun` are reachable
from the video models we ship on.

## Why this connects to a failure we already map

`ofox-video.sh` maps `output_moderation_failed` — a post-generation job
failure (video was made, output failed a content check; **not billed**).
Today its advice is "submit a new generate call with a different prompt".

Given the moderation column above and unpredictable routing, that advice is
incomplete: the same prompt on a different upstream can have a different
outcome, and the user cannot tell which upstream they got. Naming
`provider.type` there turns retry-and-hope into an actual lever.

## Two error codes we do not map

- `400 invalid_provider_type` — value outside the enum
- `400 provider_type_unavailable` — valid slug that does not serve this model

Neither is in `print_error_message` nor in `api-params.md`'s error table.
Adding a `--provider` flag makes both reachable, so they must be mapped in
the same change.

**History worth respecting**: `provider_type_unavailable` was once *guessed*
from doc prose for the **image** script and recorded in memory as an
unverified invention. It is now confirmed real for the **video** endpoint.
Confirmed for video ≠ confirmed for images — do not retro-fit to
`ofox-image.sh` without its own check.

## Side finding: the price matrix is available programmatically

`provider_cards[].pricing.video_pricing.tiers[]` carries the full
resolution × input_type × price matrix:

```json
{"resolution": "480p", "input_type": "t2v", "price": "0.11"}
```

That is exactly the table hand-copied from model pages into
`references/pricing.md` last round, and the `batch_rate_for` case table that
drives the cost estimate shown to users. Both will silently rot on a price
change. Recorded here; not in this task's scope unless pulled in.

## Sources

- https://ofox.ai/docs/api/videos/provider-routing
- https://ofox.ai/docs/develop/advanced/provider-routing
- https://api.ofox.ai/v2/models/catalog/bytedance/seedance-2.5?include=provider_price (live, keyless, HTTP 200)
- https://api.ofox.ai/v2/models/catalog/alibaba/wan-2.7?include=provider_price
