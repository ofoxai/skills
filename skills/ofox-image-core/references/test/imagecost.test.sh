#!/usr/bin/env bash
# imagecost.test.sh — the computed dollar cost of an image generation.
#
# The image endpoint returns no cost of its own, and Ofox exposes no billing
# endpoint to look one up (every /v1 and /v2 usage, billing, credits, account
# and balance path answers 404). So the figure is computed here from the
# published rates and the response's own token counts, and the only thing
# that makes it trustworthy is that it was checked against a real invoice.
#
# The anchor case below is that invoice: a call reporting input_tokens=79,
# output_tokens=1120 was billed $0.06723950 on 2026-08-31. It settles a
# question the model page could not — whether image output tokens bill at
# $60/M or $3/M, a 20x difference. If this case ever stops matching, the
# formula has drifted from what is actually charged, and the skill is
# quoting fiction.
#
# Free by construction: rates come from the public, keyless model list (or
# the bundled snapshot when offline), and nothing here submits a request.
#
# Run: bash references/test/imagecost.test.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../ofox-image.sh"

PASS=0
FAIL=0

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export XDG_CACHE_HOME="$WORK/cache"
export OFOX_API_KEY="test-key-never-sent-anywhere-real"

pass() {
  printf 'ok    %s\n' "$1"
  PASS=$((PASS + 1))
}
fail() {
  printf 'FAIL  %s\n      %s\n' "$1" "$2"
  FAIL=$((FAIL + 1))
}

LIB="$WORK/lib.sh"
sed -e '/^main "\$@"$/d' -e '/^exit \$?$/d' "$TARGET" > "$LIB"
# shellcheck source=/dev/null
. "$LIB"

load_models >/dev/null 2>&1 || true
if [ -z "${MODELS_FILE:-}" ]; then
  echo "FAIL  no model list available (live, cache or snapshot) — cannot price anything"
  exit 1
fi
echo "rates from: $MODELS_SOURCE"
echo

GEMINI="google/gemini-3.1-flash-image"

echo "=== The invoice this formula is anchored to ==="
got="$(image_cost_for "$GEMINI" 79 1120)"
if [ "$got" = "0.0672395" ]; then
  pass "in=79 out=1120 -> $got, matching the \$0.06723950 invoice line"
else
  fail "the anchor case no longer matches the real invoice" \
    "want 0.0672395, got '$got' — the charged rate may have changed"
fi

got="$(image_cost_for "$GEMINI" 51 1120)"
if [ "$got" = "0.0672255" ]; then
  pass "in=51 out=1120 -> $got (same batch, same formula)"
else
  fail "second real call priced wrong" "want 0.0672255, got '$got'"
fi


echo
echo "=== Rates are per model, not hardcoded to one ==="
gpt="$(image_cost_for "openai/gpt-image-2" 79 1120 2>/dev/null || true)"
if [ -n "$gpt" ] && [ "$gpt" != "$(image_cost_for "$GEMINI" 79 1120)" ]; then
  pass "a different model prices differently ($gpt vs 0.0672395)"
elif [ -z "$gpt" ]; then
  pass "a model without published rates yields no figure (rather than a guess)"
else
  fail "every model returns the same number" "rates look hardcoded"
fi

echo
echo "=== It refuses rather than guessing ==="
if image_cost_for "no/such-model" 79 1120 >/dev/null 2>&1; then
  fail "an unknown model produced a price" "a made-up cost is worse than none"
else
  pass "an unknown model yields nothing, so the caller says why"
fi
if image_cost_for "$GEMINI" "abc" 1120 >/dev/null 2>&1; then
  fail "non-numeric tokens produced a price" "input was not validated"
else
  pass "non-numeric token counts are refused"
fi
if [ "$(image_cost_for "$GEMINI" 0 0)" = "0" ]; then
  pass "zero tokens cost zero"
else
  fail "zero tokens priced oddly" "$(image_cost_for "$GEMINI" 0 0)"
fi

echo
echo "=== Both spellings of the rate keys are accepted ==="
# /v1/models calls them prompt/completion; /v2/models/catalog calls them
# input/output. The script loads the v1 list, so handling only the catalog
# spelling silently produced no cost at all. Both are exercised against a
# synthetic list rather than by reading the source, so a refactor that keeps
# the behaviour keeps the test passing.
synthetic() { # <input-key> <output-image-value>
  jq -nc --arg ik "$1" --arg oi "$2" \
    '{data:[{id:"fake/model", pricing:{($ik):"0.0000005", output_image:$oi}}]}'
}

for spelling in prompt input; do
  MODELS_FILE="$WORK/models-$spelling.json"
  synthetic "$spelling" "0.00006" > "$MODELS_FILE"
  got="$(image_cost_for "fake/model" 79 1120)"
  if [ "$got" = "0.0672395" ]; then
    pass "a list using '$spelling' for the input rate prices correctly"
  else
    fail "'$spelling' spelling yielded no usable cost" "got '$got'"
  fi
done

# And a list with neither spelling must yield nothing rather than a partial
# figure computed from the output rate alone.
MODELS_FILE="$WORK/models-none.json"
jq -nc '{data:[{id:"fake/model", pricing:{output_image:"0.00006"}}]}' > "$MODELS_FILE"
if image_cost_for "fake/model" 79 1120 >/dev/null 2>&1; then
  fail "priced a model with no input rate" "a partial cost is still a wrong cost"
else
  pass "a missing input rate yields no figure, not a partial one"
fi

echo
echo "-----------------------------------------"
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
