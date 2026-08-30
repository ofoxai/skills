// ttl.mjs — the single source of truth for the countdown window (round-015).
//
// WHAT THIS IS AND IS NOT:
// The countdown baked into a deployed page is a *display* of how long the link is
// expected to stay useful. It does NOT control the real lifetime — Cloudflare owns
// that. Two different hosting modes, two different realities:
//
//   temporary preview (`wrangler deploy --temporary`, unauthenticated)
//     → Cloudflare hard-expires the deployment ~60 min after deploy unless claimed.
//       Nothing on our side can extend it. A countdown longer than 60 min on a
//       temporary deploy is a LIE to the viewer, so callers must clamp (see below).
//
//   claimed / authenticated deploy (normal `wrangler deploy`)
//     → the deployment is permanent. A countdown is meaningless; callers should
//       skip injection entirely rather than invent an expiry.
//
// So TTL here answers "what should the page tell the reader", and the caller is
// responsible for keeping that honest against the hosting mode it actually used.
//
// WHY THE DEFAULT IS 60 AND NOT LONGER: a longer default is dead configuration.
// Temporary previews clamp it to 60 anyway, and permanent deploys get no
// countdown at all — so a 180m default would never once reach a reader's screen.
// Defaults should describe reality, not aspiration. Want a link that outlives the
// hour? Set CLOUDFLARE_API_TOKEN and deploy permanently; that's the real fix.

/** Default countdown window, in seconds — matches the temporary-preview lifetime. */
export const DEFAULT_TTL_SECONDS = 60 * 60;

/** Hard ceiling Cloudflare enforces on unclaimed temporary previews, in seconds. */
export const TEMPORARY_HARD_TTL_SECONDS = 60 * 60;

const MIN_TTL_SECONDS = 60; // below a minute the countdown is noise
const MAX_TTL_SECONDS = 30 * 24 * 3600; // sanity ceiling: 30 days

/**
 * Parse a human TTL into seconds. Accepts `180m`, `3h`, `90`, `2d`, `5400s`.
 * Bare numbers are read as MINUTES (the unit people say out loud for this).
 *
 * @param {string|number|null|undefined} spec
 * @returns {number|null} seconds, or null when the input is absent/unparseable
 */
export function parseTtl(spec) {
  if (spec === null || spec === undefined || spec === '') return null;
  if (typeof spec === 'number') {
    return Number.isFinite(spec) && spec > 0 ? clamp(Math.round(spec * 60)) : null;
  }
  const m = String(spec).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 'm'];
  return clamp(Math.round(n * mult));
}

function clamp(sec) {
  return Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, sec));
}

/**
 * Resolve the TTL to use, in precedence order:
 *   explicit arg  >  $CLOUDFLARE_DROP_TTL  >  DEFAULT_TTL_SECONDS
 *
 * @param {{ttl?:string|number|null, env?:Record<string,string|undefined>}} [opts]
 * @returns {number} seconds
 */
export function resolveTtlSeconds(opts = {}) {
  const fromArg = parseTtl(opts.ttl);
  if (fromArg) return fromArg;
  const fromEnv = parseTtl((opts.env || process.env)?.CLOUDFLARE_DROP_TTL);
  if (fromEnv) return fromEnv;
  return DEFAULT_TTL_SECONDS;
}

/**
 * Keep the displayed countdown honest about the hosting mode actually used.
 *
 * On a temporary preview the link really does die at 60 min, so a longer TTL is
 * clamped down and reported back — the caller must surface that it was clamped
 * rather than silently showing a number it knows to be wrong.
 *
 * @param {number} ttlSeconds       what the caller asked to display
 * @param {'temporary'|'permanent'} mode
 * @returns {{seconds:number, clamped:boolean, reason:string|null}}
 */
export function honestTtl(ttlSeconds, mode) {
  const want = Number.isFinite(ttlSeconds) ? Math.floor(ttlSeconds) : DEFAULT_TTL_SECONDS;
  if (mode === 'temporary' && want > TEMPORARY_HARD_TTL_SECONDS) {
    return {
      seconds: TEMPORARY_HARD_TTL_SECONDS,
      clamped: true,
      reason:
        `temporary previews hard-expire at ${TEMPORARY_HARD_TTL_SECONDS / 60} min; ` +
        `showing that instead of the requested ${Math.round(want / 60)} min`,
    };
  }
  return { seconds: want, clamped: false, reason: null };
}

/** Human-readable window, e.g. `180 minutes` / `3 hours`. */
export function formatTtl(sec) {
  const s = Math.floor(sec);
  const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (s % 86400 === 0 && s >= 86400) return unit(s / 86400, 'day');
  if (s % 3600 === 0 && s >= 3600) return unit(s / 3600, 'hour');
  if (s % 60 === 0) return unit(s / 60, 'minute');
  return unit(s, 'second');
}
