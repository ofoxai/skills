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
#   ofox-video.sh generate --prompt "..." [OPTIONS]
#   ofox-video.sh poll JOB_ID [--out-dir DIR] [--max-wait SECONDS] [--poll-interval SECONDS]
#
# generate OPTIONS:
#   --model NAME              default: bytedance/seedance-2.5
#   --prompt TEXT             required
#   --duration N               seconds (Seedance 2.5: 4-30)
#   --resolution VAL            480p | 720p | 1080p | 1K | 2K | 4K
#   --aspect-ratio VAL          16:9 | 9:16 | 1:1 | 4:3 | 3:4 | 3:2 | 2:3 | 21:9 | 9:21 | adaptive
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

VALID_RESOLUTIONS="480p 720p 1080p 1K 2K 4K"
VALID_ASPECT_RATIOS="16:9 9:16 1:1 4:3 3:4 3:2 2:3 21:9 9:21 adaptive"

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
  ofox-video.sh generate --prompt "..." [OPTIONS]
  ofox-video.sh poll JOB_ID [--out-dir DIR] [--max-wait SECONDS] [--poll-interval SECONDS]

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
  local ok=0
  check_curl_jq || ok=1
  check_api_key || ok=1
  if [ "$ok" -eq 0 ]; then
    echo "OK: curl, jq, and OFOX_API_KEY are all present."
  fi
  return "$ok"
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
      echo "  output_moderation_failed: the job's OUTPUT failed a post-generation content check — this happens AFTER the video was generated, not at submission, and cannot be caught by client-side validation. This job is NOT billed (no usage field on the response). Safe fix: submit a brand-new generate call with a different prompt or reference image/audio — this is a new request, not a resubmission of the failed one." >&2 ;;
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
      --model|--prompt|--duration|--resolution|--aspect-ratio|--size|--generate-audio|--seed|--frame-first-image|--frame-last-image|--real-person|--callback-url|--extra-json|--out-dir|--max-wait|--poll-interval)
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
    if [ "$model" = "bytedance/seedance-2.5" ]; then
      if [ "$duration" -lt 4 ] || [ "$duration" -gt 30 ]; then
        echo "ERROR: --duration must be between 4 and 30 for bytedance/seedance-2.5 (got $duration)." >&2
        return 1
      fi
    fi
  fi

  if [ -n "$resolution" ] && ! list_contains "$resolution" "$VALID_RESOLUTIONS"; then
    echo "ERROR: --resolution '$resolution' is not supported. Valid values: $VALID_RESOLUTIONS" >&2
    return 1
  fi

  if [ -n "$aspect_ratio" ] && ! list_contains "$aspect_ratio" "$VALID_ASPECT_RATIOS"; then
    echo "ERROR: --aspect-ratio '$aspect_ratio' is not supported. Valid values: $VALID_ASPECT_RATIOS" >&2
    return 1
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

  if ! check_api_key; then return 2; fi

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

  if [ -n "$frame_first" ] || [ -n "$frame_last" ]; then
    local frames='[]' frame_first_ref frame_last_ref
    if [ -n "$frame_first" ]; then
      frame_first_ref=$(resolve_image_ref "$frame_first") || return 1
      frames=$(printf '%s' "$frames" | jq --arg u "$frame_first_ref" '. + [{"type":"image_url","image_url":{"url":$u},"frame_type":"first_frame"}]')
    fi
    if [ -n "$frame_last" ]; then
      frame_last_ref=$(resolve_image_ref "$frame_last") || return 1
      frames=$(printf '%s' "$frames" | jq --arg u "$frame_last_ref" '. + [{"type":"image_url","image_url":{"url":$u},"frame_type":"last_frame"}]')
    fi
    payload=$(printf '%s' "$payload" | jq --argjson f "$frames" '.frame_images=$f')
  fi

  if [ -n "$extra_json" ]; then
    payload=$(printf '%s' "$payload" | jq --argjson extra "$extra_json" '. * $extra')
  fi

  # --- create the job (exactly one create call per invocation) ---

  echo "Submitting job to Ofox (model=$model)..." >&2
  local tmp_body http_code curl_rc body
  tmp_body=$(mktemp)
  http_code=$(curl -sS -o "$tmp_body" -w '%{http_code}' \
    -X POST "$API_BASE/videos" \
    -H "Authorization: Bearer $OFOX_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$payload")
  curl_rc=$?
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

  poll_and_download "$job_id" "$polling_url" "$out_dir" "$max_wait" "$poll_interval"
  return $?
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
    generate)
      shift
      cmd_generate "$@"
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
