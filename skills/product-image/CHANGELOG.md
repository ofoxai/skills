# Changelog

All notable changes to the **product-image** skill. Versioning follows SemVer.

## 1.0.0 — first release

The second of two **image** scenario skills added on 2026-09-15, and the one
about sets. It delegates to `ofox-image-core` rather than `ofox-video-core`,
which every scenario skill before these two did.

**The multi-output route was established by asking the API, not assumed** —
that was the one open question this skill was not allowed to guess at, and it
came apart into three answers.

- **A style set is N calls whatever else is true.** The request body carries
  exactly one `prompt` field and there is no per-image prompt on either
  endpoint, so four styles is four instructions. That is the field list, not
  an inference about the model.
- **`--n` returns N distinct results, and its tokens scale linearly.** Two
  probe calls on 2026-09-15 against `openai/gpt-image-2`, about 3 cents
  together: `generate --n 2` returned 391 output tokens against a 196-token
  n=1 anchor (2x = 392), and `edit --n 2` returned 458 against exactly 2x229.
  The script's own dry run had said this "has never been measured on either
  endpoint"; now it has, at n=2, on one model.
- **`--n` is not a discount.** The edit probe's *input image* tokens came back
  as 512 = exactly 2 x 256, so the uploaded picture bills once per output
  image rather than once per call. One call at `--n 4` and four separate calls
  cost the same to within the measurement.

So the default is **N separate calls**, chosen on what the set needs rather
than on price: a different instruction per image, the ability to stop after
the first one is wrong, and independent re-rolls of a single miss.

**Cost is quoted as the set's total, itemised one row per image** — the same
rule `shorts-reels` follows for video batches, and for the same reason: if one
image in four is usable, that image cost the whole total, and the per-image
figure understates it by 4x. The skill dry-runs every image rather than one of
them, because "the four estimates are usually the same" is not a basis for a
price a user is approving.

**`--quality` on the generate route is a stated default, not a caller's guess
— because it moves the set's total by more than an order of magnitude.** It is
required on `generate` (and only there), and a blind test of an earlier draft
picked `high` and surfaced what that does to the quote. Both figures are what
`--dry-run` printed on 2026-09-15 for four images at `--size 1024x1024` on
`openai/gpt-image-2`, free and keyless:

- `low` → ROUGH ~0.59 cents each, **~2.4 cents for the set**, resting on an
  anchor **measured at that exact pair**;
- `medium` or `high` → ROUGH **UPPER BOUND** ~15.19 cents each, **~61 cents
  for the set**, because nothing has been measured at either pair and the gate
  falls back to the dearest of the model's two measured points as a ceiling.

**The 26x is a spread in the quote, not a measured spread in the bill**, and
the skill says so in those words: at the dearer values the number is a bound,
and the real cost could land well under it. The default is `low` because the
generate route only exists for a product with no photo, so the set is style
proposals rather than final artwork. If the user says the renders *are* the
deliverable, the choice goes back to them as **two priced rows in the cost
table** — the one place in this skill where the table carries options instead
of a single total.

**The source file is opened and confirmed before it is trusted.** A path in a
request answers "is there a file"; only looking answers "is it the product".
This is in the skill because the edit route does not fail on a wrong source —
it succeeds, and returns four well-executed, correctly-billed images of the
wrong thing. The written rule names the three legitimate exits (ask for the
right file; proceed on the generate route only if the user confirms there is
no photo; stop) and the three wrong ones, including silently switching routes
and the tempting one of generating a reference image to edit instead.

**The photo question comes first, and it is a routing decision with a
measurement behind it.** One probe call returned two renders of a single mug
prompt that are visibly different mugs — different proportions, scale and
light. For "give me two options" that variety is the product; for a listing it
is the defect, because a shopper compares every image in a set against the
same physical item. So a real product means the edit route, where every image
starts from the same source file; a fictional or generic one may go text-only
with the expectation stated. That is the same split
`seedance-product-video` arrived at independently for video.

**Generating a reference image and then editing it is ruled out**, carrying
`seedance-product-video`'s reasoning unchanged: a generated image can be wrong
about the label, the cap and the proportions in exactly the ways the set can,
and then locks those errors into every image in it.

**The "keep" sentence is byte-identical across all four prompts**, and only
the setting sentence varies. It is the thing standing between a set of options
and four pictures of four slightly different products.

**No model, price or `n`-support table.** Edit support is `models --endpoint
edits`; which models take `n` is the catalog's own
`image_attributes.supported_params`, with the command to read it written out.
Recorded as of 2026-09-15 for context only: `n` was advertised by four of the
sixteen image models, the four Gemini models carry the list and omit it, and
the other eight have no `image_attributes` block at all — three states rather
than two, which is why the documented query distinguishes them. With the
caveat that the field is generations-shaped and says nothing about the edits
endpoint.

**This skill has produced no set of its own.** Every figure names the run it
came from — `ofox-image-core`'s own work building `edit`, or the two probe
calls above, made directly against `ofox-image.sh`. None came through this
skill's flow.

**Routing is explicit in six directions**: `image-edit` for one change to one
image, `seedance-product-video` and `seedance-ad-creative` when the
deliverable is video (with a note that an attached image forces the clip's
ratio, so the crop decision belongs there), `ofox-image-core` for a single
plain render or low-level API work, `seedance-anime-drama` for character
images inside its own flow, and `hal-image` when the change has to be exact
rather than generative.
