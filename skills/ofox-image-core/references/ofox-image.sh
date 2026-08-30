#!/usr/bin/env bash
# ofox-image.sh — Ofox image generation API client: validate, request, decode, save.
#
# Part of the ofox-image-core skill. Dependencies: bash, curl, jq. Nothing else.
#
# OFOX_API_KEY is read ONLY from the shell environment (never from a dotenv
# file, never hardcoded). The raw key is never printed by this script.
#
# Unlike the Ofox video API, image generation is SYNCHRONOUS — there is no
# job id and no polling. One request either returns the image(s) in the
# response body, or fails. That also means there is no free "poll to check
# what happened" recovery path: every real call that reaches the API is a
# real spend attempt, and if the network drops before any HTTP response
# comes back, there is no job id to look up later to find out what happened
# (see exit 5 below).
#
# Usage:
#   ofox-image.sh check
#   ofox-image.sh models
  ofox-image.sh models
#   ofox-image.sh generate --prompt "..." --model NAME --quality VAL [OPTIONS]
#
# generate OPTIONS:
#   --model NAME              required — no default, on purpose. The image
#                               models differ roughly 4x in price
#                               (mai-image-2.5-flash to mai-image-2.5-pro) with
#                               no obvious default winner, so picking one for
#                               you would silently pick a price. Contrast
#                               ofox-video-core, which does default, because
#                               every scenario there targets Seedance 2.5.
#                               Run 'models' to list them. Documented in depth
#                               here: openai/gpt-image-2,
#                               google/gemini-3.1-flash-image,
#                               bailian/qwen-image-3.0-pro. Every other image
#                               model Ofox serves also works; only their
#                               size/quality support is undocumented here.
#   --prompt TEXT        required.
#   --quality VAL        required (documented as required by the API).
#                          One of: auto low medium high standard hd
#                          Not every value is confirmed to apply to every
#                          model — no default is guessed here, pass exactly
#                          the value you intend.
#   --size VAL           optional. One of:
#                          auto 1024x1024 1536x1024 1024x1536 256x256
#                          512x512 1792x1024 1024x1792
#   --n N                optional, integer 1-10 (server default 1).
#                          NOT supported by google/gemini-3.1-flash-image —
#                          passing --n at all with that model is a client-
#                          side validation error (rejected before any
#                          network call), matching the documented gotcha
#                          that Gemini rejects the n field outright.
#   --output-format VAL  optional. One of: png jpeg webp
#   --background VAL     optional. One of: transparent opaque auto
#   --extra-json JSON    optional, merged into the request body as-is
#                          (escape hatch for fields not exposed as a flag,
#                          e.g. extra_body.provider.type — gpt-image-2 only).
#                          Rejected if it sets "input_images" (image-to-image
#                          is out of scope for this script — see below) or
#                          "stream": true (this script only parses a plain
#                          JSON response body, not a streamed one), or if it
#                          sets "n" while --model is
#                          google/gemini-3.1-flash-image.
#   --out-dir DIR        optional, default: current directory.
#   --out-name NAME      optional base filename (no extension, no path
#                          separators). Default: ofox_image_<timestamp>_<pid>.
#
# Out of scope for this script (see skills/ofox-image-core/SKILL.md):
#   - input_images / image-to-image generation (Qwen-only field on this same
#     endpoint) — text-to-image only.
#   - POST /v1/images/edits (a different, multipart-form endpoint).
#
# Exit codes:
#   0  success — image(s) decoded and saved, usage token counts printed.
#   1  usage / parameter validation error (no network call made).
#   2  environment error (missing curl/jq/OFOX_API_KEY).
#   3  API rejected the request, or the response could not be parsed into a
#      usable image.
#   4  --out-dir could not be created or entered (bad path, permissions) —
#      a local filesystem problem, caught BEFORE any network call is made
#      (out-dir is resolved up front for exactly this reason: no reason to
#      spend money on a request whose output can't be written anywhere).
#   5  ambiguous network failure on the generate call — no HTTP response was
#      received at all (curl exit nonzero, no HTTP status). Unlike the video
#      API, there is no job id and no poll endpoint to check afterwards —
#      the only way to find out whether this was billed is to check your
#      usage/billing history at https://app.ofox.ai. Do not blindly retry.
#
# Whether a REJECTED request (a real HTTP error response, e.g. 4xx) is
# billed is NOT confirmed for this endpoint as of writing — this script
# assumes (but has not verified with a real call) that it follows the same
# pattern as most billed generation APIs: a request that never produced an
# image is not charged. Treat that as an open question until a real error
# case has been observed and documented, not as a settled fact.

set -u

API_BASE="${OFOX_API_BASE_URL:-https://api.ofox.ai/v1}"
GET_KEY_URL="https://app.ofox.ai"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_SNAPSHOT="$SCRIPT_DIR/models-snapshot.json"
MODELS_CACHE_TTL="${OFOX_MODELS_TTL:-86400}" # 24h

# The models this skill's docs and pricing notes cover in depth. It is NOT a
# whitelist — --model is checked against the live model list (see load_models),
# so any image model Ofox offers works. This is only what gets named in help
# text when we have no list to name real models from.
DOCUMENTED_MODELS="openai/gpt-image-2 google/gemini-3.1-flash-image bailian/qwen-image-3.0-pro"

# Set by load_models(): the file holding the model list, and where it came
# from ("live" | "cache" | "stale-cache" | "snapshot").
MODELS_FILE=""
MODELS_SOURCE=""
VALID_SIZES="auto 1024x1024 1536x1024 1024x1536 256x256 512x512 1792x1024 1024x1792"
VALID_QUALITIES="auto low medium high standard hd"
VALID_OUTPUT_FORMATS="png jpeg webp"
VALID_BACKGROUNDS="transparent opaque auto"
NO_N_MODEL="google/gemini-3.1-flash-image"

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

decode_b64_to_file() {
  # $1 = base64 string, $2 = destination path.
  # Portable base64 decode: GNU coreutils uses -d; older BSD/macOS base64
  # only understands -D. Try -d first (works on GNU and modern macOS),
  # fall back to -D (older macOS) if that fails.
  local b64="$1" outfile="$2"
  if printf '%s' "$b64" | base64 -d >"$outfile" 2>/dev/null && [ -s "$outfile" ]; then
    return 0
  fi
  if printf '%s' "$b64" | base64 -D >"$outfile" 2>/dev/null && [ -s "$outfile" ]; then
    return 0
  fi
  return 1
}

# ---------------------------------------------------------------------------
# model list
#
# GET /v1/models is public, keyless and free, and reports which models serve
# /v1/images/generations. Checking --model against it means this skill works
# with every image model Ofox offers instead of a hand-maintained list of
# three that silently rejected the other eleven.
#
# Unlike the video API, the models endpoint exposes no per-model size/quality
# capability data for image models (there is no image_attributes to match
# video_attributes), so --size/--quality/--output-format/--background stay
# hardcoded from the docs. Only the model id itself is validated dynamically.
#
# This mirrors the same logic in ofox-video-core's ofox-video.sh rather than
# sharing it: each skill must work when installed on its own, so a shared file
# across skill directories is not an option (CONTRIBUTING rule 7).
#
# Order of preference: fresh cache -> live fetch -> stale cache -> bundled
# snapshot -> no check at all. A missing model list never blocks a request
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
    echo "NOTE: could not reach $API_BASE/models; checking --model against the bundled snapshot ($snap_date). A model added since then may be rejected here — set OFOX_SKIP_MODEL_VALIDATION=1 to skip the check." >&2
    return 0
  fi

  MODELS_SOURCE="none"
  echo "NOTE: no model list available (fetch failed, no cache, no bundled snapshot). Skipping the --model check; the API will have the final say." >&2
  return 1
}

model_entry() {
  # $1 = model id (or one of its aliases). Prints that model's whole entry as
  # compact JSON, or nothing if the list doesn't have it.
  [ -n "$MODELS_FILE" ] || return 1
  jq -c --arg m "$1" \
    'first(.data[] | select(.id == $m or ((.aliases // []) | index($m)) != null)) // empty' \
    "$MODELS_FILE" 2>/dev/null
}

infer_extension() {
  # $1 = the --output-format value the caller requested (may be empty).
  # The documented response shape has no format/output_format field of its
  # own (only created/data/model/size/quality/usage) — so when the caller
  # didn't request a format, there is nothing in the response to infer it
  # from either. Default to png: it's what the documented example request
  # uses, it's lossless, and every model/provider fronted by this endpoint
  # is expected to support it.
  local output_format="$1"
  case "$output_format" in
    png) echo "png" ;;
    jpeg|jpg) echo "jpg" ;;
    webp) echo "webp" ;;
    *) echo "png" ;;
  esac
}

usage() {
  cat >&2 <<'EOF'
ofox-image.sh — Ofox image generation API client (synchronous: request,
decode, save; no job id, no polling).

  ofox-image.sh check
  ofox-image.sh generate --prompt "..." --model NAME --quality VAL [OPTIONS]

Run with no arguments for this message. See the top of this file, or
skills/ofox-image-core/SKILL.md and references/api-params.md, for the full
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
  local ok=0
  check_curl_jq || ok=1
  check_api_key || ok=1
  if [ "$ok" -eq 0 ]; then
    echo "OK: curl, jq, and OFOX_API_KEY are all present."
  fi
  return "$ok"
}

cmd_models() {
  # Lists the image models with their per-image output price. Needs no API key
  # — GET /v1/models is public — so it is safe to run before signing up.
  check_curl_jq || return 2
  load_models || true
  if [ -z "$MODELS_FILE" ]; then
    echo "ERROR: could not obtain a model list (no network, no cache, no bundled snapshot)." >&2
    return 3
  fi

  echo "Image models (source: $MODELS_SOURCE)"
  echo
  jq -r '
    ["MODEL", "$/OUTPUT IMAGE TOKEN"],
    (.data[]
      | select((.supported_endpoints // []) | index("/v1/images/generations"))
      | [ .id + (if .is_deprecated then " (deprecated)" else "" end),
          (.pricing.output_image // "-") ])
    | @tsv' "$MODELS_FILE" | column -t -s "$(printf '\t')"

  echo
  echo "Prices are per output image token, not per image — see references/pricing.md"
  echo "for how that turns into a cost. This skill documents these in depth:"
  echo "  $DOCUMENTED_MODELS"
  echo "Others work but their size/quality support is not documented here."
  return 0
}

# ---------------------------------------------------------------------------
# error mapping
#
# This endpoint's error vocabulary has NOT been broadly explored. A real
# rejected call (2026-08-29, an invalid extra_body.provider.type) showed the
# actual error shape is {"error": {"message", "type", "code"}} — an
# OpenAI-SDK-style shape, DIFFERENT from the video API's {code, message}
# shape where "code" was a real semantic string. Here, error.code was
# literally the HTTP status as a NUMBER (400), not a semantic string — the
# real classifier is error.type (only "invalid_request_error" confirmed so
# far). Two message-only gotchas (Gemini + /v1/images/edits, Gemini + n) are
# doc-prose-only and are both caught client-side before any network call in
# this script anyway. Anything else below is deliberately treated as
# unconfirmed rather than guessed: the raw error.message is always printed
# either way, since it is often more specific than any fixed mapping this
# script could offer.
# ---------------------------------------------------------------------------

print_api_error() {
  # $1 = context ("generate"), $2 = http_code, $3 = response body
  local context="$1" http_code="$2" body="$3" err_type code message
  err_type=$(printf '%s' "$body" | jq -r '.error.type // empty' 2>/dev/null)
  code=$(printf '%s' "$body" | jq -r '.error.code // empty' 2>/dev/null)
  message=$(printf '%s' "$body" | jq -r '.error.message // empty' 2>/dev/null)
  echo "ERROR: Ofox API rejected the $context request (HTTP $http_code)." >&2
  case "$err_type" in
    invalid_request_error)
      echo "  error.type: invalid_request_error — the request itself was rejected as malformed or unsupported (e.g. an unknown extra_body.provider.type, or another bad field/value). See the upstream message below for the specific reason." >&2
      ;;
    "")
      echo "  (no error.type in the response body)" >&2
      ;;
    *)
      echo "  error.type: $err_type — not yet confirmed/documented for /v1/images/generations (only invalid_request_error has been observed so far). See the raw upstream message below and https://ofox.ai/docs/api/openai/images for current guidance." >&2
      ;;
  esac
  if [ -n "$code" ]; then
    echo "  error.code: $code (on the one real rejection observed so far this was just the HTTP status number, not a semantic string — error.type above is the useful classifier here, unlike the video API)." >&2
  fi
  if [ -n "$message" ]; then
    echo "  Upstream message: $message" >&2
  elif [ -z "$err_type" ] && [ -z "$code" ]; then
    echo "  Raw response body:" >&2
    printf '%s\n' "$body" >&2
  fi
}

# ---------------------------------------------------------------------------
# generate: validate params, build payload, POST, decode, save
# ---------------------------------------------------------------------------

cmd_generate() {
  if ! check_curl_jq; then return 2; fi

  local model=""
  local prompt=""
  local quality=""
  local size=""
  local n=""
  local output_format=""
  local background=""
  local extra_json=""
  local out_dir="$PWD"
  local out_name=""
  local key val

  while [ $# -gt 0 ]; do
    key="$1"
    case "$key" in
      --model|--prompt|--quality|--size|--n|--output-format|--background|--extra-json|--out-dir|--out-name)
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
      --quality) quality="$val" ;;
      --size) size="$val" ;;
      --n) n="$val" ;;
      --output-format) output_format="$val" ;;
      --background) background="$val" ;;
      --extra-json) extra_json="$val" ;;
      --out-dir) out_dir="$val" ;;
      --out-name) out_name="$val" ;;
    esac
  done

  # --- validation (no network calls made before this point) ---

  if [ -z "$model" ]; then
    echo "ERROR: --model is required. Run 'ofox-image.sh models' to list them; this skill documents $DOCUMENTED_MODELS in depth." >&2
    return 1
  fi

  if [ "${OFOX_SKIP_MODEL_VALIDATION:-}" != "1" ] && load_models; then
    local entry
    entry="$(model_entry "$model")"
    if [ -z "$entry" ]; then
      # An id the list doesn't have. Only treat that as an error when the list
      # is current — a snapshot may simply predate the model.
      if [ "$MODELS_SOURCE" = "snapshot" ] || [ "$MODELS_SOURCE" = "stale-cache" ]; then
        echo "NOTE: '$model' is not in the $MODELS_SOURCE model list, which may just be out of date. Sending it anyway; the API will validate it." >&2
      else
        echo "ERROR: --model '$model' is not in the Ofox model list. Run 'ofox-image.sh models' to see what is available." >&2
        return 1
      fi
    elif ! printf '%s' "$entry" | jq -e '(.supported_endpoints // []) | index("/v1/images/generations")' >/dev/null 2>&1; then
      echo "ERROR: --model '$model' exists but does not support image generation (/v1/images/generations). Run 'ofox-image.sh models' to see the image models." >&2
      return 1
    elif printf '%s' "$entry" | jq -e '.is_deprecated == true' >/dev/null 2>&1; then
      echo "NOTE: '$model' is marked deprecated by Ofox. It still runs for now; consider moving to a current model." >&2
    fi
  fi

  if [ -z "$prompt" ]; then
    echo "ERROR: --prompt is required." >&2
    return 1
  fi

  if [ -z "$quality" ]; then
    echo "ERROR: --quality is required (Ofox documents it as a required field). Valid values: $VALID_QUALITIES. No default is assumed here — not every value is confirmed to apply to every model." >&2
    return 1
  fi
  if ! list_contains "$quality" "$VALID_QUALITIES"; then
    echo "ERROR: --quality '$quality' is not a documented value. Valid values: $VALID_QUALITIES" >&2
    return 1
  fi

  if [ -n "$size" ] && ! list_contains "$size" "$VALID_SIZES"; then
    echo "ERROR: --size '$size' is not a documented value. Valid values: $VALID_SIZES" >&2
    return 1
  fi

  if [ -n "$n" ]; then
    case "$n" in
      ''|*[!0-9]*)
        echo "ERROR: --n must be a positive integer (got '$n')." >&2
        return 1
        ;;
    esac
    if [ "$n" -lt 1 ] || [ "$n" -gt 10 ]; then
      echo "ERROR: --n must be between 1 and 10 (got $n)." >&2
      return 1
    fi
    if [ "$model" = "$NO_N_MODEL" ]; then
      echo "ERROR: --n is not supported by $NO_N_MODEL at all (documented gotcha: passing n, even n=1, errors for this model). Omit --n." >&2
      return 1
    fi
  fi

  if [ -n "$output_format" ] && ! list_contains "$output_format" "$VALID_OUTPUT_FORMATS"; then
    echo "ERROR: --output-format '$output_format' is not a documented value. Valid values: $VALID_OUTPUT_FORMATS" >&2
    return 1
  fi

  if [ -n "$background" ] && ! list_contains "$background" "$VALID_BACKGROUNDS"; then
    echo "ERROR: --background '$background' is not a documented value. Valid values: $VALID_BACKGROUNDS" >&2
    return 1
  fi

  if [ -n "$out_name" ]; then
    case "$out_name" in
      */*)
        echo "ERROR: --out-name must be a bare filename with no path separators (got '$out_name')." >&2
        return 1
        ;;
      "")
        echo "ERROR: --out-name must not be empty." >&2
        return 1
        ;;
    esac
  fi

  if [ -n "$extra_json" ]; then
    if ! printf '%s' "$extra_json" | jq -e . >/dev/null 2>&1; then
      echo "ERROR: --extra-json is not valid JSON." >&2
      return 1
    fi
    if printf '%s' "$extra_json" | jq -e 'has("input_images")' >/dev/null 2>&1; then
      echo "ERROR: --extra-json sets 'input_images' — image-to-image is out of scope for ofox-image-core v1 (text-to-image only). See SKILL.md." >&2
      return 1
    fi
    if printf '%s' "$extra_json" | jq -e '.stream == true' >/dev/null 2>&1; then
      echo "ERROR: --extra-json sets 'stream: true' — this script only parses a plain JSON response body, not a streamed one. Omit stream or leave it false." >&2
      return 1
    fi
    if [ "$model" = "$NO_N_MODEL" ] && printf '%s' "$extra_json" | jq -e 'has("n")' >/dev/null 2>&1; then
      echo "ERROR: --extra-json sets 'n' while --model is $NO_N_MODEL, which does not support n at all. Remove it from --extra-json." >&2
      return 1
    fi
  fi

  # --out-dir is resolved (created if needed) and validated BEFORE the
  # network call — a local filesystem problem should never be discovered
  # only after a real, billable request has already been sent.
  local out_dir_input="$out_dir"
  mkdir -p "$out_dir" 2>/dev/null
  out_dir=$(cd "$out_dir" 2>/dev/null && pwd)
  if [ -z "$out_dir" ]; then
    echo "ERROR: --out-dir '$out_dir_input' could not be created or entered (bad path or missing permissions)." >&2
    return 4
  fi

  if ! check_api_key; then return 2; fi

  # --- build the request payload ---

  local payload='{}'
  payload=$(printf '%s' "$payload" | jq --arg v "$model" '.model=$v')
  payload=$(printf '%s' "$payload" | jq --arg v "$prompt" '.prompt=$v')
  payload=$(printf '%s' "$payload" | jq --arg v "$quality" '.quality=$v')
  [ -n "$size" ] && payload=$(printf '%s' "$payload" | jq --arg v "$size" '.size=$v')
  [ -n "$n" ] && payload=$(printf '%s' "$payload" | jq --argjson v "$n" '.n=$v')
  [ -n "$output_format" ] && payload=$(printf '%s' "$payload" | jq --arg v "$output_format" '.output_format=$v')
  [ -n "$background" ] && payload=$(printf '%s' "$payload" | jq --arg v "$background" '.background=$v')

  if [ -n "$extra_json" ]; then
    payload=$(printf '%s' "$payload" | jq --argjson extra "$extra_json" '. * $extra')
  fi

  # --- the one and only network call ---

  echo "Requesting image generation from Ofox (model=$model)..." >&2
  local tmp_body http_code curl_rc body
  tmp_body=$(mktemp)
  http_code=$(curl -sS -o "$tmp_body" -w '%{http_code}' \
    -X POST "$API_BASE/images/generations" \
    -H "Authorization: Bearer $OFOX_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")
  curl_rc=$?
  body=$(cat "$tmp_body")
  rm -f "$tmp_body"

  if [ "$curl_rc" -ne 0 ]; then
    echo "ERROR: could not reach the Ofox API (curl exit $curl_rc) — no HTTP response was received at all." >&2
    echo "This is a synchronous, no-job-id endpoint: there is no poll/dashboard job entry to check by id." >&2
    echo "Check your usage/billing history at ${GET_KEY_URL} before deciding whether to retry." >&2
    return 5
  fi

  if [ "$http_code" != "200" ]; then
    print_api_error "generate" "$http_code" "$body"
    return 3
  fi

  # --- decode and save ---

  local count
  count=$(printf '%s' "$body" | jq -r '.data | length' 2>/dev/null)
  if [ -z "$count" ] || [ "$count" = "null" ] || ! [ "$count" -gt 0 ] 2>/dev/null; then
    echo "ERROR: got HTTP 200 but the response has no usable data[] entries — unexpected response shape." >&2
    echo "Raw response body:" >&2
    printf '%s\n' "$body" >&2
    return 3
  fi

  local ext base_name
  ext=$(infer_extension "$output_format")
  base_name="${out_name:-ofox_image_$(date +%Y%m%d%H%M%S)_$$}"

  local idx=0 item b64 outpath paths=()
  while IFS= read -r item; do
    b64=$(printf '%s' "$item" | jq -r '.b64_json // empty')
    if [ -z "$b64" ]; then
      echo "ERROR: data[$idx] has no b64_json field — unexpected response shape." >&2
      echo "Raw response body:" >&2
      printf '%s\n' "$body" >&2
      return 3
    fi
    if [ "$count" -gt 1 ]; then
      outpath="${out_dir%/}/${base_name}_${idx}.${ext}"
    else
      outpath="${out_dir%/}/${base_name}.${ext}"
    fi
    if ! decode_b64_to_file "$b64" "$outpath"; then
      echo "ERROR: failed to base64-decode image data[$idx] to $outpath." >&2
      return 3
    fi
    paths+=("$outpath")
    idx=$((idx + 1))
  done < <(printf '%s' "$body" | jq -c '.data[]')

  local resp_model resp_size resp_quality input_tokens output_tokens total_tokens
  resp_model=$(printf '%s' "$body" | jq -r '.model // "unknown"')
  resp_size=$(printf '%s' "$body" | jq -r '.size // "unknown"')
  resp_quality=$(printf '%s' "$body" | jq -r '.quality // "unknown"')
  input_tokens=$(printf '%s' "$body" | jq -r '.usage.input_tokens // "unknown"')
  output_tokens=$(printf '%s' "$body" | jq -r '.usage.output_tokens // "unknown"')
  total_tokens=$(printf '%s' "$body" | jq -r '.usage.total_tokens // "unknown"')

  echo "STATUS completed"
  for outpath in "${paths[@]}"; do
    echo "IMAGE_PATH $outpath"
  done
  echo "MODEL $resp_model"
  echo "SIZE $resp_size"
  echo "QUALITY $resp_quality"
  echo "USAGE_INPUT_TOKENS $input_tokens"
  echo "USAGE_OUTPUT_TOKENS $output_tokens"
  echo "USAGE_TOTAL_TOKENS $total_tokens"
  echo "See references/pricing.md before quoting a dollar cost — no verified" >&2
  echo "per-token dollar rate has been confirmed against a real response yet." >&2
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
    generate)
      shift
      cmd_generate "$@"
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
