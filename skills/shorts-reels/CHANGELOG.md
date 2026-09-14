# Changelog

All notable changes to the **shorts-reels** skill. Versioning follows SemVer.

## 1.0.0 — first release

A scenario skill for short-form social raw material: several cheap vertical
9:16 drafts in one priced batch, a contact sheet to pick from, then a single
re-render of whichever take earned it. A thin layer over `ofox-video-core`'s
existing `batch --takes N` rather than new machinery.

**It owns format and economics, not prompt craft**, and says so in its second
section. A vertical draft is still a clip of something, and the prompt for it
belongs to whichever scenario fits — `ugc-ads`, `seedance-ad-creative`,
`seedance-short-drama`, `seedance-product-video`, `seedance-anime-drama`. The
skill routes there explicitly rather than growing a fifth template.

**Ambient / mood b-roll has a row of its own, because no scenario skill owns
it.** A clip with no product, no people and no beat — rain on a window, steam
off a cup, a city at dusk — is high-frequency in short-form and falls through
every scenario skill's description. Left unrouted it gets improvised from the
ad template, which arrives with a hook, a showcase and a hero freeze bolted
onto something that has nothing to show. The row sends it straight to the
shared `prompt-structure.md` — the vendor's four-sentence formula, the style
anchor, the camera language — which is scenario-neutral by construction.

**"Five clips" is ambiguous, and settling it is the first must-ask.** Five
takes of one idea is `batch --takes 5` — one estimate, one contact sheet, five
seeds. Five *different* clips is five `create` calls and one multi-id `poll`,
which is a different command, a different cost shape and a different output.
Picking wrong spends money on the wrong shape of deliverable and no amount of
prompt quality recovers it, so the skill asks before drafting and documents
both routes.

**No price table, on purpose, with three reasons.** Prices are catalog facts
that move; which model is cheapest depends on the resolution tier; and at
least one video model in this catalog is priced differently on its two
upstream providers, so even "model X costs Y" is underspecified without naming
the provider. What the skill ships instead is a **reproducible comparison
ritual**: two dry runs — the draft set on the cheap model and one flagship
clip — shown side by side as they print. That argument stays true when the
catalog changes.

**The one measured anchor is quoted with its parameters**: `ofox-video-core`'s
batch path verified at 3 takes of `bytedance/seedance-2.0-mini`, 480p, 4
seconds, 24 cents total, exactly matching its estimate, contact sheet
rendered. That is a measurement of the mechanism — estimate matches bill —
and the skill states that it is not a quote for any other combination and that
this scenario has no paid run of its own beyond it.

⚠️ **There is no "Seedance 2.5 Fast".** Planning notes that name it are wrong;
no such id exists in the catalog. The skill says so where a model gets chosen
and points at `models` as the authoritative list.

⚠️ **`providers` takes a model argument, and without one it prints the
flagship's matrix rather than the catalog** — the most expensive model's rates,
read while believing you are shopping for the cheapest. This skill is the one
where that mistake costs the most, so it spells out the two-step: `models` to
shortlist, `providers MODEL` to quote. The `models` column is also the rate at
each model's *own* default resolution, so a model can rank worse there and
still be the cheapest at the tier you are actually drafting on.

Also in this release:

- **When to step up to a dearer model, split by *why* the draft was
  rejected** — fidelity, detail that has to survive, publication, or a
  duration/resolution ceiling the budget model can't reach are reasons to
  promote; a beat that didn't happen, a camera that didn't move, or every take
  failing the same way are prompt problems that a dearer model renders more
  expensively. Plus the non-reason: moderation policy is per-model, so a model
  change can be a route rather than a downgrade.
- **The seed's boundaries, stated three ways.** The prompt must be
  byte-identical (measured: same seed, one paragraph reworded, visibly
  different subjects), so the promotion reads its prompt back out of the
  sidecar; the seed is not a handle for "that one, but fix the third beat";
  and across two different models a promotion is a re-roll of the same idea,
  not the same clip at higher fidelity — nothing in this repo has measured a
  seed carrying a take across models.
- **Batch mechanics relayed rather than reinvented**: stop on first rejected
  create, a post-submission failure not stopping the others, `batch_partial`
  and the `TAKES_*` counters, concurrent waiting at the default 4, the
  `--takes` cap of 10, and the resume command `batch` prints instead of a
  second `batch`.
- **Contact-sheet honesty.** Three thumbnails per take answer composition,
  look and whether the beat happened; they do not answer fine detail or
  legibility. Open the take, or re-tile one clip with `contact-sheet` for
  free.
- **Two approvals, not one.** The draft round gets an itemised table quoting
  `BATCH_COST_TOTAL` (never `BATCH_COST_PER_TAKE`); the promotion gets its own
  table later, because which take wins — or whether any does — isn't known at
  the first gate.
- **Vertical is checked, not assumed.** Aspect-ratio lists differ per model
  and the budget models' are shorter, so the skill reads `models` before
  picking; and with a frame attached the ratio follows the image, so crop to
  9:16 first — crop, never pad.
- **Duration is named as the multiplier that hurts most**, since it applies to
  every take in the set.
- **The core-directory probe ships from day one**, so the skill works on
  LobeHub's `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.

**What a caller has to do**: install `ofox-video-core` beside this skill, and
at least one scenario skill to write the prompt with. `npx ofox-skills`
installs every skill in this repo, which is what keeps the sibling paths
resolvable. `ffmpeg` is optional — without it the contact sheet is skipped
with a reason and the videos are untouched.
