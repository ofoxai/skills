# Changelog

All notable changes to the **product-image** skill. Versioning follows SemVer.

## 1.1.1 — the set-total "quote it as a floor" warning is withdrawn

**Documentation only. No default, flag, question set, prompt template or
command changed.**

1.1.0 told callers that on a large source photo the set total should be
presented as a **floor**, because the 1792x1008 edit anchor was believed to be
missing its output-token count. That premise was wrong — the numbers were
recovered and they close the pricing formula exactly — so the estimate does
not under-quote and never did. A 1792x1008 input now quotes `ROUGH ~$0.0164`
against a real $0.016249.

**What a caller should do instead:** quote the dry run per image and sum it,
exactly as this file already said. The source-size point stands and is worth
keeping for a different reason — **the uploaded picture is the set's cost
lever**, 74% of a large edit's bill, multiplied by N images. Cropping the
source to the target ratio before the first call, which this file already
recommends, cuts every image in the set.

## 1.1.0 — the set claim was run; identity held, framing did not

**Documentation only. No default, flag, question set, prompt template or
command changed.** The `edit` route is still the route, and the "keep"
sentence is still the sentence.

This skill shipped having produced no set of its own; every figure in it was
borrowed. One set was run on 2026-09-17 — three background variants of one
real 1792x1008 product photograph, the `edit` route, one axis varied, one
image plainly on white, about 1.6 cents each — and it both confirmed the claim
the skill exists for and found a limit the file never mentioned.

**Confirmed, and it is the load-bearing one:** the product is the same product
in all three. Wordmark glyph shapes, letter spacing and relative size; the
copper knurl; the two polished rings; the brushed grain; the waist taper — all
identical across the set. Until now that rested on `ofox-image-core` editing a
UI screenshot without disturbing its text, which is a weaker thing.

**What a caller has to do differently:**

- ⚠️ **Do not promise a grid-aligned set.** The "keep" sentence protects
  identity; it does **not** hold the product's scale within the frame. The oak
  image came back visibly larger than the white one and the grey-sweep image
  slightly narrower — nothing cropped or distorted, just a different size in
  frame. `--target-aspect` controls the frame's shape and has nothing to say
  about this, and "do not move or re-frame it" was already in the prompt and
  did not deliver it. Raise it **at the gate**, and plan to normalise scale in
  an editor. A new check step 5 says so under "Check the set before you hand
  it over".
- ⚠️ **On the edit route with a source larger than 854x480, quote the set's
  total as a floor.** Measured: a 1792x1008 input quotes
  `ROUGH UPPER BOUND ~$0.0139` and bills **$0.016249**, because the anchor at
  that input size is missing its output-token count and the estimator falls
  back to a smaller point. Four images, ~5.6 cents quoted against ~6.5 billed.
  Small money in the wrong direction on the number a user says yes to.
  Cropping the source first — already recommended here — shrinks both the gap
  and the bill. Detail in `ofox-image-core` 1.12.0.

Still unmeasured, and the file still says so: the **generate** route has no
set of its own, and three images of one product is not four images of a
catalogue.

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
