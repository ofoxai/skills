# Pin Seedance jobs to the byteplus upstream, with an explicit provider flag

## Goal

Every scenario skill sends no `provider` field today, so Ofox distributes each
request by weight across the upstreams serving the model — and which one served
any single request is, in Ofox's own words, "not predictable". For
`bytedance/seedance-2.5` that means alternating between BytePlus (ByteDance's
platform for markets outside mainland China) and Volcengine Ark (its mainland
platform), which have **different moderation policies**. Pin it to `byteplus`,
expose an explicit flag for the cases that want otherwise, and map the two
error codes the flag makes reachable.

Scope is Seedance 2.5. Other video models are deliberately not designed for.

## What I already know

Detail in [`research/provider-routing.md`](research/provider-routing.md).
Load-bearing facts, all verified live 2026-08-30:

- Video requests take a top-level `provider` object: `{"provider": {"type":
  "byteplus"}}`. `provider` is in seedance-2.5's `supported_parameters`.
- Default routing is by weight and explicitly unpredictable.
- Measured upstreams for all 8 video models (public keyless endpoint
  `GET /v2/models/catalog/{owner}/{slug}?include=provider_price`):
  **all four `bytedance/seedance-*` are served by `byteplus` + `volcengine`;
  all four `alibaba/*` by `aliyun` alone.** The line falls exactly between the
  two vendors.
- `byteplus` = outside mainland China, "allows not-for-all-audiences content".
  `volcengine` = mainland platform, "standard moderation".
- **Price is identical** across both, verified tier by tier (480p/720p/1080p ×
  t2v/v2v). Pinning is never a cost decision.
- `400 invalid_provider_type` and `400 provider_type_unavailable` are real and
  currently unmapped in `print_error_message` / `api-params.md`.
- `provider_type_unavailable` was once *guessed* for the image script and
  recorded in memory as an unverified invention. Confirmed for **video** only —
  do not retro-fit to `ofox-image.sh`.

## Decisions (from user)

- **Default to `byteplus`** for Seedance: more stable, looser moderation. This
  overrides the "no default" option that was on the table.
- Scope is Seedance 2.5; don't design for the other video models.
- Document that price is identical across upstreams (avoids a reader assuming
  there is money in the choice).
- State the moderation difference **only** in the `output_moderation_failed`
  guidance and the `api-params.md` comparison table. **Not** in any
  `description` or README copy — "looser moderation" is not an outward selling
  point and would read badly to ClawHub's security scan.

## Decisions (mine)

- **Single-upstream models get no entry in the table.** With one upstream,
  weighted routing is already deterministic, so pinning changes nothing and
  only adds a hardcoded fact that can rot — if Alibaba ever gains a second
  upstream, an entry would lock us to a stale choice while an absent one
  follows automatically.
- The default matches `bytedance/seedance-*`, not just `-2.5`. Same one line
  of `case`, same measured fact, zero extra test surface — and it keeps
  `batch`'s cheap-draft workflow (which recommends `seedance-2.0-mini`)
  consistent with the final render, instead of drafting on a random upstream
  and rendering on a pinned one with a different moderation policy.
- **The default path makes no network call.** The measured 4/4 result means a
  prefix rule is already accurate; the catalog endpoint is only consulted for
  explicit `--provider` validation and the `providers` subcommand. If a
  catalog cache happens to be on hand it is used as a cross-check that warns
  and falls back to unpinned, but nothing fetches just for the default.
- The chosen upstream is shown on the existing submit line rather than a new
  one — this is a behavior change (random → fixed) and must be visible without
  adding noise.

## Requirements

1. `--provider SLUG` on `generate`. `batch` needs no change — its passthrough
   already forwards unknown `--key value` pairs.
2. Default `byteplus` for `bytedance/seedance-*`; nothing for anything else.
3. Overrides: `--provider volcengine` (mainland / standard moderation),
   `--provider auto` (send no field, back to weighted routing), and
   `OFOX_VIDEO_PROVIDER` for a persistent default.
4. Validation before any network call: reject a slug outside the documented
   enum; reject a slug that doesn't serve the chosen model when catalog data is
   available, naming the model's real upstreams. Fail open with a warning when
   catalog data can't be had.
5. Map `invalid_provider_type` and `provider_type_unavailable`, both pointing
   at `--provider auto` as the escape hatch.
6. Extend `output_moderation_failed` guidance: the two upstreams moderate
   differently, so retrying on the other one is a real remedy — and a rejected
   job was never billed.
7. `providers [MODEL]` subcommand: the model's upstreams and their pricing.
   Keyless and free, like `models`.
8. `--print-payload`: dump the request body to stderr before sending. Needed to
   test that `provider` really lands in the request; also genuinely useful for
   debugging. The API key lives in a header, never the body, so this leaks
   nothing.
9. Submit line shows the upstream:
   `Submitting job to Ofox (model=..., provider=byteplus)` — or
   `provider=auto (Ofox weighted)` when unpinned.
10. Docs: `api-params.md` (field, upstream comparison table, identical
    pricing, both error codes), core `SKILL.md`, one line in each of the 4
    scenario SKILL.md files, CHANGELOG entry flagging the behavior change.

## Acceptance Criteria

- [ ] `--provider` reaches the request body as `provider.type` (proven via
      `--print-payload`)
- [ ] Seedance defaults to `byteplus` with no flag and no network call
- [ ] `--provider auto` sends no `provider` key at all
- [ ] `OFOX_VIDEO_PROVIDER` sets the default; an explicit flag beats it
- [ ] A slug outside the enum is rejected locally
- [ ] A slug that doesn't serve the model is rejected locally, naming the real
      upstreams
- [ ] A non-Seedance model gets no default provider
- [ ] Both new error codes map to actionable messages naming `--provider auto`
- [ ] `providers` works with no API key
- [ ] Existing suites green, shellcheck clean, zero CJK

## Definition of Done

- All acceptance criteria checked
- CHANGELOG entry + version bump; the behavior change stated plainly
- Committed locally, not pushed

## Out of Scope

- Designing for video models other than Seedance
- `provider.options.<slug>` passthrough (`--extra-json` already covers it)
- Provider handling in `ofox-image.sh`
- Replacing the hardcoded price tables with the catalog matrix (separate debt,
  recorded in the research file)
- Multi-model fallback; any push or publish

## Research References

- [`research/provider-routing.md`](research/provider-routing.md) — the field,
  the unpredictable default, per-model upstream mapping for all 8 video models,
  the byteplus/volcengine difference, identical pricing, the two unmapped error
  codes
