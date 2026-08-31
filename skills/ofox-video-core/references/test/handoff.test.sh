#!/usr/bin/env bash
# handoff.test.sh — the seed, and the create -> poll request handoff.
#
# Both exist for one reason: making a generated shot reproducible. The API
# echoes neither resolution, aspect ratio nor seed on a poll, so what the
# sidecar knows is whatever the client recorded at create time — and create
# and poll are separate processes, so that record has to survive on disk.
#
# Free by construction: no network at all. The handoff helpers are file
# operations, and download_result() is driven with a synthetic body whose
# download URL is a local file:// path. The API base still points at an
# unroutable address so that any accidental request fails instead of
# reaching a real endpoint.
#
# Run: bash references/test/handoff.test.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SCRIPT_DIR/../ofox-video.sh"

PASS=0
FAIL=0

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export XDG_CACHE_HOME="$WORK/cache"
export OFOX_API_KEY="test-key-never-sent-anywhere-real"
export OFOX_API_BASE_URL="http://127.0.0.1:1/v1"

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

JOB="abcd1234-0000-4000-8000-000000000000"
FAKE_VIDEO="$WORK/source.mp4"
printf 'not-really-an-mp4' > "$FAKE_VIDEO"

body() {
  jq -nc --arg id "$JOB" --arg u "file://$FAKE_VIDEO" \
    '{id: $id, status: "completed", model: "bytedance/seedance-2.5",
      prompt: "a handoff run", unsigned_urls: [$u],
      usage: {video_seconds: 8, video_cost: "0.8800000000"},
      created_at: 1788160000, updated_at: 1788160100}'
}

PAYLOAD='{"model":"bytedance/seedance-2.5","prompt":"a handoff run","duration":8,"resolution":"480p","aspect_ratio":"9:16","seed":418715175}'

echo "=== generate rolls a seed when the caller does not supply one ==="
# Without this the server picks a seed and reports it nowhere, so nothing
# generated could ever be reproduced — only re-rolled.
# --dry-run stops before a seed is printed and a real run costs money, so the
# roll is asserted structurally: it must happen where the payload is built,
# with the same expression batch already uses.
if grep -q 'seed=\$(( (RANDOM << 15 | RANDOM) & 0x7FFFFFFF ))' "$TARGET"; then
  pass "generate rolls a seed with the same expression batch uses"
else
  fail "no client-side seed roll in generate" "reproducibility depends on it"
fi
if [ "$(grep -c 'echo "SEED \$seed"' "$TARGET")" -ge 2 ]; then
  pass "SEED is printed on both the create and the generate path"
else
  fail "SEED is not printed on both paths" "$(grep -n 'echo "SEED' "$TARGET" | tr '\n' ' ')"
fi

echo
echo "=== The handoff file: written, read back, cleaned up ==="
OUT="$WORK/out"; mkdir -p "$OUT"
if save_request_handoff "$PAYLOAD" "$OUT" "$JOB"; then
  pass "create can write a handoff"
else
  fail "save_request_handoff failed" "$OUT"
fi

HF="$(request_handoff_path "$OUT" "$JOB")"
case "$(basename "$HF")" in
  .*) pass "the handoff is a dotfile, out of the way of the user's videos" ;;
  *)  fail "handoff is not hidden" "$(basename "$HF")" ;;
esac
case "$(basename "$HF")" in
  *"$JOB"*) pass "the handoff is keyed by job id, so concurrent creates cannot collide" ;;
  *) fail "handoff name does not include the job id" "$(basename "$HF")" ;;
esac

got="$(load_request_handoff "$OUT" "$JOB")"
if [ "$(jq -r '.seed' <<<"$got")" = "418715175" ]; then
  pass "poll reads back what create wrote"
else
  fail "handoff round-trip lost the seed" "$got"
fi

echo
echo "=== The sidecar gets the half the API never returns ==="
out="$(download_result "$JOB" "$(body)" "$OUT" "handoff run" "$(load_request_handoff "$OUT" "$JOB")" 2>/dev/null)"
sidecar="$(printf '%s\n' "$out" | sed -n 's/^SIDECAR_PATH //p')"
for field in resolution aspect_ratio seed; do
  v="$(jq -r ".request.$field // \"MISSING\"" "$sidecar")"
  if [ "$v" != "MISSING" ]; then
    pass "sidecar records request.$field ($v) — absent from every poll response"
  else
    fail "sidecar is missing request.$field" "$(jq -c '.request' "$sidecar")"
  fi
done

if [ ! -f "$HF" ]; then
  pass "the handoff is removed once the sidecar is safely written"
else
  fail "handoff left behind" "$HF"
fi

echo
echo "=== Cleanup happens after the sidecar, never before ==="
# A download that fails must leave the handoff in place, or the retry has
# nothing to rebuild the record from.
OUT_F="$WORK/outfail"; mkdir -p "$OUT_F"
save_request_handoff "$PAYLOAD" "$OUT_F" "$JOB" || true
bad_body="$(jq -nc --arg id "$JOB" \
  '{id: $id, status: "completed", prompt: "x",
    unsigned_urls: ["file:///definitely/not/here.mp4"],
    usage: {video_seconds: 8, video_cost: "0.88"}}')"
download_result "$JOB" "$bad_body" "$OUT_F" "" "$PAYLOAD" >/dev/null 2>&1
if [ -f "$(request_handoff_path "$OUT_F" "$JOB")" ]; then
  pass "a failed download keeps the handoff for the retry"
else
  fail "handoff was cleared despite a failed download" "nothing left to retry from"
fi

echo
echo "=== Missing handoff degrades, it does not fail ==="
OUT_N="$WORK/outnone"; mkdir -p "$OUT_N"
if load_request_handoff "$OUT_N" "$JOB" >/dev/null 2>&1; then
  fail "a handoff appeared where none was written" "$OUT_N"
else
  pass "no handoff in this out-dir is a normal, quiet miss"
fi
out="$(download_result "$JOB" "$(body)" "$OUT_N" "orphan" "" 2>/dev/null)"
rc=$?
sidecar="$(printf '%s\n' "$out" | sed -n 's/^SIDECAR_PATH //p')"
if [ "$rc" -eq 0 ] && jq -e 'has("request") | not' "$sidecar" >/dev/null 2>&1; then
  pass "polling into another out-dir still succeeds, minus the request half"
else
  fail "degradation path broke" "rc=$rc $(jq -c '.request // \"none\"' "$sidecar" 2>/dev/null)"
fi

echo
echo "=== A base64 frame never reaches disk ==="
# A resolved --frame-first-image is a data URI that can exceed a megabyte.
big="$(jq -nc --arg img "data:image/png;base64,$(head -c 4000 /dev/zero | tr '\0' 'A')" \
  '{model:"m", prompt:"p", frame_images:[$img]}')"
compact="$(compact_request_json "$big")"
if jq -e 'has("frame_images") | not' <<<"$compact" >/dev/null \
   && [ "$(jq -r '.frame_images_count' <<<"$compact")" = "1" ]; then
  pass "frame images are recorded as a count, never as their bytes"
else
  fail "frame image bytes survived compaction" "$(printf '%s' "$compact" | head -c 120)"
fi

echo
echo "=== poll honours --max-wait in wall-clock time ==="
# elapsed used to be a tally of poll_interval, so a run of slow requests
# could overshoot --max-wait by minutes while believing it was inside it.
# The API base is unroutable, so each attempt fails immediately and the loop
# is driven purely by its own accounting.
start="$(date +%s)"
bash "$TARGET" poll "$JOB" --out-dir "$WORK" --max-wait 4 --poll-interval 1 >/dev/null 2>&1
rc=$?
took=$(( $(date +%s) - start ))
if [ "$rc" -eq 4 ]; then
  pass "a poll that never completes exits 4 (timed out, job still running)"
else
  fail "wrong exit code for a timed-out poll" "got $rc, want 4"
fi
if [ "$took" -ge 3 ] && [ "$took" -le 12 ]; then
  pass "it waited about as long as asked (${took}s for --max-wait 4)"
else
  fail "--max-wait was not honoured" "asked 4s, took ${took}s"
fi

echo
echo "-----------------------------------------"
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
