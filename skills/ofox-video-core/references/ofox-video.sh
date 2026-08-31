#!/usr/bin/env bash
# ofox-video.sh — Ofox video generation API client: create, poll, download.
#
# Part of the ofox-video-core skill. Dependencies: bash, curl, jq. Nothing else.
#
# OFOX_API_KEY is read ONLY from the shell environment (never from a dotenv
# file, never hardcoded). The raw key is never printed by this script.
#
# Usage:
#   ofox-video.sh check
#   ofox-video.sh models
#   ofox-video.sh providers [MODEL]   (local/public, no API key)
#   ofox-video.sh generate --prompt "..." [OPTIONS]
#   ofox-video.sh create --prompt "..." [OPTIONS]  (submit only, no waiting)
#   ofox-video.sh batch --prompt "..." --takes N [OPTIONS]
#   ofox-video.sh poll JOB_ID [--out-dir DIR] [--max-wait SECONDS] [--poll-interval SECONDS]
#   ofox-video.sh chain --shot "..." --shot "..." [OPTIONS]
#   ofox-video.sh contact-sheet VIDEO [VIDEO...] [--out-dir DIR]  (local, no API call)
#   ofox-video.sh last-frame VIDEO [--out-dir DIR]                (local, no API call)
#
# generate OPTIONS:
#   --model NAME              default: bytedance/seedance-2.5. This skill has a
#                               default because every scenario built on it
#                               targets Seedance 2.5 specifically; the sibling
#                               ofox-image-core deliberately has none, because
#                               its models differ ~4x in price with no obvious
#                               winner. Run 'models' to see the alternatives —
#                               seedance-2.0-mini is ~5x cheaper for drafts.
#   --prompt TEXT             required
#   --duration N               seconds. Validated against the chosen model's
#                               own range (Seedance 2.5: 4-30, Wan 2.x: 2-15,
#                               HappyHorse: 3-15, Seedance 2.0*: 4-15).
#   --resolution VAL            validated per model, e.g. 480p | 720p | 1080p
#                               for Seedance 2.5; 720p | 1080p for Wan 2.x.
#                               Run 'ofox-video.sh models' to see each one.
#   --aspect-ratio VAL          validated per model, e.g. 21:9 | 16:9 | 4:3 |
#                               1:1 | 3:4 | 9:16 | adaptive for Seedance 2.5;
#                               16:9 | 9:16 | 1:1 for Wan 2.x.
#   --provider SLUG             pin the upstream. Defaults to byteplus for
#                               bytedance/seedance-* (Ofox otherwise routes by
#                               weight and which upstream serves a request is
#                               not predictable). 'auto' sends no pin. Also
#                               settable via OFOX_VIDEO_PROVIDER. Pricing is
#                               identical across upstreams — this is a region
#                               and moderation choice, not a cost one.
#   --dry-run                   validate, resolve the provider, build the
#                               payload and print the cost estimate, then stop
#                               WITHOUT submitting. Nothing is billed. Use this
#                               to quote a price to someone before spending.
#   --print-payload             dump the request body to stderr before sending
#                               (the API key is in a header, not the body)
#   --size WxH                  e.g. 1280x720 (alternative to --resolution)
#   --generate-audio true|false default: true (server-side default)
#   --seed N
#   --frame-first-image URL|PATH image-to-video: first frame. Accepts a remote
#                               http(s):// URL (used as-is) or a local,
#                               readable file path (base64-encoded into a
#                               data: URI automatically). NOTE: for
#                               bytedance/seedance-2.5 (the default model),
#                               attaching any frame image forces
#                               aspect_ratio=adaptive regardless of
#                               --aspect-ratio — a visible notice is printed
#                               when this happens, it is never silent.
#   --frame-last-image URL|PATH  image-to-video: last frame (same URL/local
#                               file support and adaptive-override behavior)
#   --real-person true|false
#   --callback-url URL          must be https://
#   --extra-json JSON           merged into the request body as-is (advanced:
#                               input_references, provider, etc.)
#   --out-dir DIR                default: current directory
#   --max-wait SECONDS           default: 540 (9 minutes)
#   --poll-interval SECONDS      default: 6
#
# Exit codes:
#   0  success — job completed, video downloaded
#   1  usage / parameter validation error (no network call made)
#   2  environment error (missing curl/jq/OFOX_API_KEY)
#   3  API rejected the request, or the job ended failed/cancelled/expired
#   4  timed out waiting for a terminal state — the job is still running
#      upstream. Re-run: ofox-video.sh poll JOB_ID
#      Do NOT re-run 'generate' for the same request — that creates a
#      duplicate, separately billed job.
#   5  the create call had an ambiguous network failure (no HTTP response was
#      received at all). We cannot tell whether the job was created
#      server-side. Do not auto-retry create — check https://app.ofox.ai
#      first, then retry manually only if nothing was created.
#   6  --out-dir could not be created or entered (bad path, permissions).
#      This is a local filesystem problem, not an API problem — if it
#      happened during 'generate', the job may already exist server-side
#      (or still be running). Do NOT re-run 'generate'; fix --out-dir and
#      re-run: ofox-video.sh poll JOB_ID --out-dir <a writable directory>
#
# No-resubmit rule: once a create call gets a response (any HTTP status),
# this script never issues a second create call for the same invocation. If
# polling is slow, times out, or a poll request itself errors, the fix is to
# retry the POLL, never the CREATE. See the 'poll' subcommand.

set -u

API_BASE="${OFOX_API_BASE_URL:-https://api.ofox.ai/v1}"
GET_KEY_URL="https://app.ofox.ai"
DEFAULT_MODEL="bytedance/seedance-2.5"
DEFAULT_MAX_WAIT=540
DEFAULT_POLL_INTERVAL=6

# Cap for the readable part of an output filename, counted in Unicode
# codepoints (not bytes). 24 CJK characters is 72 UTF-8 bytes, which leaves
# the whole name — slug, '-', 8 hex of job id, extension — far below the
# 255-byte limit every filesystem this runs on enforces.
SLUG_MAX_CHARS=24

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_SNAPSHOT="$SCRIPT_DIR/models-snapshot.json"
PRICING_SNAPSHOT="$SCRIPT_DIR/pricing-snapshot.json"
MODELS_CACHE_TTL="${OFOX_MODELS_TTL:-86400}" # 24h

# Fallback only. Per-model limits come from GET /v1/models; these unions of
# every video model's advertised values are used when that list is
# unavailable, so a valid request is never blocked by a missing model list.
VALID_RESOLUTIONS="480p 720p 1080p 4k"
VALID_ASPECT_RATIOS="21:9 16:9 4:3 1:1 3:4 9:16 adaptive"

# Set by load_models(): the file holding the model list, and where it came
# from ("live" | "cache" | "stale-cache" | "snapshot").
MODELS_FILE=""
MODELS_SOURCE=""

# Upstream providers. Ofox routes a multi-upstream model by weight and says
# outright that "which provider serves any single request is not predictable".
# For Seedance that alternates between BytePlus (outside mainland China) and
# Volcengine Ark (mainland), which moderate differently — so the same prompt
# can pass one run and be rejected the next with nothing to point at.
#
# Measured 2026-08-30 via the public catalog endpoint: all four
# bytedance/seedance-* are served by byteplus + volcengine; all four alibaba/*
# by aliyun alone. We pin Seedance to byteplus and leave everything else alone:
# with a single upstream, weighted routing is already deterministic, so pinning
# would change nothing while adding a hardcoded fact that can rot.
#
# Pricing is identical across upstreams (verified tier by tier), so this is a
# region/reliability/moderation choice, never a cost one.
VALID_PROVIDERS="openai anthropic gemini azure_foundry foundry aws_bedrock bedrock google_vertex vertex aliyun volcengine byteplus deepseek moonshot zhipu minimax grok jina tencent"
DEFAULT_SEEDANCE_PROVIDER="byteplus"

# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

list_contains() {
  # $1 = needle, $2 = space-separated haystack
  local needle="$1" hay="$2" item
  for item in $hay; do
    [ "$item" = "$needle" ] && return 0
  done
  return 1
}

# ---------------------------------------------------------------------------
# model list: per-model limits instead of one hardcoded table
#
# GET /v1/models is a public, keyless, free endpoint that reports each model's
# real duration range, resolutions, aspect ratios and modes. Validating against
# it means a bad combination is caught locally with the model's own legal
# values, instead of costing a round trip to be told "invalid_request" — and
# it keeps working when Ofox adds a model or changes a limit.
#
# Order of preference: fresh cache -> live fetch -> stale cache -> bundled
# snapshot. If all of those fail we validate against the unions above and say
# so: a missing model list must never block a request that would have worked
# (CONTRIBUTING rule 6, fail open).
# ---------------------------------------------------------------------------

file_age_seconds() {
  # Portable mtime age. BSD stat (macOS) and GNU stat (Linux) disagree on
  # flags, so try both rather than assuming a platform.
  local f="$1" mtime now
  mtime="$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null)" || return 1
  [ -n "$mtime" ] || return 1
  now="$(date +%s)"
  echo $((now - mtime))
}

load_models() {
  # Idempotent: the list is fetched at most once per invocation.
  [ -n "$MODELS_FILE" ] && return 0

  local cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/ofox"
  local cache_file="$cache_dir/models.json"
  local age

  if [ -f "$cache_file" ]; then
    age="$(file_age_seconds "$cache_file")" || age=""
    if [ -n "$age" ] && [ "$age" -lt "$MODELS_CACHE_TTL" ]; then
      MODELS_FILE="$cache_file"
      MODELS_SOURCE="cache"
      return 0
    fi
  fi

  # No Authorization header: this endpoint is public, and sending the key
  # where it isn't needed is a habit worth not having.
  local tmp
  mkdir -p "$cache_dir" 2>/dev/null
  tmp="$(mktemp "${TMPDIR:-/tmp}/ofox-models.XXXXXX")" || tmp=""
  if [ -n "$tmp" ] &&
    curl -fsS --max-time 10 "$API_BASE/models" -o "$tmp" 2>/dev/null &&
    jq -e '(.data | length) > 0' "$tmp" >/dev/null 2>&1; then
    if mv -f "$tmp" "$cache_file" 2>/dev/null; then
      MODELS_FILE="$cache_file"
    else
      MODELS_FILE="$tmp" # cache dir unwritable; use it for this run only
    fi
    MODELS_SOURCE="live"
    return 0
  fi
  [ -n "$tmp" ] && rm -f "$tmp"

  if [ -f "$cache_file" ]; then
    MODELS_FILE="$cache_file"
    MODELS_SOURCE="stale-cache"
    echo "NOTE: could not refresh the model list from $API_BASE/models; using the cached copy at $cache_file." >&2
    return 0
  fi

  if [ -f "$MODELS_SNAPSHOT" ]; then
    MODELS_FILE="$MODELS_SNAPSHOT"
    MODELS_SOURCE="snapshot"
    local snap_date
    snap_date="$(jq -r '._snapshot_date // "unknown date"' "$MODELS_SNAPSHOT" 2>/dev/null)"
    echo "NOTE: could not reach $API_BASE/models; validating against the bundled snapshot ($snap_date). A model added since then may be rejected here — set OFOX_SKIP_MODEL_VALIDATION=1 to skip per-model checks." >&2
    return 0
  fi

  MODELS_SOURCE="none"
  echo "NOTE: no model list available (fetch failed, no cache, no bundled snapshot). Falling back to generic parameter checks; the API will have the final say." >&2
  return 1
}

default_provider_for() {
  # $1 = model id. Prints the upstream to pin, or nothing to let Ofox route.
  # Only models served by MORE THAN ONE upstream belong here.
  case "$1" in
    bytedance/seedance-*) echo "$DEFAULT_SEEDANCE_PROVIDER" ;;
    *) echo "" ;;
  esac
}

catalog_cache_path() {
  # $1 = model id. One cache file per model; '/' isn't legal in a filename.
  local slug
  slug="$(printf '%s' "$1" | tr '/' '-')"
  echo "${XDG_CACHE_HOME:-$HOME/.cache}/ofox/catalog-${slug}.json"
}

load_catalog() {
  # $1 = model id. Fetches the public, keyless model catalog entry, which
  # carries provider_cards[] (each upstream and its price matrix). Prints the
  # cache file path on success. Never fetched for the default provider — only
  # for explicit --provider validation and the 'providers' subcommand.
  local model="$1" cache_file age
  cache_file="$(catalog_cache_path "$model")"

  if [ -f "$cache_file" ]; then
    age="$(file_age_seconds "$cache_file")" || age=""
    if [ -n "$age" ] && [ "$age" -lt "$MODELS_CACHE_TTL" ]; then
      printf '%s' "$cache_file"
      return 0
    fi
  fi

  local base tmp
  # The catalog lives under /v2 while API_BASE points at /v1.
  base="${API_BASE%/v1}"
  mkdir -p "$(dirname "$cache_file")" 2>/dev/null
  tmp="$(mktemp "${TMPDIR:-/tmp}/ofox-catalog.XXXXXX")" || return 1
  if curl -fsS --max-time 10 \
    "$base/v2/models/catalog/$model?include=provider_price" -o "$tmp" 2>/dev/null &&
    jq -e '(.provider_cards | length) > 0' "$tmp" >/dev/null 2>&1; then
    mv -f "$tmp" "$cache_file" 2>/dev/null || cache_file="$tmp"
    printf '%s' "$cache_file"
    return 0
  fi
  rm -f "$tmp"

  # A stale copy still answers "which upstreams serve this model" well enough.
  if [ -f "$cache_file" ]; then
    printf '%s' "$cache_file"
    return 0
  fi
  return 1
}

catalog_providers() {
  # $1 = model id. Prints that model's upstreams, space-separated, or nothing.
  local f
  f="$(load_catalog "$1")" || return 1
  jq -r '[.provider_cards[].provider_type] | join(" ")' "$f" 2>/dev/null
}

model_entry() {
  # $1 = model id (or one of its aliases). Prints that model's whole entry as
  # compact JSON, or nothing if the list doesn't have it.
  [ -n "$MODELS_FILE" ] || return 1
  jq -c --arg m "$1" \
    'first(.data[] | select(.id == $m or ((.aliases // []) | index($m)) != null)) // empty' \
    "$MODELS_FILE" 2>/dev/null
}

entry_list() {
  # $1 = entry JSON, $2 = jq path into it. Prints a space-separated list.
  printf '%s' "$1" | jq -r "($2 // []) | join(\" \")" 2>/dev/null
}

entry_num() {
  # $1 = entry JSON, $2 = jq path. Prints a number, or nothing if absent/null.
  printf '%s' "$1" | jq -r "($2 // empty) | tostring" 2>/dev/null
}

resolve_image_ref() {
  # $1 = the raw value passed to --frame-first-image/--frame-last-image.
  #
  # Passes http(s):// URLs and already-formed data: URIs through unchanged.
  # Base64-encodes a readable local file into a data:image/<ext>;base64,...
  # URI (portable `base64` + `tr` only, no new dependency). A bare string
  # that's neither a URL nor an existing local file is passed through as-is
  # so the API's own validation produces a clear error rather than this
  # script guessing. But a path that DOES exist as a file yet can't be read
  # (permissions) is a clear local problem — fail loudly and non-zero here
  # rather than silently sending the raw filesystem path as if it were a
  # usable image reference.
  local val="$1" ext ctype b64
  case "$val" in
    http://*|https://*|data:*)
      printf '%s' "$val"
      return 0
      ;;
  esac
  if [ -f "$val" ] && [ ! -r "$val" ]; then
    echo "ERROR: local image file '$val' exists but is not readable (check file permissions)." >&2
    return 1
  fi
  if [ -f "$val" ] && [ -r "$val" ]; then
    ext=$(printf '%s' "$val" | sed -E 's/.*\.//' | tr '[:upper:]' '[:lower:]')
    case "$ext" in
      jpg|jpeg) ctype="image/jpeg" ;;
      png) ctype="image/png" ;;
      webp) ctype="image/webp" ;;
      gif) ctype="image/gif" ;;
      bmp) ctype="image/bmp" ;;
      *) ctype="image/jpeg" ;;
    esac
    b64=$(base64 <"$val" 2>/dev/null | tr -d '\n')
    if [ -z "$b64" ]; then
      echo "ERROR: failed to base64-encode local image file '$val'." >&2
      return 1
    fi
    printf 'data:%s;base64,%s' "$ctype" "$b64"
    return 0
  fi
  printf '%s' "$val"
  return 0
}

usage() {
  cat >&2 <<'EOF'
ofox-video.sh — Ofox video generation API client (create, poll, download).

  ofox-video.sh check
  ofox-video.sh models
  ofox-video.sh providers [MODEL]
  ofox-video.sh generate --prompt "..." [OPTIONS]
  ofox-video.sh create   --prompt "..." [OPTIONS]   (submit only, returns a job id)
         add --dry-run to any of generate/batch/chain to price it without spending
  ofox-video.sh batch --prompt "..." --takes N [--contact-sheet|--no-contact-sheet] [OPTIONS]
  ofox-video.sh poll JOB_ID [--out-dir DIR] [--max-wait SECONDS] [--poll-interval SECONDS]
  ofox-video.sh chain --shot "..." --shot "..." [--shots-file FILE] [--no-concat] [OPTIONS]
  ofox-video.sh contact-sheet VIDEO [VIDEO...] [--out-dir DIR]
  ofox-video.sh last-frame VIDEO [--out-dir DIR]

Seedance jobs are pinned to the byteplus upstream by default; override with
--provider volcengine, or --provider auto to let Ofox route by weight. Run
'providers' to see a model's upstreams. Pricing is identical across them.

Run with no arguments for this message. See the top of this file, or
skills/ofox-video-core/SKILL.md and references/api-params.md, for the full
option list and parameter reference.
EOF
}

# ---------------------------------------------------------------------------
# environment checks
# ---------------------------------------------------------------------------

check_curl_jq() {
  local missing=0
  if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is not installed." >&2
    echo "  macOS:          usually preinstalled; if not, 'brew install curl'" >&2
    echo "  Debian/Ubuntu:  sudo apt-get install curl" >&2
    echo "  Other:          https://curl.se/download.html" >&2
    missing=1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "ERROR: jq is not installed." >&2
    echo "  macOS:          brew install jq" >&2
    echo "  Debian/Ubuntu:  sudo apt-get install jq" >&2
    echo "  Other:          https://jqlang.org/download/" >&2
    missing=1
  fi
  [ "$missing" -eq 0 ]
}

check_api_key() {
  if [ -z "${OFOX_API_KEY:-}" ]; then
    echo "ERROR: OFOX_API_KEY is not set in your shell environment." >&2
    echo "Get a key at ${GET_KEY_URL} (log in -> Settings -> API Keys -> Create New Key)," >&2
    echo "then export it in your shell:" >&2
    echo "  export OFOX_API_KEY=your_key_here" >&2
    return 1
  fi
  return 0
}

cmd_check() {
  # Exits 2, not 1. This subcommand exists to diagnose the environment, and 2
  # is what the exit-code table means by an environment error. Returning 1
  # would tell a caller following that table to "fix the flag and retry",
  # which is the wrong advice for a missing key.
  local ok=0
  check_curl_jq || ok=2
  if ! check_api_key; then
    ok=2
    # Not having a key is not a dead end: pricing works without one, and
    # that is exactly what someone deciding whether to sign up wants.
    echo "" >&2
    echo "You can still price a job before signing up — these need no key:" >&2
    echo "  $0 models" >&2
    echo "  $0 providers" >&2
    echo "  $0 generate --dry-run --prompt \"...\" --duration 15 --resolution 720p" >&2
  fi
  if [ "$ok" -eq 0 ]; then
    echo "OK: curl, jq, and OFOX_API_KEY are all present."
    echo "Note: the key is present but has NOT been verified against the API — this"
    echo "check makes no network call. A typo'd key passes here and fails on the"
    echo "first real request."
  fi
  return "$ok"
}

cmd_providers() {
  # Lists the upstreams serving a model, with each one's price tiers. Needs no
  # API key — the catalog endpoint is public — so it is safe before signing up.
  check_curl_jq || return 2
  local model="${1:-$DEFAULT_MODEL}"
  local f
  if ! f="$(load_catalog "$model")"; then
    echo "ERROR: could not fetch the provider list for '$model'." >&2
    echo "  Check the model id (run 'ofox-video.sh models'), or try again when the network is available." >&2
    return 3
  fi

  local providers
  providers="$(jq -r '[.provider_cards[].provider_type] | join(" ")' "$f")"
  echo "Upstream providers for $model: $providers"
  echo

  jq -r '
    ["PROVIDER", "RESOLUTION", "MODE", "$/s"],
    (.provider_cards[] | .provider_type as $p
      | (.pricing.video_pricing.tiers[]? | select(.resolution)
         | [$p, .resolution, (.input_type // "-"), .price]))
    | @tsv' "$f" | column -t -s "$(printf '\t')"

  echo
  case "$model" in
    bytedance/seedance-*)
      echo "This skill pins Seedance to '$DEFAULT_SEEDANCE_PROVIDER' by default. Without a pin, Ofox"
      echo "distributes requests by weight and which upstream serves any one request is"
      echo "not predictable — which matters because these two moderate differently:"
      echo "  byteplus    ByteDance's platform for markets outside mainland China"
      echo "  volcengine  Volcengine Ark, its mainland China platform, standard moderation"
      echo "Pricing is identical across both, so this is a region and moderation choice,"
      echo "never a cost one. Override with --provider, or --provider auto to unpin."
      ;;
    *)
      if [ "$(printf '%s' "$providers" | wc -w | tr -d ' ')" -le 1 ]; then
        echo "Only one upstream serves this model, so routing is already deterministic"
        echo "and this skill sends no provider field for it."
      fi
      ;;
  esac
  return 0
}

cmd_models() {
  # Lists the video models with their real limits and per-second base price.
  # Needs no API key — GET /v1/models is public — so it is safe to run before
  # a user has signed up, and it costs nothing.
  check_curl_jq || return 2
  load_models || true
  if [ -z "$MODELS_FILE" ]; then
    echo "ERROR: could not obtain a model list (no network, no cache, no bundled snapshot)." >&2
    return 3
  fi

  echo "Video models (source: $MODELS_SOURCE)"
  echo

  # Show the rate a caller would actually be charged: the model's own default
  # resolution, text-to-video. The headline pricing.output_video_per_second is
  # deliberately NOT shown — for seedance-2.5 it reports the 480p rate ($0.11)
  # while the model defaults to 720p ($0.24), and a reader multiplying the
  # first big number they see by their duration is off by 118%.
  local rows="" mid mdefault mrate
  while IFS=$'\t' read -r mid mdefault mrest; do
    [ -z "$mid" ] && continue
    mrate="$(rate_for "$mid" "$mdefault" "t2v" "" 2>/dev/null)" || mrate=""
    [ -z "$mrate" ] && mrate="?"
    rows="$rows$mid\t$mrate\t$mdefault\t$mrest\n"
  done <<EOF_MODELS
$(jq -r '
    .data[]
    | select((.supported_endpoints // []) | index("/v1/videos"))
    | [ .id + (if .is_deprecated then " (deprecated)" else "" end),
        (.video_attributes.default_resolution // "720p"),
        ((.video_attributes.resolutions // []) | join(",")) + "\t" +
        ((.video_attributes.min_duration_seconds | tostring) + "-" +
         (.video_attributes.max_duration_seconds | tostring) + "s") + "\t" +
        ((.video_attributes.modes // []) | join(",")) ]
    | @tsv' "$MODELS_FILE")
EOF_MODELS

  {
    printf 'MODEL\t$/s AT DEFAULT\tDEFAULT RES\tALL RESOLUTIONS\tDURATION\tMODES\n'
    printf '%b' "$rows"
  } | column -t -s "$(printf '\t')"

  echo
  echo "The rate shown is for each model's own default resolution, text-to-video —"
  echo "what you pay if you don't pass --resolution. Other resolutions cost more or"
  echo "less; run 'ofox-video.sh providers MODEL' for the full matrix, or check a"
  echo "price for a specific job with 'generate --dry-run' (no API key needed)."
  return 0
}

# ---------------------------------------------------------------------------
# error-code -> friendly message mapping
# (per contract: program against error.code, never parse error.message)
# ---------------------------------------------------------------------------

print_error_message() {
  local code="$1"
  case "$code" in
    invalid_request)
      echo "  invalid_request: a required field is missing or a parameter value is invalid. Re-check model, prompt, duration, resolution, aspect_ratio." >&2 ;;
    input_moderation_failed)
      echo "  input_moderation_failed: the INPUT image or video was rejected before generation, most often because it contains a real person's face." >&2
      echo "    bytedance/seedance-2.5 image-to-video rejects real-person reference images outright. Options:" >&2
      echo "    1. Use a non-photoreal reference (illustration, anime, product, landscape) — those pass." >&2
      echo "    2. Use --real-person true, which routes through Ofox's privacy-preserving preprocessing for AUTHORIZED real-person references. Ofox documents this for bytedance/seedance-2.0; it is not confirmed for 2.5." >&2
      echo "    Nothing was generated, so this call was not billed." >&2 ;;
    invalid_provider_type)
      echo "  invalid_provider_type: the provider slug sent is not one Ofox recognises. Run 'ofox-video.sh providers MODEL' for the valid ones, or pass --provider auto to let Ofox choose." >&2 ;;
    provider_type_unavailable)
      echo "  provider_type_unavailable: that provider is a real slug but does not serve this model. Run 'ofox-video.sh providers MODEL' to see which do, or pass --provider auto to let Ofox choose." >&2 ;;
    invalid_callback_url)
      echo "  invalid_callback_url: callback_url must be HTTPS and must not point to a private/internal network." >&2 ;;
    references_conflict)
      echo "  references_conflict: frame_images and input_references cannot both be set — use only one." >&2 ;;
    too_many_references)
      echo "  too_many_references: input_references allows at most 9 images, 3 audio clips (<=15s each), and 1 video." >&2 ;;
    cancel_not_supported)
      echo "  cancel_not_supported: the upstream provider cannot interrupt this job once it has started." >&2 ;;
    cancel_failed)
      echo "  cancel_failed: the job is already in a terminal state and cannot be cancelled." >&2 ;;
    unauthorized|invalid_api_key)
      echo "  $code: OFOX_API_KEY is missing or invalid. Get/verify a key at ${GET_KEY_URL} (Settings -> API Keys)." >&2 ;;
    upstream_auth_failed)
      echo "  upstream_auth_failed: Ofox's upstream provider rejected authentication — an Ofox-side routing issue, not your key. Try again shortly." >&2 ;;
    insufficient_credits)
      echo "  insufficient_credits: your Ofox balance is too low for this job. No charge was made. Add credits at ${GET_KEY_URL}." >&2 ;;
    not_found)
      echo "  not_found: this job id is invalid or not accessible with this API key." >&2 ;;
    model_not_found)
      echo "  model_not_found: the requested model is not available. Check the model name (e.g. bytedance/seedance-2.5)." >&2 ;;
    rate_limited)
      echo "  rate_limited: too many requests. Wait a few seconds and retry — this is not a job failure." >&2 ;;
    upstream_error|route_error)
      echo "  $code: the upstream video provider failed. If this happened on job creation, no job was made and it is safe to retry create; if it happened while polling an existing job, retry the poll — do not create a new job." >&2 ;;
    internal_error)
      echo "  internal_error: an Ofox platform-side error. If this happened on job creation, no job was made and it is safe to retry create; if it happened while polling, retry the poll — do not create a new job." >&2 ;;
    output_moderation_failed)
      echo "  output_moderation_failed: the job's OUTPUT failed a post-generation content check — this happens AFTER the video was generated, not at submission, and cannot be caught by client-side validation. This job is NOT billed (no usage field on the response)." >&2
      echo "    Two fixes. Both are new requests, not resubmissions of the failed one, so neither double-bills:" >&2
      echo "    1. Retry on the other upstream. Seedance is served by byteplus and volcengine, which moderate differently, so the same prompt can pass on one and not the other. Use --provider volcengine if you were on byteplus, or --provider byteplus if you were on volcengine." >&2
      echo "    2. Change the prompt or the reference image/audio." >&2 ;;
    bad_data_uri|download_failed|unreachable|not_image|too_large)
      echo "  $code: the real_person reference image failed validation (must be a small, publicly reachable, valid image). Check the image URL and retry." >&2 ;;
    "")
      echo "  (no error.code in the response body)" >&2 ;;
    *)
      echo "  $code: unrecognized error code — see references/api-params.md or https://ofox.ai/docs/api/videos for the current list." >&2 ;;
  esac
}

print_api_error() {
  # $1 = context ("create" or "poll"), $2 = http_code, $3 = response body
  local context="$1" http_code="$2" body="$3" code message
  code=$(printf '%s' "$body" | jq -r '.error.code // empty' 2>/dev/null)
  message=$(printf '%s' "$body" | jq -r '.error.message // empty' 2>/dev/null)
  echo "ERROR: Ofox API rejected the $context request (HTTP $http_code)." >&2
  print_error_message "$code"
  # error.message is not a stable contract to branch logic on (see the
  # error-code table), but it can carry a specific detail the generic
  # mapped explanation above doesn't (e.g. a minimum image width) — always
  # surface it, not only when error.code itself is unrecognized/absent.
  if [ -n "$message" ]; then
    echo "  Upstream message: $message" >&2
  fi
  if [ -z "$code" ]; then
    echo "  Raw response body:" >&2
    printf '%s\n' "$body" >&2
  fi
}

# ---------------------------------------------------------------------------
# generate: validate params, build payload, POST, poll, download
# ---------------------------------------------------------------------------

cmd_generate() {
  if ! check_curl_jq; then return 2; fi

  local model="$DEFAULT_MODEL"
  local provider=""
  local provider_explicit=""
  local print_payload=""
  local dry_run=""
  local submit_only="${OFOX_SUBMIT_ONLY:-}"
  local prompt=""
  local duration=""
  local resolution=""
  local aspect_ratio=""
  local size=""
  local generate_audio=""
  local seed=""
  local frame_first=""
  local frame_last=""
  local real_person=""
  local callback_url=""
  local extra_json=""
  local out_dir="$PWD"
  local max_wait="$DEFAULT_MAX_WAIT"
  local poll_interval="$DEFAULT_POLL_INTERVAL"
  local key val

  while [ $# -gt 0 ]; do
    key="$1"
    case "$key" in
      --print-payload)
        print_payload=1
        shift
        continue
        ;;
      --dry-run)
        dry_run=1
        shift
        continue
        ;;
    esac
    case "$key" in
      --model|--prompt|--duration|--resolution|--aspect-ratio|--size|--generate-audio|--seed|--provider|--frame-first-image|--frame-last-image|--real-person|--callback-url|--extra-json|--out-dir|--max-wait|--poll-interval)
        if [ $# -lt 2 ]; then
          echo "ERROR: $key requires a value." >&2
          return 1
        fi
        val="$2"
        shift 2
        ;;
      *)
        echo "ERROR: unknown option '$key' for generate." >&2
        return 1
        ;;
    esac
    case "$key" in
      --model) model="$val" ;;
      --prompt) prompt="$val" ;;
      --duration) duration="$val" ;;
      --resolution) resolution="$val" ;;
      --aspect-ratio) aspect_ratio="$val" ;;
      --size) size="$val" ;;
      --generate-audio) generate_audio="$val" ;;
      --seed) seed="$val" ;;
      --provider) provider="$val"; provider_explicit=1 ;;
      --frame-first-image) frame_first="$val" ;;
      --frame-last-image) frame_last="$val" ;;
      --real-person) real_person="$val" ;;
      --callback-url) callback_url="$val" ;;
      --extra-json) extra_json="$val" ;;
      --out-dir) out_dir="$val" ;;
      --max-wait) max_wait="$val" ;;
      --poll-interval) poll_interval="$val" ;;
    esac
  done

  # --- validation (no network calls made before this point) ---

  if [ -z "$prompt" ]; then
    echo "ERROR: --prompt is required." >&2
    return 1
  fi

  if [ -n "$duration" ]; then
    case "$duration" in
      ''|*[!0-9]*)
        echo "ERROR: --duration must be a positive integer number of seconds (got '$duration')." >&2
        return 1
        ;;
    esac
  fi

  # Per-model limits from the live model list, with the generic unions as the
  # fallback. Everything here happens before any create call.
  local entry="" ok_resolutions="$VALID_RESOLUTIONS" ok_aspects="$VALID_ASPECT_RATIOS"
  local min_dur="" max_dur="" ok_modes=""

  if [ "${OFOX_SKIP_MODEL_VALIDATION:-}" != "1" ] && load_models; then
    entry="$(model_entry "$model")"

    if [ -z "$entry" ]; then
      # An id the list doesn't have. When the list is current, that's a real
      # error worth catching locally. When we're reading a bundled snapshot,
      # the model may simply be newer than the file — warn and let the API
      # decide rather than blocking a request that would have worked.
      if [ "$MODELS_SOURCE" = "snapshot" ] || [ "$MODELS_SOURCE" = "stale-cache" ]; then
        echo "NOTE: '$model' is not in the $MODELS_SOURCE model list, which may just be out of date. Skipping per-model checks; the API will validate it." >&2
      else
        echo "ERROR: --model '$model' is not in the Ofox model list. Run 'ofox-video.sh models' to see what is available." >&2
        return 1
      fi
    elif [ -z "$(entry_num "$entry" '.video_attributes')" ] &&
      ! printf '%s' "$entry" | jq -e '(.supported_endpoints // []) | index("/v1/videos")' >/dev/null 2>&1; then
      echo "ERROR: --model '$model' exists but does not support video generation (/v1/videos). Run 'ofox-video.sh models' to see the video models." >&2
      return 1
    else
      local v_res v_asp v_min v_max v_modes
      v_res="$(entry_list "$entry" '.video_attributes.resolutions')"
      v_asp="$(entry_list "$entry" '.video_attributes.aspect_ratios')"
      v_min="$(entry_num "$entry" '.video_attributes.min_duration_seconds')"
      v_max="$(entry_num "$entry" '.video_attributes.max_duration_seconds')"
      v_modes="$(entry_list "$entry" '.video_attributes.modes')"
      [ -n "$v_res" ] && ok_resolutions="$v_res"
      [ -n "$v_asp" ] && ok_aspects="$v_asp"
      [ -n "$v_min" ] && min_dur="$v_min"
      [ -n "$v_max" ] && max_dur="$v_max"
      [ -n "$v_modes" ] && ok_modes="$v_modes"

      if printf '%s' "$entry" | jq -e '.is_deprecated == true' >/dev/null 2>&1; then
        echo "NOTE: '$model' is marked deprecated by Ofox. It still runs for now; consider moving to a current model." >&2
      fi
    fi
  fi

  if [ -n "$duration" ] && [ -n "$min_dur" ] && [ -n "$max_dur" ]; then
    if [ "$duration" -lt "$min_dur" ] || [ "$duration" -gt "$max_dur" ]; then
      echo "ERROR: --duration must be between $min_dur and $max_dur for $model (got $duration)." >&2
      return 1
    fi
  fi

  if [ -n "$resolution" ] && ! list_contains "$resolution" "$ok_resolutions"; then
    echo "ERROR: --resolution '$resolution' is not supported by $model. Valid values: $ok_resolutions" >&2
    return 1
  fi

  if [ -n "$aspect_ratio" ] && ! list_contains "$aspect_ratio" "$ok_aspects"; then
    echo "ERROR: --aspect-ratio '$aspect_ratio' is not supported by $model. Valid values: $ok_aspects" >&2
    return 1
  fi

  if [ -n "$ok_modes" ] && { [ -n "$frame_first" ] || [ -n "$frame_last" ]; } &&
    ! list_contains "i2v" "$ok_modes"; then
    echo "ERROR: $model does not support image-to-video (frame images). It supports: $ok_modes" >&2
    return 1
  fi

  # --- upstream provider ---------------------------------------------------
  # Precedence: --provider > OFOX_VIDEO_PROVIDER > per-model default.
  # "auto" at any level means send no provider field and let Ofox route.
  if [ -z "$provider_explicit" ]; then
    provider="${OFOX_VIDEO_PROVIDER:-}"
    [ -z "$provider" ] && provider="$(default_provider_for "$model")"
  fi

  if [ "$provider" = "auto" ]; then
    provider=""
  elif [ -n "$provider" ]; then
    if ! list_contains "$provider" "$VALID_PROVIDERS"; then
      echo "ERROR: --provider '$provider' is not a known Ofox provider slug." >&2
      echo "  Valid slugs: $VALID_PROVIDERS" >&2
      echo "  Run 'ofox-video.sh providers $model' to see which ones serve this model, or use --provider auto to let Ofox choose." >&2
      return 1
    fi
    # Check the slug actually serves this model, but only from catalog data we
    # can get; never block a request because the catalog was unreachable.
    local model_providers=""
    if [ -n "$provider_explicit" ] || [ -n "${OFOX_VIDEO_PROVIDER:-}" ]; then
      model_providers="$(catalog_providers "$model" 2>/dev/null)" || model_providers=""
    else
      # Default path: only cross-check against a cache already on disk, so the
      # common case costs no network call at all.
      local cached
      cached="$(catalog_cache_path "$model")"
      if [ -f "$cached" ]; then
        model_providers="$(jq -r '[.provider_cards[].provider_type] | join(" ")' "$cached" 2>/dev/null)"
      fi
    fi
    if [ -n "$model_providers" ] && ! list_contains "$provider" "$model_providers"; then
      if [ -n "$provider_explicit" ]; then
        echo "ERROR: provider '$provider' does not serve $model." >&2
        echo "  This model is served by: $model_providers" >&2
        echo "  Use one of those, or --provider auto to let Ofox choose." >&2
        return 1
      fi
      # A default that the catalog says won't work: warn and stand down rather
      # than fail a request the user never asked to pin.
      echo "NOTE: the default provider '$provider' does not serve $model (it is served by: $model_providers). Letting Ofox route this one instead." >&2
      provider=""
    fi
  fi

  if [ -n "$size" ]; then
    case "$size" in
      [0-9]*x[0-9]*) ;;
      *)
        echo "ERROR: --size must be in WIDTHxHEIGHT form, e.g. 1280x720 (got '$size')." >&2
        return 1
        ;;
    esac
  fi

  if [ -n "$generate_audio" ] && [ "$generate_audio" != "true" ] && [ "$generate_audio" != "false" ]; then
    echo "ERROR: --generate-audio must be 'true' or 'false' (got '$generate_audio')." >&2
    return 1
  fi

  if [ -n "$real_person" ] && [ "$real_person" != "true" ] && [ "$real_person" != "false" ]; then
    echo "ERROR: --real-person must be 'true' or 'false' (got '$real_person')." >&2
    return 1
  fi

  if [ -n "$seed" ]; then
    case "$seed" in
      ''|*[!0-9]*)
        echo "ERROR: --seed must be a non-negative integer (got '$seed')." >&2
        return 1
        ;;
    esac
  fi

  if [ -n "$callback_url" ]; then
    case "$callback_url" in
      https://*) ;;
      *)
        echo "ERROR: --callback-url must start with https:// (Ofox rejects non-HTTPS callback URLs)." >&2
        return 1
        ;;
    esac
  fi

  if [ -n "$extra_json" ]; then
    if ! printf '%s' "$extra_json" | jq -e . >/dev/null 2>&1; then
      echo "ERROR: --extra-json is not valid JSON." >&2
      return 1
    fi
    if { [ -n "$frame_first" ] || [ -n "$frame_last" ]; } && printf '%s' "$extra_json" | jq -e 'has("input_references")' >/dev/null 2>&1; then
      echo "ERROR: cannot combine --frame-first-image/--frame-last-image with input_references in --extra-json (references_conflict) — use one or the other." >&2
      return 1
    fi
  fi

  case "$max_wait" in
    ''|*[!0-9]*)
      echo "ERROR: --max-wait must be a positive integer number of seconds (got '$max_wait')." >&2
      return 1
      ;;
  esac
  case "$poll_interval" in
    ''|*[!0-9]*)
      echo "ERROR: --poll-interval must be a positive integer number of seconds (got '$poll_interval')." >&2
      return 1
      ;;
  esac

  # A dry run sends no authenticated request, so it must not demand a key:
  # quoting a price is exactly what someone does *before* signing up, and the
  # repo's rule is to guide a keyless user rather than dead-end them.
  if [ -n "$dry_run" ]; then
    DRY_RUN_ACTIVE=1
  else
    if ! check_api_key; then return 2; fi
  fi

  # --out-dir is resolved here, under dry run too. A path that can't be
  # created is a free thing to catch — discovering it after a job is paid for
  # (exit 6) is the outcome a dry run exists to prevent.
  local dry_out_input="$out_dir"
  mkdir -p "$out_dir" 2>/dev/null
  if [ -z "$(cd "$out_dir" 2>/dev/null && pwd)" ]; then
    echo "ERROR: --out-dir '$dry_out_input' could not be created or entered (bad path or missing permissions)." >&2
    return 6
  fi

  # --- bytedance/seedance-2.5 image-to-video requires aspect_ratio=adaptive ---
  # Verified against the real API (see the seedance-2.5-image-to-video
  # research): every other aspect_ratio value fails once frame_images is
  # attached for this model, whether the caller passed one explicitly or
  # left it at the client default. Force it, and always say so — never
  # silently change a value the caller passed (or didn't pass).
  if { [ -n "$frame_first" ] || [ -n "$frame_last" ]; } && [ "$model" = "bytedance/seedance-2.5" ]; then
    if [ -n "$aspect_ratio" ] && [ "$aspect_ratio" != "adaptive" ]; then
      echo "NOTE: forcing aspect_ratio=adaptive for bytedance/seedance-2.5 image-to-video (required by the API); ignoring requested aspect ratio '$aspect_ratio'." >&2
    else
      echo "NOTE: forcing aspect_ratio=adaptive for bytedance/seedance-2.5 image-to-video (required by the API)." >&2
    fi
    aspect_ratio="adaptive"
  fi

  # --- build the request payload ---

  local payload='{}'
  payload=$(printf '%s' "$payload" | jq --arg v "$model" '.model=$v')
  payload=$(printf '%s' "$payload" | jq --arg v "$prompt" '.prompt=$v')
  [ -n "$duration" ] && payload=$(printf '%s' "$payload" | jq --argjson v "$duration" '.duration=$v')
  [ -n "$resolution" ] && payload=$(printf '%s' "$payload" | jq --arg v "$resolution" '.resolution=$v')
  [ -n "$aspect_ratio" ] && payload=$(printf '%s' "$payload" | jq --arg v "$aspect_ratio" '.aspect_ratio=$v')
  [ -n "$size" ] && payload=$(printf '%s' "$payload" | jq --arg v "$size" '.size=$v')
  [ -n "$generate_audio" ] && payload=$(printf '%s' "$payload" | jq --argjson v "$generate_audio" '.generate_audio=$v')
  [ -n "$seed" ] && payload=$(printf '%s' "$payload" | jq --argjson v "$seed" '.seed=$v')
  [ -n "$real_person" ] && payload=$(printf '%s' "$payload" | jq --argjson v "$real_person" '.real_person=$v')
  [ -n "$callback_url" ] && payload=$(printf '%s' "$payload" | jq --arg v "$callback_url" '.callback_url=$v')

  # A local image's base64 data URI can be well over 1MB (frame_first_ref/
  # frame_last_ref below), and `--extra-json` could in principle carry one
  # too (e.g. an embedded base64 image inside input_references). Passing a
  # string that large as a `jq --arg`/`--argjson` command-line value hits
  # the OS's ARG_MAX (execve argv+environ limit, 1,048,576 bytes on this
  # machine) and fails with "jq: Argument list too long" *before any
  # network call is made* — reproduced for real with a real 885KB PNG whose
  # base64 encoding (1,179,996 bytes) already exceeded ARG_MAX on its own.
  # Fix: never put a potentially-large value in a jq command-line argument.
  # Write it to a temp file instead and read it with `--rawfile`/
  # `--slurpfile` (file content, not an exec argument — not subject to
  # ARG_MAX). Same short-lived create/use/remove-immediately pattern as
  # tmp_body below, so a temp file never survives past the single jq call
  # that needs it, on every path (success or an early `return 1`).
  if [ -n "$frame_first" ] || [ -n "$frame_last" ]; then
    local frames='[]' frame_first_ref frame_last_ref tmp_ref
    if [ -n "$frame_first" ]; then
      frame_first_ref=$(resolve_image_ref "$frame_first") || return 1
      tmp_ref=$(mktemp)
      printf '%s' "$frame_first_ref" >"$tmp_ref"
      frames=$(printf '%s' "$frames" | jq --rawfile u "$tmp_ref" '. + [{"type":"image_url","image_url":{"url":$u},"frame_type":"first_frame"}]')
      rm -f "$tmp_ref"
    fi
    if [ -n "$frame_last" ]; then
      frame_last_ref=$(resolve_image_ref "$frame_last") || return 1
      tmp_ref=$(mktemp)
      printf '%s' "$frame_last_ref" >"$tmp_ref"
      frames=$(printf '%s' "$frames" | jq --rawfile u "$tmp_ref" '. + [{"type":"image_url","image_url":{"url":$u},"frame_type":"last_frame"}]')
      rm -f "$tmp_ref"
    fi
    # frames itself now embeds whatever large base64 data URI was resolved
    # above, so merging it into payload must also avoid --argjson on the
    # command line — same reasoning, same fix.
    tmp_ref=$(mktemp)
    printf '%s' "$frames" >"$tmp_ref"
    payload=$(printf '%s' "$payload" | jq --slurpfile f "$tmp_ref" '.frame_images=$f[0]')
    rm -f "$tmp_ref"
  fi

  if [ -n "$provider" ]; then
    payload=$(printf '%s' "$payload" | jq --arg v "$provider" '.provider = {type: $v}')
  fi

  if [ -n "$extra_json" ]; then
    local tmp_extra
    tmp_extra=$(mktemp)
    printf '%s' "$extra_json" >"$tmp_extra"
    payload=$(printf '%s' "$payload" | jq --slurpfile extra "$tmp_extra" '. * $extra[0]')
    rm -f "$tmp_extra"
  fi

  if [ -n "$print_payload" ]; then
    # The API key travels in an Authorization header, never in this body, so
    # printing it leaks nothing. Useful for seeing what actually got sent.
    echo "PAYLOAD $(printf '%s' "$payload" | jq -c .)" >&2
  fi

  # --- create the job (exactly one create call per invocation) ---

  # Say what this will cost before spending anything. i2v bills at t2v rates —
  # only a video input moves it to the v2v tier.
  #
  # The API's reference element type is "video_url" (alongside "image_url" and
  # "audio_url"), NOT "video". An earlier version of this check guessed "video"
  # and so quoted the t2v rate for a v2v job: a real run estimated $0.44 and
  # billed $0.56. Both spellings are accepted now — mispricing a job is worse
  # than tolerating a type string the API wouldn't have taken anyway.
  local est_mode="t2v"
  if printf '%s' "$extra_json" |
    jq -e '(.input_references // []) | map(select(.type == "video_url" or .type == "video")) | length > 0' \
      >/dev/null 2>&1; then
    est_mode="v2v"
  fi
  print_estimate "$model" "${resolution:-}" "$est_mode" "$provider" "$duration" 1

  local provider_label="auto (Ofox weighted)"
  [ -n "$provider" ] && provider_label="$provider"

  if [ -n "$dry_run" ]; then
    # Everything above already ran: arguments parsed, parameters validated
    # against the model, provider resolved, payload built, price quoted.
    # Nothing below runs, so nothing is submitted and nothing is billed. This
    # is what turns "quote before spending" into an instruction an agent can
    # actually follow.
    echo "DRY RUN — nothing was submitted and nothing was billed." >&2
    echo "Re-run without --dry-run to generate." >&2
    echo "STATUS dry_run"
    echo "MODEL $model"
    echo "PROVIDER $provider_label"
    [ -n "$duration" ] && echo "DURATION $duration"
    [ -n "$resolution" ] && echo "RESOLUTION $resolution"
    return 0
  fi

  echo "Submitting job to Ofox (model=$model, provider=$provider_label)..." >&2
  # payload can itself now be well over 1MB (a resolved frame image is
  # inlined into it above) — pass it to curl via `--data-binary @file`, not
  # `-d "$payload"`. The latter is an exec argument like jq --arg/--argjson
  # above and would hit the same ARG_MAX wall just one step later.
  local tmp_body http_code curl_rc body tmp_payload
  tmp_payload=$(mktemp)
  printf '%s' "$payload" >"$tmp_payload"
  tmp_body=$(mktemp)
  http_code=$(curl -sS -o "$tmp_body" -w '%{http_code}' \
    -X POST "$API_BASE/videos" \
    -H "Authorization: Bearer $OFOX_API_KEY" \
    -H "Content-Type: application/json" \
    --data-binary @"$tmp_payload")
  curl_rc=$?
  rm -f "$tmp_payload"
  body=$(cat "$tmp_body")
  rm -f "$tmp_body"

  if [ "$curl_rc" -ne 0 ]; then
    echo "ERROR: could not reach the Ofox API to create the job (curl exit $curl_rc)." >&2
    echo "We cannot tell whether a job was created server-side — no HTTP response was received." >&2
    echo "Do NOT blindly retry. Check ${GET_KEY_URL} for a new job or a balance change first," >&2
    echo "then retry manually only if nothing was created." >&2
    return 5
  fi

  if [ "$http_code" != "202" ]; then
    print_api_error "create" "$http_code" "$body"
    return 3
  fi

  local job_id polling_url
  job_id=$(printf '%s' "$body" | jq -r '.id // empty')
  polling_url=$(printf '%s' "$body" | jq -r '.polling_url // empty')

  if [ -z "$job_id" ]; then
    echo "ERROR: Ofox returned 202 but the response has no job id — unexpected response shape." >&2
    echo "Raw body:" >&2
    printf '%s\n' "$body" >&2
    return 3
  fi
  [ -z "$polling_url" ] && polling_url="$API_BASE/videos/$job_id"

  echo "Job created: $job_id" >&2
  echo "Polling: $polling_url" >&2
  echo "If this times out before the job finishes, do NOT re-run 'generate' for the same request." >&2
  echo "Instead run: $0 poll $job_id" >&2

  if [ -n "$submit_only" ]; then
    # Submit-and-return. The whole point is that this finishes in seconds, so
    # a caller with a short tool timeout can never end up in the one genuinely
    # bad state: job created and billable, id never printed. Wait separately
    # with `poll`, as many short calls as it takes.
    # Absolute, because the whole point of create is that the *next* call
    # happens separately — possibly from a different working directory. A
    # relative path here would hand the caller a poll command that silently
    # downloads somewhere else, or fails.
    local abs_out
    abs_out="$(cd "$out_dir" 2>/dev/null && pwd)" || abs_out="$out_dir"
    echo "STATUS submitted"
    echo "JOB_ID $job_id"
    echo "POLLING_URL $polling_url"
    echo "OUT_DIR $abs_out"
    echo "" >&2
    echo "Submitted, not waiting. Download it with:" >&2
    echo "  $0 poll $job_id --out-dir $abs_out" >&2
    echo "The job is billable from now on whether or not you poll for it." >&2
    return 0
  fi

  poll_and_download "$job_id" "$polling_url" "$out_dir" "$max_wait" "$poll_interval"
  return $?
}

# ---------------------------------------------------------------------------
# batch: N takes of one prompt, real per-take billing, optional contact sheet
#
# Generating several takes and keeping one is how this actually gets used, and
# it is the thing nobody prices honestly. So: estimate before spending, report
# what each take really cost from its own usage.video_cost, and total it.
#
# Every take is its own job, submitted one at a time through the same
# cmd_generate path a single generate uses. That keeps the no-resubmit rule
# intact for free — nothing here can re-POST a request that already exists —
# and it means a take benefits from every validation and error mapping the
# single-shot path already has. It is slower than firing N creates at once;
# that is the trade, and it is the right way round when each retry costs money.
#
# A take that fails STOPS the run. Whatever broke take 2 will almost certainly
# break takes 3..N, and continuing would spend real money to collect identical
# failures.
# ---------------------------------------------------------------------------

MAX_TAKES=10

cmd_batch() {
  local takes="" seed_given="" prompt_seen="" batch_provider="" batch_dry=""
  local passthrough=() out_dir="$PWD" duration="" resolution="" model="$DEFAULT_MODEL"
  local sheet="auto"
  local key val

  while [ $# -gt 0 ]; do
    key="$1"
    case "$key" in
      --takes)
        [ $# -lt 2 ] && { echo "ERROR: --takes requires a value." >&2; return 1; }
        takes="$2"; shift 2; continue
        ;;
      --contact-sheet)
        sheet="always"; shift; continue
        ;;
      --no-contact-sheet)
        sheet="never"; shift; continue
        ;;
      --print-payload)
        # Valueless flags have to be forwarded without consuming the next
        # argument, or they eat whatever follows them.
        passthrough+=("$key"); shift; continue
        ;;
      --dry-run)
        batch_dry=1; shift; continue
        ;;
      *)
        if [ $# -lt 2 ]; then
          echo "ERROR: $key requires a value." >&2
          return 1
        fi
        val="$2"
        case "$key" in
          --provider) batch_provider="$val" ;;
          --seed) seed_given="$val" ;;
          --prompt) prompt_seen="1" ;;
          --out-dir) out_dir="$val" ;;
          --duration) duration="$val" ;;
          --resolution) resolution="$val" ;;
          --model) model="$val" ;;
        esac
        passthrough+=("$key" "$val")
        shift 2
        ;;
    esac
  done

  # --- batch-specific validation (no network calls yet) ---

  if [ -z "$takes" ]; then
    echo "ERROR: --takes is required for batch (how many takes to generate). Use 'generate' for a single one." >&2
    return 1
  fi
  case "$takes" in
    ''|*[!0-9]*)
      echo "ERROR: --takes must be a positive integer (got '$takes')." >&2
      return 1
      ;;
  esac
  if [ "$takes" -lt 1 ]; then
    echo "ERROR: --takes must be at least 1 (got $takes)." >&2
    return 1
  fi
  if [ "$takes" -gt "$MAX_TAKES" ]; then
    echo "ERROR: --takes is capped at $MAX_TAKES here (got $takes) — this spends real money per take. Run it again if you genuinely want more." >&2
    return 1
  fi
  if [ -z "$prompt_seen" ]; then
    echo "ERROR: --prompt is required." >&2
    return 1
  fi

  if [ -n "$seed_given" ] && [ "$takes" -gt 1 ]; then
    echo "NOTE: --seed $seed_given is fixed, so all $takes takes may come back identical — and you would be billed for each. Drop --seed to let them vary." >&2
  fi

  # --- estimate before spending ---

  [ -n "$batch_dry" ] && DRY_RUN_ACTIVE=1
  print_estimate "$model" "${resolution:-}" "t2v" "${batch_provider:-}" "$duration" "$takes"

  if [ -n "$batch_dry" ]; then
    # Validate one take through the real path so a bad parameter is caught
    # here rather than after the first one is paid for, then stop.
    #
    # Capture the inner call's stderr instead of letting it through: it prints
    # its own single-take estimate, and a caller told "there is exactly one
    # Estimated cost line, relay it" would otherwise see two and quite
    # reasonably relay the last one — the per-take figure this skill spends
    # two documents telling people not to quote. Errors still surface.
    local inner_err
    if ! inner_err="$(cmd_generate "${passthrough[@]}" --dry-run 2>&1 >/dev/null)"; then
      printf '%s\n' "$inner_err" >&2
      return 1
    fi
    echo "DRY RUN — $takes takes would be submitted, one at a time. Nothing was billed." >&2
    echo "Re-run without --dry-run to generate." >&2
    echo "STATUS dry_run"
    echo "TAKES_REQUESTED $takes"
    return 0
  fi

  # --- run the takes, one real job each ---

  local i=1 rc=0 stopped=""
  local paths=() costs=() ids=() seeds=()
  local out line
  while [ "$i" -le "$takes" ]; do
    echo "" >&2
    echo "--- take $i/$takes ---" >&2
    # Give each take an explicit seed when the caller didn't pick one. Without
    # this, takes differ only by a seed the API chose and never told us, so
    # "take 3 was the good one, render that properly" is impossible — you can
    # only reroll and hope. With it, the seed is a handle: the same prompt and
    # seed on a better model reproduces that take.
    local take_args=("${passthrough[@]}") take_seed=""
    if [ -z "$seed_given" ]; then
      take_seed=$(( (RANDOM << 15 | RANDOM) & 0x7FFFFFFF ))
      take_args+=(--seed "$take_seed")
    else
      take_seed="$seed_given"
    fi
    out="$(cmd_generate "${take_args[@]}")"
    rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "" >&2
      echo "Stopping the batch: take $i failed (exit $rc), so takes $((i))..$takes were NOT submitted." >&2
      echo "Whatever failed here would almost certainly fail for the rest, and each attempt costs money." >&2
      stopped="1"
      break
    fi
    while IFS= read -r line; do
      case "$line" in
        "VIDEO_PATH "*) paths+=("${line#VIDEO_PATH }") ;;
        "VIDEO_COST "*) costs+=("${line#VIDEO_COST }") ;;
        "JOB_ID "*) ids+=("${line#JOB_ID }") ;;
      esac
    done <<EOF_TAKE
$out
EOF_TAKE
    seeds+=("$take_seed")
    i=$((i + 1))
  done

  local done_count=${#paths[@]}
  if [ "$done_count" -eq 0 ]; then
    echo "ERROR: no takes completed." >&2
    return "${rc:-3}"
  fi

  # --- contact sheet (optional, fail open) ---

  local sheet_path=""
  if [ "$sheet" != "never" ]; then
    sheet_path="$(make_contact_sheet "$out_dir" "${paths[@]}")" || sheet_path=""
  fi

  # --- report: real billing, never the estimate ---

  local total
  total="$(printf '%s\n' "${costs[@]}" | awk '{ s += $1 } END { printf "%.10f", s }')"
  local per
  per="$(awk -v t="$total" -v n="$done_count" 'BEGIN { printf "%.10f", (n ? t/n : 0) }')"

  echo "STATUS batch_completed"
  echo "TAKES_REQUESTED $takes"
  echo "TAKES_COMPLETED $done_count"
  local idx=0
  while [ "$idx" -lt "$done_count" ]; do
    echo "TAKE $((idx + 1)) ${ids[$idx]:-unknown} seed=${seeds[$idx]:-unknown} ${costs[$idx]:-unknown} ${paths[$idx]}"
    idx=$((idx + 1))
  done
  [ -n "$sheet_path" ] && echo "CONTACT_SHEET $sheet_path"
  echo "BATCH_COST_TOTAL $total"
  echo "BATCH_COST_PER_TAKE $per"
  echo "" >&2
  local total_h
  total_h="$(awk -v t="$total" 'BEGIN { printf "%.2f", t }')"
  echo "" >&2
  echo "Each take carries its seed. To re-render one properly, reuse its seed with the" >&2
  echo "same prompt on the model you actually want:" >&2
  echo "  $0 generate --prompt \"<same prompt>\" --seed <that take's seed> --model bytedance/seedance-2.5 --resolution 1080p" >&2
  echo "" >&2
  echo "That is \$$total_h for $done_count takes. If only one of them is usable, \$$total_h IS your" >&2
  echo "cost for that one clip — not the per-take figure. That total is the number worth" >&2
  echo "comparing across models and settings." >&2

  [ -n "$stopped" ] && return 3
  return 0
}

rate_for() {
  # $1 = model, $2 = resolution (may be empty), $3 = mode (t2v|v2v),
  # $4 = pinned provider (may be empty).
  #
  # Prints a per-second rate, or nothing when we cannot establish one. Never
  # guesses: an estimate we can't back up is worse than no estimate, because
  # the user acts on it before spending.
  #
  # Source is the catalog's per-resolution tier matrix. The models endpoint's
  # single output_video_per_second is NOT usable here — for seedance-2.5 it
  # reports the 480p rate while the model defaults to 720p, i.e. half the
  # real number.
  local model="$1" res="${2:-}" mode="${3:-t2v}" want_provider="${4:-}"
  local f

  if [ -z "$res" ]; then
    # Fall back to whatever the API itself would default to.
    if load_models 2>/dev/null; then
      local entry
      entry="$(model_entry "$model")"
      [ -n "$entry" ] && res="$(entry_num "$entry" '.video_attributes.default_resolution')"
    fi
    [ -z "$res" ] && return 1
  fi

  f="$(load_catalog "$model" 2>/dev/null)" || f=""
  if [ -z "$f" ] || [ ! -f "$f" ]; then
    f="$PRICING_SNAPSHOT"
    [ -f "$f" ] || return 1
  fi

  # Prefer the pinned provider's own card: prices happen to match across
  # providers today, but that is an observation, not a contract.
  local price
  price="$(jq -r --arg m "$model" --arg r "$res" --arg t "$mode" --arg p "$want_provider" '
    (.provider_cards // (.models[]? | select(.id == $m) | .provider_cards) // [])
    | (if ($p != "" and any(.[]; .provider_type == $p))
       then map(select(.provider_type == $p)) else . end)
    | first(.[].pricing.video_pricing.tiers[]?
        | select(.resolution == $r and ((.input_type // "t2v") == $t))
        | .price)
    // empty' "$f" 2>/dev/null)"

  [ -n "$price" ] || return 1
  printf '%s' "$price"
}

estimate_note() {
  # $1 = model, $2 = resolution, $3 = mode, $4 = provider, $5 = duration,
  # $6 = takes. Prints a human-readable estimate, or nothing.
  local rate
  rate="$(rate_for "$1" "$2" "$3" "$4")" || return 1
  [ -n "$rate" ] || return 1
  awk -v d="$5" -v n="$6" -v r="$rate" 'BEGIN {
    if (n > 1) printf "~$%.2f for %d takes (%ds x $%s/s x %d)", d*n*r, n, d, r, n;
    else printf "~$%.2f (%ds x $%s/s)", d*r, d, r
  }'
}

# Set to 1 by any subcommand running under --dry-run, so shared helpers can
# tell the difference between "about to spend" and "just quoting".
DRY_RUN_ACTIVE=""

print_estimate() {
  # $1 = model, $2 = resolution, $3 = mode, $4 = provider, $5 = duration,
  # $6 = count.
  #
  # ALWAYS prints exactly one "Estimated cost:" line. Silence is the one
  # outcome a calling agent cannot relay to a user — it can repeat a number,
  # and it can repeat "unavailable", but it cannot notice the absence of a
  # line it was never told to expect.
  local note
  if [ -z "${5:-}" ]; then
    echo "Estimated cost: unavailable — no --duration given, so there is nothing to multiply the per-second rate by. Pass --duration to get a quote up front." >&2
    return 0
  fi
  note="$(estimate_note "$@" 2>/dev/null)" || note=""
  if [ -n "$note" ]; then
    if [ -n "$DRY_RUN_ACTIVE" ]; then
      echo "Estimated cost: $note. This is an estimate — the actual figure comes from the job's own usage once it runs." >&2
    else
      echo "Estimated cost: $note. Actual billing is reported below, from the job's own usage." >&2
    fi
  else
    if [ -n "$DRY_RUN_ACTIVE" ]; then
      echo "Estimated cost: unavailable for this model/resolution combination (no verified rate on hand — run 'ofox-video.sh providers $1')." >&2
    else
      echo "Estimated cost: unavailable for this model/resolution combination (no verified rate on hand — run 'ofox-video.sh providers $1'). Actual billing is reported below." >&2
    fi
  fi
}


make_contact_sheet() {
  # $1 = out dir, $2.. = video paths. Prints the sheet path on stdout when it
  # makes one. Fail open, loudly: a missing ffmpeg costs you the sheet, never
  # the videos you already paid for.
  local out_dir="$1"
  shift
  local videos=("$@")

  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "NOTE: skipping the contact sheet — ffmpeg is not installed. The videos above are unaffected." >&2
    echo "  macOS: brew install ffmpeg   Debian/Ubuntu: sudo apt-get install ffmpeg" >&2
    return 1
  fi

  local tmpdir rows=() v row i=0
  tmpdir="$(mktemp -d)" || return 1

  for v in "${videos[@]}"; do
    row="$tmpdir/row_$i.png"
    # Three frames per take (roughly first / middle / last) tiled into a strip.
    # -frames:v 1 keeps it to a single output image.
    if ffmpeg -nostdin -loglevel error -i "$v"       -vf "select='eq(n\,0)+gte(t\,0.45*duration)*lt(prev_t\,0.45*duration)+gte(t\,0.9*duration)*lt(prev_t\,0.9*duration)',scale=320:-2,tile=3x1"       -frames:v 1 -y "$row" 2>/dev/null && [ -s "$row" ]; then
      rows+=("$row")
    else
      # Fall back to plain time-sampling if the select filter finds nothing.
      if ffmpeg -nostdin -loglevel error -i "$v"         -vf "fps=1,scale=320:-2,tile=3x1" -frames:v 1 -y "$row" 2>/dev/null && [ -s "$row" ]; then
        rows+=("$row")
      fi
    fi
    i=$((i + 1))
  done

  if [ "${#rows[@]}" -eq 0 ]; then
    echo "NOTE: could not extract frames for the contact sheet; the videos themselves are fine." >&2
    rm -rf "$tmpdir"
    return 1
  fi

  # Report an absolute path, never the relative one the caller happened to
  # pass — a path the reader has to resolve against an unstated working
  # directory is not an answer (see .trellis/spec/skills/index.md).
  local sheet stamp abs_dir
  stamp="$(date +%Y%m%d%H%M%S)"
  abs_dir="$(cd "$out_dir" 2>/dev/null && pwd)" || abs_dir="$out_dir"
  sheet="${abs_dir%/}/contact-sheet-${stamp}.png"
  if [ "${#rows[@]}" -eq 1 ]; then
    cp "${rows[0]}" "$sheet" || return 1
  else
    local args=() n=${#rows[@]}
    for row in "${rows[@]}"; do args+=(-i "$row"); done
    if ! ffmpeg -nostdin -loglevel error "${args[@]}"       -filter_complex "vstack=inputs=$n" -y "$sheet" 2>/dev/null; then
      echo "NOTE: extracted the frames but could not stack them into one sheet; the videos are fine." >&2
      rm -rf "$tmpdir"
      return 1
    fi
  fi

  rm -rf "$tmpdir"
  [ -s "$sheet" ] || return 1
  printf '%s' "$sheet"
  return 0
}

extract_last_frame() {
  # $1 = video, $2 = destination png. Grabs a frame slightly BEFORE the end
  # rather than the literal final one: trailing frames are often a fade or a
  # black frame, which would make the next shot open on nothing.
  local video="$1" dest="$2" dur seek

  dur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 \
    "$video" 2>/dev/null)" || dur=""

  if [ -n "$dur" ]; then
    seek="$(awk -v d="$dur" 'BEGIN { t = d - 0.1; if (t < 0) t = 0; printf "%.3f", t }')"
    if ffmpeg -nostdin -loglevel error -ss "$seek" -i "$video" \
      -frames:v 1 -y "$dest" 2>/dev/null && [ -s "$dest" ]; then
      return 0
    fi
  fi

  # Fall back to the true last frame if seeking didn't land one.
  if ffmpeg -nostdin -loglevel error -sseof -0.5 -i "$video" \
    -update 1 -frames:v 1 -y "$dest" 2>/dev/null && [ -s "$dest" ]; then
    return 0
  fi
  return 1
}

cmd_last_frame() {
  # Pull the closing frame out of a clip. No API call, no key, no cost —
  # useful on its own for feeding a frame into a later generate.
  local video="" out_dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --out-dir)
        [ $# -lt 2 ] && { echo "ERROR: --out-dir requires a value." >&2; return 1; }
        out_dir="$2"; shift 2
        ;;
      -*)
        echo "ERROR: unknown option '$1' for last-frame." >&2
        return 1
        ;;
      *)
        video="$1"; shift
        ;;
    esac
  done

  if [ -z "$video" ]; then
    echo "ERROR: give a video file. Usage: ofox-video.sh last-frame VIDEO [--out-dir DIR]" >&2
    return 1
  fi
  if [ ! -r "$video" ]; then
    echo "ERROR: cannot read '$video'." >&2
    return 1
  fi
  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "ERROR: ffmpeg is required to extract a frame." >&2
    echo "  macOS: brew install ffmpeg   Debian/Ubuntu: sudo apt-get install ffmpeg" >&2
    return 2
  fi

  [ -z "$out_dir" ] && out_dir="$(dirname "$video")"
  mkdir -p "$out_dir" 2>/dev/null
  local abs_dir base dest
  abs_dir="$(cd "$out_dir" 2>/dev/null && pwd)" || abs_dir="$out_dir"
  base="$(basename "$video")"
  dest="${abs_dir%/}/${base%.*}-lastframe.png"

  if ! extract_last_frame "$video" "$dest"; then
    echo "ERROR: could not extract a frame from '$video'." >&2
    return 3
  fi
  echo "LAST_FRAME $dest"
  return 0
}

# ---------------------------------------------------------------------------
# chain: N shots, each opening on the previous shot's closing frame
#
# One job is one continuous take, so a multi-shot sequence means multiple jobs
# — and separate jobs share nothing, so the character, set and lighting drift
# between them. Feeding shot N-1's last frame in as shot N's first frame is the
# lever this API gives you against that.
#
# Same house rules as batch: estimate before spending, one job at a time via
# cmd_generate (no-resubmit holds for free), stop on first failure, report real
# per-job cost.
# ---------------------------------------------------------------------------

MAX_SHOTS=10

cmd_chain() {
  local shots=() shots_file="" out_dir="$PWD" duration="" resolution=""
  local model="$DEFAULT_MODEL" concat="auto" aspect="" chain_dry=""
  local passthrough=() key val

  while [ $# -gt 0 ]; do
    key="$1"
    case "$key" in
      --shot)
        [ $# -lt 2 ] && { echo "ERROR: --shot requires a value." >&2; return 1; }
        shots+=("$2"); shift 2; continue
        ;;
      --shots-file)
        [ $# -lt 2 ] && { echo "ERROR: --shots-file requires a value." >&2; return 1; }
        shots_file="$2"; shift 2; continue
        ;;
      --no-concat)
        concat="never"; shift; continue
        ;;
      --dry-run)
        chain_dry=1; shift; continue
        ;;
      --print-payload)
        passthrough+=("$key"); shift; continue
        ;;
      *)
        if [ $# -lt 2 ]; then
          echo "ERROR: $key requires a value." >&2
          return 1
        fi
        val="$2"
        case "$key" in
          --out-dir) out_dir="$val" ;;
          --duration) duration="$val" ;;
          --resolution) resolution="$val" ;;
          --model) model="$val" ;;
          --aspect-ratio) aspect="$val" ;;
        esac
        passthrough+=("$key" "$val")
        shift 2
        ;;
    esac
  done

  if [ -n "$shots_file" ]; then
    if [ ! -r "$shots_file" ]; then
      echo "ERROR: cannot read --shots-file '$shots_file'." >&2
      return 1
    fi
    local line
    while IFS= read -r line || [ -n "$line" ]; do
      case "$line" in
        ''|'#'*) continue ;;
      esac
      shots+=("$line")
    done < "$shots_file"
  fi

  if [ "${#shots[@]}" -eq 0 ]; then
    echo "ERROR: give at least one --shot, or a --shots-file with one prompt per line." >&2
    return 1
  fi
  if [ "${#shots[@]}" -gt "$MAX_SHOTS" ]; then
    echo "ERROR: chain is capped at $MAX_SHOTS shots (got ${#shots[@]}) — each shot is a separately billed job." >&2
    return 1
  fi

  # Chaining is impossible without frame extraction, and finding that out
  # after paying for shot 1 would be the wrong time.
  if ! command -v ffmpeg >/dev/null 2>&1 && [ "${#shots[@]}" -gt 1 ]; then
    echo "ERROR: chain needs ffmpeg to carry each shot's closing frame into the next." >&2
    echo "  macOS: brew install ffmpeg   Debian/Ubuntu: sudo apt-get install ffmpeg" >&2
    echo "  Without it, generate each shot separately with 'generate' instead." >&2
    return 2
  fi

  local n=${#shots[@]}
  echo "Chaining $n shots. Each shot after the first opens on the previous shot's closing frame." >&2
  if [ "$n" -gt 1 ]; then
    case "$model" in
      bytedance/seedance-2.5)
        if [ -n "$aspect" ]; then
          echo "NOTE: --aspect-ratio $aspect applies to shot 1 only. Shots 2+ are image-to-video, which $model requires to be 'adaptive' — they inherit their framing from the fed frame, so the sequence stays dimensionally consistent." >&2
        else
          echo "NOTE: shots 2+ are image-to-video and inherit their framing from the fed frame, so the sequence stays dimensionally consistent." >&2
        fi
        ;;
    esac
  fi

  [ -n "$chain_dry" ] && DRY_RUN_ACTIVE=1
  print_estimate "$model" "${resolution:-}" "t2v" "" "$duration" "$n"

  if [ -n "$chain_dry" ]; then
    local inner_err
    if ! inner_err="$(cmd_generate "${passthrough[@]}" --prompt "${shots[0]}" --dry-run 2>&1 >/dev/null)"; then
      printf '%s\n' "$inner_err" >&2
      return 1
    fi
    echo "DRY RUN — $n shots would be submitted in sequence. Nothing was billed." >&2
    echo "Re-run without --dry-run to generate." >&2
    echo "STATUS dry_run"
    echo "SHOTS_REQUESTED $n"
    return 0
  fi

  mkdir -p "$out_dir" 2>/dev/null
  local abs_out
  abs_out="$(cd "$out_dir" 2>/dev/null && pwd)" || abs_out="$out_dir"

  local i=1 rc=0 stopped="" prev_frame=""
  local paths=() costs=() ids=() out line
  while [ "$i" -le "$n" ]; do
    echo "" >&2
    echo "--- shot $i/$n ---" >&2

    local args=("${passthrough[@]}" --prompt "${shots[$((i - 1))]}" --out-dir "$abs_out")
    [ -n "$prev_frame" ] && args+=(--frame-first-image "$prev_frame")

    out="$(cmd_generate "${args[@]}")"
    rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "" >&2
      echo "Stopping the chain: shot $i failed (exit $rc), so shots $i..$n were NOT submitted." >&2
      echo "Shots already generated are kept and listed below." >&2
      stopped="1"
      break
    fi

    local shot_path=""
    while IFS= read -r line; do
      case "$line" in
        "VIDEO_PATH "*) shot_path="${line#VIDEO_PATH }"; paths+=("$shot_path") ;;
        "VIDEO_COST "*) costs+=("${line#VIDEO_COST }") ;;
        "JOB_ID "*) ids+=("${line#JOB_ID }") ;;
      esac
    done <<EOF_SHOT
$out
EOF_SHOT

    if [ "$i" -lt "$n" ]; then
      if [ -z "$shot_path" ]; then
        echo "Stopping the chain: shot $i reported no video path, so there is no frame to carry forward." >&2
        stopped="1"
        rc=3
        break
      fi
      prev_frame="${abs_out%/}/chain-frame-$i.png"
      if ! extract_last_frame "$shot_path" "$prev_frame"; then
        echo "Stopping the chain: could not extract a closing frame from shot $i." >&2
        echo "The shots generated so far are kept and listed below." >&2
        stopped="1"
        rc=3
        break
      fi
      echo "Carrying shot $i's closing frame into shot $((i + 1)): $prev_frame" >&2
    fi
    i=$((i + 1))
  done

  local done_count=${#paths[@]}
  if [ "$done_count" -eq 0 ]; then
    echo "ERROR: no shots completed." >&2
    return "${rc:-3}"
  fi

  local joined=""
  if [ "$concat" != "never" ] && [ "$done_count" -gt 1 ]; then
    joined="$(concat_clips "$abs_out" "${paths[@]}")" || joined=""
  fi

  local total per
  total="$(printf '%s\n' "${costs[@]}" | awk '{ s += $1 } END { printf "%.10f", s }')"
  per="$(awk -v t="$total" -v n="$done_count" 'BEGIN { printf "%.10f", (n ? t/n : 0) }')"

  echo "STATUS chain_completed"
  echo "SHOTS_REQUESTED $n"
  echo "SHOTS_COMPLETED $done_count"
  local idx=0
  while [ "$idx" -lt "$done_count" ]; do
    echo "SHOT $((idx + 1)) ${ids[$idx]:-unknown} ${costs[$idx]:-unknown} ${paths[$idx]}"
    idx=$((idx + 1))
  done
  [ -n "$joined" ] && echo "JOINED $joined"
  echo "CHAIN_COST_TOTAL $total"
  echo "CHAIN_COST_PER_SHOT $per"

  [ -n "$stopped" ] && return 3
  return 0
}

concat_clips() {
  # $1 = out dir, $2.. = clips in order. Prints the joined file path.
  # Fail open: losing the join must never cost the clips already paid for.
  local out_dir="$1"
  shift
  local clips=("$@")

  if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "NOTE: skipping the join — ffmpeg is not installed. The shots above are unaffected." >&2
    return 1
  fi

  local listfile stamp joined clip
  listfile="$(mktemp)" || return 1
  for clip in "${clips[@]}"; do
    # The concat demuxer needs escaped single quotes in paths.
    printf "file '%s'\n" "$(printf '%s' "$clip" | sed "s/'/'\\\\''/g")" >> "$listfile"
  done

  stamp="$(date +%Y%m%d%H%M%S)"
  joined="${out_dir%/}/chain-joined-${stamp}.mp4"
  if ffmpeg -nostdin -loglevel error -f concat -safe 0 -i "$listfile" \
    -c copy -y "$joined" 2>/dev/null && [ -s "$joined" ]; then
    rm -f "$listfile"
    printf '%s' "$joined"
    return 0
  fi

  # Stream copy fails when the clips differ in codec/params; re-encode once.
  if ffmpeg -nostdin -loglevel error -f concat -safe 0 -i "$listfile" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -y "$joined" 2>/dev/null &&
    [ -s "$joined" ]; then
    rm -f "$listfile"
    echo "NOTE: the shots needed re-encoding to join (their codecs differed)." >&2
    printf '%s' "$joined"
    return 0
  fi

  rm -f "$listfile" "$joined"
  echo "NOTE: could not join the shots into one file; they are all listed above and playable individually." >&2
  return 1
}

cmd_contact_sheet() {
  # Build a contact sheet from videos already on disk. No API call, no cost —
  # useful for re-tiling takes you already paid for, or for comparing clips
  # that came from separate runs.
  local out_dir="" videos=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --out-dir)
        [ $# -lt 2 ] && { echo "ERROR: --out-dir requires a value." >&2; return 1; }
        out_dir="$2"; shift 2
        ;;
      -*)
        echo "ERROR: unknown option '$1' for contact-sheet." >&2
        return 1
        ;;
      *)
        videos+=("$1"); shift
        ;;
    esac
  done

  if [ "${#videos[@]}" -eq 0 ]; then
    echo "ERROR: give at least one video file. Usage: ofox-video.sh contact-sheet VIDEO [VIDEO...] [--out-dir DIR]" >&2
    return 1
  fi
  local v
  for v in "${videos[@]}"; do
    if [ ! -r "$v" ]; then
      echo "ERROR: cannot read '$v'." >&2
      return 1
    fi
  done
  if [ -z "$out_dir" ]; then
    out_dir="$(dirname "${videos[0]}")"
  fi
  mkdir -p "$out_dir" 2>/dev/null

  local sheet
  sheet="$(make_contact_sheet "$out_dir" "${videos[@]}")" || return 3
  echo "CONTACT_SHEET $sheet"
  return 0
}

# ---------------------------------------------------------------------------
# poll: resume polling / download for an existing job id (no create call)
# ---------------------------------------------------------------------------

cmd_poll() {
  if ! check_curl_jq; then return 2; fi

  if [ $# -eq 0 ]; then
    echo "ERROR: 'poll' requires a job id, e.g. $0 poll abc123" >&2
    return 1
  fi
  local job_id="$1"
  shift

  local out_dir="$PWD"
  local max_wait="$DEFAULT_MAX_WAIT"
  local poll_interval="$DEFAULT_POLL_INTERVAL"
  local key val

  while [ $# -gt 0 ]; do
    key="$1"
    case "$key" in
      --out-dir|--max-wait|--poll-interval)
        if [ $# -lt 2 ]; then
          echo "ERROR: $key requires a value." >&2
          return 1
        fi
        val="$2"
        shift 2
        ;;
      *)
        echo "ERROR: unknown option '$key' for poll." >&2
        return 1
        ;;
    esac
    case "$key" in
      --out-dir) out_dir="$val" ;;
      --max-wait) max_wait="$val" ;;
      --poll-interval) poll_interval="$val" ;;
    esac
  done

  if ! check_api_key; then return 2; fi

  poll_and_download "$job_id" "$API_BASE/videos/$job_id" "$out_dir" "$max_wait" "$poll_interval"
  return $?
}

# ---------------------------------------------------------------------------
# shared polling + download loop
# ---------------------------------------------------------------------------

poll_and_download() {
  local job_id="$1" polling_url="$2" out_dir="$3" max_wait="$4" poll_interval="$5"
  local elapsed=0 tmp_body http_code curl_rc body status
  local out_dir_input="$out_dir"

  mkdir -p "$out_dir" 2>/dev/null

  # Resolve out_dir to an absolute, canonical path before it's used to build
  # any output path in download_result(). A caller-supplied relative
  # --out-dir (e.g. '.' or 'some/subdir') must never leak into a printed
  # VIDEO_PATH — the location of the downloaded file is this skill's actual
  # deliverable. Portable bash builtins only, no readlink -f/realpath
  # dependency (matches the curl+jq-only contract).
  out_dir=$(cd "$out_dir" 2>/dev/null && pwd)
  if [ -z "$out_dir" ]; then
    echo "ERROR: --out-dir '$out_dir_input' could not be created or entered (bad path or missing permissions)." >&2
    echo "Job $job_id was not affected by this — it may already exist or still be running server-side." >&2
    echo "Do NOT re-run 'generate' for the same request. Fix --out-dir to a writable directory and re-run:" >&2
    echo "  $0 poll $job_id --out-dir <a writable directory>" >&2
    return 6
  fi

  while [ "$elapsed" -lt "$max_wait" ]; do
    tmp_body=$(mktemp)
    http_code=$(curl -sS -o "$tmp_body" -w '%{http_code}' \
      -H "Authorization: Bearer $OFOX_API_KEY" \
      "$polling_url")
    curl_rc=$?
    body=$(cat "$tmp_body")
    rm -f "$tmp_body"

    if [ "$curl_rc" -ne 0 ]; then
      echo "WARN: poll request failed (curl exit $curl_rc). Retrying the POLL (not create) in ${poll_interval}s..." >&2
      sleep "$poll_interval"
      elapsed=$((elapsed + poll_interval))
      continue
    fi

    case "$http_code" in
      200)
        status=$(printf '%s' "$body" | jq -r '.status // empty')
        case "$status" in
          completed)
            download_result "$job_id" "$body" "$out_dir"
            return $?
            ;;
          failed|cancelled|expired)
            echo "ERROR: job $job_id ended with status '$status'." >&2
            print_error_message "$(printf '%s' "$body" | jq -r '.error.code // empty')"
            # Same rule as print_api_error(): a terminal failed/cancelled/
            # expired job can carry a useful error.message even when the
            # response itself was a normal HTTP 200 (this is exactly how
            # output_moderation_failed was first found — a 200 poll response
            # with a job-level failure, not an HTTP-level error) — never
            # swallow it.
            local job_message
            job_message=$(printf '%s' "$body" | jq -r '.error.message // empty' 2>/dev/null)
            if [ -n "$job_message" ]; then
              echo "  Upstream message: $job_message" >&2
            fi
            return 3
            ;;
          pending|queued|in_progress)
            sleep "$poll_interval"
            elapsed=$((elapsed + poll_interval))
            ;;
          *)
            echo "WARN: unrecognized status '$status' in poll response, continuing to poll..." >&2
            sleep "$poll_interval"
            elapsed=$((elapsed + poll_interval))
            ;;
        esac
        ;;
      429)
        echo "WARN: rate limited while polling. Backing off ${poll_interval}s (retrying the poll, not create)..." >&2
        sleep "$poll_interval"
        elapsed=$((elapsed + poll_interval))
        ;;
      5??)
        echo "WARN: upstream error (HTTP $http_code) while polling. Retrying the poll (not create) in ${poll_interval}s..." >&2
        sleep "$poll_interval"
        elapsed=$((elapsed + poll_interval))
        ;;
      *)
        print_api_error "poll" "$http_code" "$body"
        return 3
        ;;
    esac
  done

  echo "TIMEOUT: job $job_id has not reached a terminal state after ${max_wait}s." >&2
  echo "The job is very likely still running upstream. Re-run:" >&2
  echo "  $0 poll $job_id" >&2
  echo "Do NOT re-run 'generate' for the same request — that creates a duplicate, separately billed job." >&2
  return 4
}

# Build the readable part of an output filename.
#
# Priority: an explicit --name from the caller, then the job's own prompt.
# The prompt is present in every poll response, so a bare `poll JOB_ID` in a
# fresh shell — with no memory of what was generated — still produces a
# meaningful name instead of degrading to a raw job id. Prints nothing when
# there is no usable source, which is the caller's signal to fall back to the
# job id.
#
# Slicing happens in jq, not bash. jq slices by codepoint and is
# locale-independent, so a CJK prompt can never be cut mid-character the way
# `cut -b` would, and the result doesn't change under LC_ALL=C. jq is already
# a hard dependency of this script, so this costs no new requirement.
#
# Both sources are untrusted text that becomes part of a path: a --name comes
# from a calling skill, and a prompt comes from whoever wrote it. Path
# separators, characters illegal on Windows filesystems, and control
# characters are stripped, then leading dots and dashes are removed, so
# '../../etc/passwd' cannot survive as anything traversable and nothing turns
# into a hidden file or a leading-dash pseudo-flag.
build_output_slug() {
  local name_hint="$1" prompt="$2" raw=""

  if [ -n "$name_hint" ]; then
    raw="$name_hint"
  else
    raw="$prompt"
  fi
  [ -z "$raw" ] && return 0

  # Order matters twice over. Whitespace is collapsed to a dash *before*
  # control characters are stripped, because tab and newline are both: strip
  # them first and "line one\nline two" glues into "line onelinetwo" instead
  # of separating into words. And the slice comes before the final trim,
  # because the slice itself can land on a separator and leave a trailing
  # dash.
  #
  # Control characters are matched with the POSIX class [[:cntrl:]], never
  # with a backslash-u codepoint range. jq's regex engine (Oniguruma) reads a
  # backslash-u escape inside a *pattern* as the literal letters u, 0, 0, ...,
  # which collapses such a range into the ASCII range 0-u: it silently deletes
  # most letters and digits while leaving the real control characters in
  # place, the exact opposite of the intent. Verified: "A dim convenience
  # store" came back as "  v ".
  jq -rn --arg s "$raw" --argjson max "$SLUG_MAX_CHARS" '
    $s
    | gsub("\\s+"; "-")
    | gsub("[[:cntrl:]]"; "")
    | gsub("[/\\\\:*?\"<>|]"; "")
    | gsub("-+"; "-")
    | .[0:$max]
    | sub("^[-.]+"; "")
    | sub("[-.]+$"; "")
  '
}

download_result() {
  local job_id="$1" body="$2" out_dir="$3"
  local urls=() url

  # Prefer mirror_urls (CDN-signed, persistent) when present. In practice,
  # not every completed job includes mirror_urls (observed absent on a real
  # bytedance/seedance-2.5 text-to-video completion) — fall back to
  # unsigned_urls in that case rather than treating a completed job as an
  # error. unsigned_urls links are documented as temporary (may expire
  # within 24h), but once we've downloaded the file here, the file is saved
  # locally either way — the expiry window is irrelevant to the caller from
  # this point on, so no separate handling is needed downstream.
  while IFS= read -r url; do
    [ -n "$url" ] && urls+=("$url")
  done < <(printf '%s' "$body" | jq -r '
    if (.mirror_urls | type) == "array" then .mirror_urls[]?
    elif (.mirror_urls | type) == "string" then .mirror_urls
    else empty end')

  if [ ${#urls[@]} -eq 0 ]; then
    while IFS= read -r url; do
      [ -n "$url" ] && urls+=("$url")
    done < <(printf '%s' "$body" | jq -r '
      if (.unsigned_urls | type) == "array" then .unsigned_urls[]?
      elif (.unsigned_urls | type) == "string" then .unsigned_urls
      else empty end')
  fi

  if [ ${#urls[@]} -eq 0 ]; then
    echo "ERROR: job $job_id completed but the response has neither mirror_urls nor unsigned_urls — refusing to guess a download link." >&2
    echo "Raw response body:" >&2
    printf '%s\n' "$body" >&2
    return 3
  fi

  local cost seconds
  cost=$(printf '%s' "$body" | jq -r '.usage.video_cost // "unknown"')
  seconds=$(printf '%s' "$body" | jq -r '.usage.video_seconds // "unknown"')

  local i=0 count=${#urls[@]} paths=() ext fname outpath

  for url in "${urls[@]}"; do
    i=$((i + 1))
    ext=$(printf '%s' "$url" | sed -E 's/[?#].*$//; s/^.*\.//')
    case "$ext" in
      mp4|mov|webm|m4v) ;;
      *) ext="mp4" ;;
    esac
    if [ "$count" -gt 1 ]; then
      fname="${job_id}_${i}.${ext}"
    else
      fname="${job_id}.${ext}"
    fi
    outpath="${out_dir%/}/${fname}"
    if ! curl -fsSL "$url" -o "$outpath"; then
      echo "ERROR: failed to download from: $url" >&2
      return 3
    fi
    paths+=("$outpath")
  done

  echo "STATUS completed"
  echo "JOB_ID $job_id"
  for outpath in "${paths[@]}"; do
    echo "VIDEO_PATH $outpath"
  done
  echo "VIDEO_SECONDS $seconds"
  echo "VIDEO_COST $cost"
  return 0
}

# ---------------------------------------------------------------------------
# entry point
# ---------------------------------------------------------------------------

main() {
  local mode="${1:-}"
  case "$mode" in
    check)
      cmd_check
      return $?
      ;;
    models)
      cmd_models
      return $?
      ;;
    providers)
      shift
      cmd_providers "$@"
      return $?
      ;;
    generate)
      shift
      cmd_generate "$@"
      return $?
      ;;
    create)
      # Same as generate, minus the waiting. See cmd_generate's submit_only.
      shift
      OFOX_SUBMIT_ONLY=1 cmd_generate "$@"
      return $?
      ;;
    batch)
      shift
      cmd_batch "$@"
      return $?
      ;;
    contact-sheet)
      shift
      cmd_contact_sheet "$@"
      return $?
      ;;
    chain)
      shift
      cmd_chain "$@"
      return $?
      ;;
    last-frame)
      shift
      cmd_last_frame "$@"
      return $?
      ;;
    poll)
      shift
      cmd_poll "$@"
      return $?
      ;;
    -h|--help|"")
      usage
      return 1
      ;;
    *)
      echo "ERROR: unknown command '$mode'." >&2
      usage
      return 1
      ;;
  esac
}

main "$@"
exit $?
