#!/usr/bin/env bash
# validation.test.sh — model and parameter validation for ofox-image.sh.
#
# Free by construction: rejected cases exit before any network call, and
# accepted cases are pointed at an unroutable API base so they fail on connect
# instead of generating a billable image.
#
# Run: bash references/test/validation.test.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../ofox-image.sh"

if [ ! -f "$TARGET" ]; then
  echo "FATAL: cannot find ofox-image.sh at $TARGET" >&2
  exit 1
fi

PASS=0
FAIL=0

CACHE_ROOT="$(mktemp -d)"
trap 'rm -rf "$CACHE_ROOT"' EXIT

export XDG_CACHE_HOME="$CACHE_ROOT"
export OFOX_API_KEY="test-key-never-sent-anywhere-real"

offline_base() { export OFOX_API_BASE_URL="http://127.0.0.1:1/v1"; }
online_base() { unset OFOX_API_BASE_URL; }

expect_reject() {
  local want="$1" desc="$2"
  shift 3
  local out code
  out=$(bash "$TARGET" generate "$@" 2>&1)
  code=$?
  if [ "$code" -ne 1 ]; then
    printf 'FAIL  %s\n      expected exit 1 (validation), got %s\n      output: %s\n' \
      "$desc" "$code" "$(printf '%s' "$out" | head -2 | tr '\n' ' ')"
    FAIL=$((FAIL + 1))
    return
  fi
  if ! printf '%s' "$out" | grep -qi -- "$want"; then
    printf 'FAIL  %s\n      exit 1 as expected, but message did not mention %s\n      output: %s\n' \
      "$desc" "$want" "$(printf '%s' "$out" | head -2 | tr '\n' ' ')"
    FAIL=$((FAIL + 1))
    return
  fi
  printf 'ok    %s\n' "$desc"
  PASS=$((PASS + 1))
}

expect_accept() {
  local desc="$1"
  shift 2
  local out code
  out=$(bash "$TARGET" generate "$@" 2>&1)
  code=$?
  if [ "$code" -eq 1 ]; then
    printf 'FAIL  %s\n      validation rejected a model/combination the API supports\n      output: %s\n' \
      "$desc" "$(printf '%s' "$out" | head -2 | tr '\n' ' ')"
    FAIL=$((FAIL + 1))
    return
  fi
  printf 'ok    %s (passed validation, exit %s)\n' "$desc" "$code"
  PASS=$((PASS + 1))
}

# Warm the model cache from the real endpoint (public, keyless, free), then
# point the API base somewhere unroutable. Validation still sees a live model
# list, but a request that passes it dies on connect instead of reaching the
# real generations endpoint. Without this split, every accept case below would
# fire a real request at api.ofox.ai.
warm_cache_then_go_offline() {
  rm -rf "${CACHE_ROOT:?}"/*
  online_base
  env -u OFOX_API_KEY bash "$TARGET" models >/dev/null 2>&1 || true
  offline_base
}

echo "=== Models the API supports are no longer rejected locally ==="
warm_cache_then_go_offline
expect_accept "openai/gpt-image-2 (was hardcoded)" -- \
  --model openai/gpt-image-2 --prompt x --quality high
expect_accept "openai/gpt-image-1.5 (was rejected)" -- \
  --model openai/gpt-image-1.5 --prompt x --quality high
expect_accept "google/gemini-3-pro-image (was rejected)" -- \
  --model google/gemini-3-pro-image --prompt x --quality high
expect_accept "volcengine/doubao-seedream-5.0-pro (was rejected)" -- \
  --model volcengine/doubao-seedream-5.0-pro --prompt x --quality high
expect_accept "microsoft/mai-image-2.5 (was rejected)" -- \
  --model microsoft/mai-image-2.5 --prompt x --quality high

echo
echo "=== Wrong-endpoint and unknown models are still caught ==="
# These reject before any network call, so a live base is safe here.
online_base
expect_reject "image generation" "a video model is rejected for image generation" -- \
  --model bytedance/seedance-2.5 --prompt x --quality high
expect_reject "model" "an unknown model id is rejected when the list is live" -- \
  --model openai/does-not-exist-xyz --prompt x --quality high

echo
echo "=== Offline: unknown ids defer to the API, known ones still validate ==="
rm -rf "${CACHE_ROOT:?}"/*
offline_base
expect_accept "unknown model deferred when only a snapshot is available" -- \
  --model openai/model-newer-than-the-snapshot --prompt x --quality high
out=$(bash "$TARGET" generate --model openai/gpt-image-2 --prompt x --quality high 2>&1)
# Match only the snapshot notice — 'could not reach' would also match the
# connect failure that follows it, which would pass this test for free.
if printf '%s' "$out" | grep -qi 'bundled snapshot'; then
  printf 'ok    falling back to the bundled snapshot is announced, not silent\n'
  PASS=$((PASS + 1))
else
  printf 'FAIL  snapshot fallback must warn on stderr\n      output: %s\n' \
    "$(printf '%s' "$out" | head -3 | tr '\n' ' ')"
  FAIL=$((FAIL + 1))
fi

echo
echo "=== models subcommand ==="
rm -rf "${CACHE_ROOT:?}"/*
online_base
out=$(env -u OFOX_API_KEY bash "$TARGET" models 2>&1)
code=$?
if [ "$code" -eq 0 ] && printf '%s' "$out" | grep -q 'gpt-image-2'; then
  printf 'ok    models lists image models with no API key (endpoint is public)\n'
  PASS=$((PASS + 1))
else
  printf 'FAIL  models should list image models without a key (exit %s)\n      output: %s\n' \
    "$code" "$(printf '%s' "$out" | head -3 | tr '\n' ' ')"
  FAIL=$((FAIL + 1))
fi
if printf '%s' "$out" | grep -q 'seedance-2.5'; then
  printf 'FAIL  models must not list video models\n'
  FAIL=$((FAIL + 1))
else
  printf 'ok    models lists only image models\n'
  PASS=$((PASS + 1))
fi

echo
echo "=== Parameters the API does not describe stay hardcoded and enforced ==="
offline_base
expect_reject "prompt" "--prompt is still required" -- \
  --model openai/gpt-image-2 --quality high
expect_reject "model" "--model is still required" -- \
  --prompt x --quality high
expect_reject "quality" "--quality is still required" -- \
  --model openai/gpt-image-2 --prompt x
expect_reject "quality" "an undocumented --quality is still rejected" -- \
  --model openai/gpt-image-2 --prompt x --quality ultra
expect_reject "size" "an undocumented --size is still rejected" -- \
  --model openai/gpt-image-2 --prompt x --quality high --size 123x456
expect_reject "n" "--n out of range is still rejected" -- \
  --model openai/gpt-image-2 --prompt x --quality high --n 99
expect_reject "n" "--n is still rejected for the model that cannot take it" -- \
  --model google/gemini-3.1-flash-image --prompt x --quality high --n 1

echo
echo "-----------------------------------------"
printf 'passed: %s   failed: %s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
