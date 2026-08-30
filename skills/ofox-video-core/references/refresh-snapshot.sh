#!/usr/bin/env bash
# refresh-snapshot.sh — regenerate models-snapshot.json from the live API.
#
# models-snapshot.json is the offline fallback ofox-video.sh validates against
# when GET /v1/models can't be reached. It goes stale as Ofox adds models or
# changes limits, so refresh it whenever you touch this skill.
#
# Needs no API key (the models endpoint is public). Run:
#   bash references/refresh-snapshot.sh

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_BASE="${OFOX_API_BASE_URL:-https://api.ofox.ai/v1}"
OUT="$SCRIPT_DIR/models-snapshot.json"

for bin in curl jq; do
  command -v "$bin" >/dev/null || { echo "ERROR: $bin is required." >&2; exit 2; }
done

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -fsS --max-time 20 "$API_BASE/models" -o "$tmp"
jq -e '(.data | length) > 0' "$tmp" >/dev/null

jq --arg date "$(date -u +%Y-%m-%d)" '{
  _snapshot_note: "Offline fallback only. ofox-video.sh fetches the live list from GET /v1/models (public, no API key) and only reads this file when that fetch fails. Regenerate with: references/refresh-snapshot.sh",
  _snapshot_date: $date,
  object: "list",
  data: [ .data[]
    | select(.supported_endpoints[]? == "/v1/videos")
    | {id, is_deprecated, expiration_date,
       pricing: {output_video_per_second: .pricing.output_video_per_second},
       supported_endpoints, video_attributes}
  ]
}' "$tmp" > "$OUT"

printf 'wrote %s (%s video models, %s bytes)\n' \
  "$OUT" "$(jq '.data | length' "$OUT")" "$(wc -c < "$OUT" | tr -d ' ')"
