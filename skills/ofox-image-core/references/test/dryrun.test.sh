#!/usr/bin/env bash
# dryrun.test.sh — pricing an image before spending, and the model chain that
# decides which model gets priced.
#
# Two things are being defended here:
#
#   1. --dry-run really does not send the request. Not "prints a dry-run
#      banner" — actually returns before the POST. The cases below point the
#      API base at an unroutable address, so a leaked request would fail on
#      connect (exit 5) instead of quietly passing.
#   2. The model is resolved to ONE concrete id before the estimate is
#      printed. A quote that names a model the run then swaps out is a user
#      approving a price they were never shown.
#
# Free by construction: no case reaches /v1/images/generations, and the model
# list it does read is public and keyless.
#
# Run: bash references/test/dryrun.test.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../ofox-image.sh"
ANCHORS="$SCRIPT_DIR/../token-anchors.json"
# Captured before the script is sourced as a library further down: sourcing it
# redefines SCRIPT_DIR to wherever the copy lives.
SKILL_MD="$SCRIPT_DIR/../../SKILL.md"

PASS=0
FAIL=0

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export XDG_CACHE_HOME="$WORK/cache"
OUT_DIR="$WORK/out"

offline() { export OFOX_API_BASE_URL="http://127.0.0.1:1/v1"; }
online() { unset OFOX_API_BASE_URL; }

pass() {
  printf 'ok    %s\n' "$1"
  PASS=$((PASS + 1))
}
fail() {
  printf 'FAIL  %s\n      %s\n' "$1" "$2"
  FAIL=$((FAIL + 1))
}

# Warm the model cache from the real, public list, then make the API base
# unroutable. Validation and pricing still see live data; anything that tries
# to generate dies on connect.
warm() {
  online
  env -u OFOX_API_KEY bash "$TARGET" models >/dev/null 2>&1 || true
  offline
}
warm

echo "=== --dry-run quotes and stops there ==="
out=$(env -u OFOX_API_KEY bash "$TARGET" generate --dry-run \
  --prompt "a red apple on a white table" --quality standard --out-dir "$OUT_DIR" 2>&1)
code=$?
if [ "$code" -eq 0 ]; then
  pass "--dry-run exits 0 with no OFOX_API_KEY set (pricing precedes signing up)"
else
  fail "--dry-run should exit 0 without a key" "got $code: $(printf '%s' "$out" | tail -2 | tr '\n' ' ')"
fi
if printf '%s' "$out" | grep -q 'STATUS dry_run'; then
  pass "--dry-run prints STATUS dry_run"
else
  fail "--dry-run must print STATUS dry_run" "$(printf '%s' "$out" | head -3 | tr '\n' ' ')"
fi
n_est=$(printf '%s\n' "$out" | grep -c 'Estimated cost:')
if [ "$n_est" -eq 1 ]; then
  pass "exactly one 'Estimated cost:' line — never silent, never doubled"
else
  fail "expected exactly one 'Estimated cost:' line" "got $n_est"
fi
# The API base is unroutable, so any leaked request would surface as the
# ambiguous-network exit (5) or a connect error in the output.
if printf '%s' "$out" | grep -qi 'could not reach the Ofox API'; then
  fail "--dry-run reached the generations endpoint" "it must return before the POST"
else
  pass "--dry-run makes no generation request (unroutable base, still exit 0)"
fi
if [ -d "$OUT_DIR" ]; then
  pass "--out-dir is still created and checked under a dry run (free to catch)"
else
  fail "--out-dir should be resolved under a dry run" "$OUT_DIR was not created"
fi

echo
echo "=== The estimate names a real model, resolved before it is printed ==="
model_line=$(printf '%s\n' "$out" | sed -n 's/^MODEL //p')
if [ -n "$model_line" ] && [ "$model_line" != "auto" ]; then
  pass "MODEL is a concrete id, not 'auto' ($model_line)"
else
  fail "MODEL must be the resolved id" "got '$model_line'"
fi
if printf '%s' "$out" | grep -q "microsoft/mai-image-2.5-flash"; then
  pass "the default resolves to the chain's cheapest available model"
else
  fail "the preferred model should be chosen when it is available" "got '$model_line'"
fi
explicit=$(env -u OFOX_API_KEY bash "$TARGET" generate --dry-run \
  --model google/gemini-3.1-flash-image --prompt x --quality standard \
  --out-dir "$OUT_DIR" 2>&1)
if printf '%s\n' "$explicit" | grep -q '^MODEL google/gemini-3.1-flash-image$'; then
  pass "--model still pins an explicit id (the chain is a priority, not a lock)"
else
  fail "an explicit --model must win over the chain" "$(printf '%s' "$explicit" | head -3 | tr '\n' ' ')"
fi

echo
echo "=== A rough estimate says it is rough; a missing one says why ==="
if printf '%s' "$explicit" | grep -q 'Estimated cost: ROUGH'; then
  pass "a model with a measured token anchor gets a figure labelled ROUGH"
else
  fail "gemini has a measured anchor and should be priced" \
    "$(printf '%s' "$explicit" | grep -i 'estimated cost' | head -1)"
fi
# 1120 output tokens x $0.00006 = 0.0672, the invoice-anchored figure.
if printf '%s' "$explicit" | grep -q '0\.0672'; then
  pass "the rough figure matches the invoice-anchored calculation (~\$0.0672)"
else
  fail "the gemini estimate should be ~0.0672" \
    "$(printf '%s' "$explicit" | grep -i 'estimated cost' | head -1)"
fi
if printf '%s' "$out" | grep -qi 'cannot be predicted'; then
  pass "an unmeasured model gets 'cannot be predicted' plus the reason"
else
  fail "mai-image-2.5-flash has no anchor yet and must not be priced" \
    "$(printf '%s' "$out" | grep -i 'estimated cost' | head -1)"
fi
# The failure this guards: reusing gemini's 1120 tokens for a model that was
# never measured. Same number, different model, invented.
if printf '%s' "$out" | grep -q '1120'; then
  fail "an unmeasured model borrowed another model's token count" \
    "a borrowed number looks exactly like a measured one"
else
  pass "no anchor is borrowed across models"
fi

echo
echo "=== Fallback down the chain is reported, not silent ==="
# Resolution is exercised against synthetic model lists rather than the live
# one: every skip reason has to be reproducible on demand, and none of them
# is something the real catalog can be asked to produce today. Setting
# MODELS_FILE short-circuits load_models, which is idempotent by design.
LIB="$WORK/lib.sh"
sed -e '/^main "\$@"$/d' -e '/^exit \$?$/d' "$TARGET" >"$LIB"
# shellcheck source=/dev/null
. "$LIB"

# shellcheck disable=SC2034  # read by resolve_model from the sourced script
MODELS_FILE="$WORK/synthetic.json"
jq -nc '{data:[
  {id:"fake/gone",
   supported_endpoints:["/v1/images/generations"],
   pricing:{prompt:"0.0000005", output_image:"0.00002"}},
  {id:"fake/deprecated", is_deprecated:true,
   supported_endpoints:["/v1/images/generations"],
   pricing:{prompt:"0.0000005", output_image:"0.00002"}},
  {id:"fake/videoonly",
   supported_endpoints:["/v1/videos"],
   pricing:{prompt:"0.0000005"}},
  {id:"fake/usable",
   supported_endpoints:["/v1/images/generations"],
   pricing:{prompt:"0.0000005", output_image:"0.00006"}},
  {id:"fake/unpriced",
   supported_endpoints:["/v1/images/generations"],
   pricing:{prompt:"0.0000005"}}]}' >"$MODELS_FILE"

check_fallback() { # <chain> <expected model> <expected reason substring> <desc>
  # shellcheck disable=SC2034  # read by resolve_model from the sourced script
  MODEL_CHAIN="$1"
  resolve_model 2>/dev/null
  if [ "$RESOLVED_MODEL" != "$2" ]; then
    fail "$4" "expected '$2', got '$RESOLVED_MODEL'"
    return
  fi
  case "$MODEL_FALLBACK_REASON" in
    *"$3"*) : ;;
    *)
      fail "$4" "reason should mention '$3', got '$MODEL_FALLBACK_REASON'"
      return
      ;;
  esac
  if [ -z "$MODEL_FALLBACK_FROM" ] || [ -z "$MODEL_PRICE_DELTA" ]; then
    fail "$4" "a fallback must report what was skipped and the price difference"
    return
  fi
  pass "$4"
}

check_fallback "no/such-model fake/usable" "fake/usable" "not in the Ofox model list" \
  "a preferred model missing from the list falls through, and says so"
check_fallback "fake/videoonly fake/usable" "fake/usable" "does not serve /v1/images/generations" \
  "a model that does not do image generation falls through, and says so"
check_fallback "fake/deprecated fake/usable" "fake/usable" "deprecated" \
  "a deprecated preferred model falls through, and says so"

# Both rates known: the delta has to be a real multiple, not "unknown". This
# is the number an approval table needs — "we fell back" without "and it costs
# 3x more" is not enough to approve.
case "$MODEL_PRICE_DELTA" in
  3.00x*) pass "the price gap is quantified when both rates are known ($MODEL_PRICE_DELTA)" ;;
  *) fail "expected a 3.00x price delta" "got '$MODEL_PRICE_DELTA'" ;;
esac

# shellcheck disable=SC2034  # read by resolve_model from the sourced script
MODEL_CHAIN="fake/usable no/such-model"
resolve_model 2>/dev/null
if [ "$RESOLVED_MODEL" = "fake/usable" ] && [ -z "$MODEL_FALLBACK_FROM" ]; then
  pass "no fallback is reported when the preferred model is fine"
else
  fail "a healthy preferred model must not look like a fallback" \
    "model='$RESOLVED_MODEL' from='$MODEL_FALLBACK_FROM'"
fi

# When a rate is missing, the message has to name the side that is actually
# missing it. The first version of this blamed the preferred model in every
# case and added "which is part of why it was skipped" — a causal claim
# resolve_model cannot make, since it never looks at pricing when deciding
# what to skip. A wrong reason in an approval table is worse than no reason.
# shellcheck disable=SC2034  # read by resolve_model from the sourced script
MODEL_CHAIN="fake/deprecated fake/unpriced"
resolve_model 2>/dev/null
case "$MODEL_PRICE_DELTA" in
  *"no published output_image rate for 'fake/unpriced'"*)
    pass "an unpriced *chosen* model is named as the unpriced one, not the preferred"
    ;;
  *) fail "the price delta blamed the wrong model" "got '$MODEL_PRICE_DELTA'" ;;
esac
case "$MODEL_PRICE_DELTA" in
  *"part of why it was skipped"*)
    fail "the price delta still claims a missing rate caused the skip" \
      "resolve_model never looks at pricing when deciding what to skip"
    ;;
  *) pass "no invented causal claim about why the model was skipped" ;;
esac

# Nothing was fallen back TO here, so the fallback lines must stay silent —
# but the reason must still reach the caller, because the model about to be
# quoted is one the script already knows is broken.
# shellcheck disable=SC2034  # read by resolve_model from the sourced script
MODEL_CHAIN="fake/deprecated"
resolve_model 2>/dev/null
if [ -z "$MODEL_FALLBACK_FROM" ] && [ -n "$MODEL_CHAIN_EXHAUSTED" ]; then
  pass "an exhausted chain reports MODEL_CHAIN_EXHAUSTED, not a phantom fallback"
else
  fail "an exhausted chain must surface its reason" \
    "from='$MODEL_FALLBACK_FROM' exhausted='$MODEL_CHAIN_EXHAUSTED'"
fi
# shellcheck disable=SC2034  # read by resolve_model from the sourced script
MODEL_CHAIN="fake/usable"
resolve_model 2>/dev/null
if [ -z "$MODEL_CHAIN_EXHAUSTED" ]; then
  pass "a later healthy resolve clears the exhausted flag (no stale warning)"
else
  fail "MODEL_CHAIN_EXHAUSTED leaked into a healthy resolve" "got '$MODEL_CHAIN_EXHAUSTED'"
fi

echo
echo "=== The anchor file is the single source of the estimate ==="
if jq -e '.anchors | length > 0' "$ANCHORS" >/dev/null 2>&1; then
  pass "token-anchors.json is valid JSON with at least one entry"
else
  fail "token-anchors.json must be valid JSON" "jq could not read $ANCHORS"
fi
if [ "$(jq -r '.anchors["google/gemini-3.1-flash-image"].output_tokens' "$ANCHORS")" = "1120" ]; then
  pass "the measured gemini anchor is the 1120 tokens the invoice was based on"
else
  fail "the gemini anchor drifted from the measured call" \
    "references/pricing.md records 1120 output tokens"
fi
unmeasured=$(jq -r '[.anchors | to_entries[] | select(.value.output_tokens == null) | .key] | join(" ")' "$ANCHORS")
case "$unmeasured" in
  *mai-image-2.5-flash*gpt-image-2* | *gpt-image-2*mai-image-2.5-flash*)
    pass "the two chain models still awaiting a real measurement are marked null, not guessed"
    ;;
  "") pass "every model in the anchor file has been measured" ;;
  *) fail "unexpected set of unmeasured anchors" "got '$unmeasured'" ;;
esac

echo
echo "=== SKILL.md's chain table matches the chain the script actually uses ==="
# The chain has one definition (MODEL_CHAIN) and one explanation (the table in
# SKILL.md). The explanation is the part that can quietly stop being true, and
# a doc asserting a priority order the code no longer has is worse than no
# doc. Compare the ids and their order, not the prose around them.
doc_chain=$(sed -n 's/^| [0-9] | `\([^`]*\)`.*/\1/p' "$SKILL_MD" | tr '\n' ' ')
code_chain=$(sed -n 's/^MODEL_CHAIN="\(.*\)"$/\1/p' "$TARGET")
if [ "$(echo "$doc_chain" | xargs)" = "$(echo "$code_chain" | xargs)" ]; then
  pass "the documented chain is the real chain, in the same order"
else
  fail "SKILL.md's chain table has drifted from MODEL_CHAIN" \
    "doc: '$doc_chain' / code: '$code_chain'"
fi

echo
echo "-----------------------------------------"
printf 'passed: %s   failed: %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
