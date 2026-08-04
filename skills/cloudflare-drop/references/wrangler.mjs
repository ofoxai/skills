// wrangler.mjs — deploy a static site via the Wrangler CLI (round-015).
//
// WHY THIS IS NOW THE DEFAULT BACKEND:
// cloudflare.com/drop's own "For AI agents" section instructs agents to prefer
// Wrangler over hand-driving the dropzone:
//     npm exec --yes wrangler@latest -- deploy ./dist --name <n> --temporary \
//       --compatibility-date <YYYY-MM-DD>
// The old playwright dropzone path was REMOVED in 2.0.0: the dropzone DOM changed
// and that flow silently returned no URL. The CLI is now the only path.
//
// TWO HOSTING MODES, and the choice is NOT ours to make freely:
//   authenticated (CLOUDFLARE_API_TOKEN / OAuth)  → normal deploy, PERMANENT url
//   unauthenticated                               → --temporary, 60-min preview + claim url
// Wrangler REFUSES `--temporary` when it detects existing auth, and refuses a
// normal deploy in a non-interactive shell without a token. So we detect first
// and pick the mode that will actually work, rather than guessing and retrying.

import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Where wrangler keeps its OAuth login state on each platform. */
export function oauthConfigPath(env = process.env, platform = process.platform) {
  if (env.WRANGLER_HOME) return join(env.WRANGLER_HOME, 'config', 'default.toml');
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml');
  }
  return join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), '.wrangler', 'config', 'default.toml');
}

/**
 * Decide which hosting mode Wrangler can actually use here.
 *
 * @param {{env?:Record<string,string|undefined>, configPath?:string}} [opts]
 * @returns {{mode:'permanent'|'temporary', reason:string, hasToken:boolean, hasOAuth:boolean}}
 */
export function detectAuthMode(opts = {}) {
  const env = opts.env || process.env;
  const hasToken = Boolean(env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN);
  const cfg = opts.configPath || oauthConfigPath(env);
  const hasOAuth = existsSync(cfg);
  if (hasToken) {
    return { mode: 'permanent', reason: 'CLOUDFLARE_API_TOKEN present', hasToken, hasOAuth };
  }
  if (hasOAuth) {
    // The trap: wrangler sees OAuth state and rejects --temporary, but a
    // non-interactive shell can't complete the OAuth flow either. Callers must
    // pass `allowPauseOAuth` to get past it (see deployWithWrangler).
    return {
      mode: 'temporary',
      reason: 'OAuth login state present but unusable non-interactively; needs pause to use --temporary',
      hasToken,
      hasOAuth,
    };
  }
  return { mode: 'temporary', reason: 'no Cloudflare credentials found', hasToken, hasOAuth };
}

/**
 * Run wrangler deploy for a staged directory.
 *
 * @param {string} siteDir            directory containing index.html
 * @param {object} opts
 * @param {string} opts.name          worker name (required by wrangler)
 * @param {string} opts.compatibilityDate  YYYY-MM-DD (caller injects; no clock here)
 * @param {'permanent'|'temporary'} [opts.mode]
 * @param {boolean} [opts.allowPauseOAuth]  temporarily move OAuth config aside so
 *        `--temporary` works, then ALWAYS restore it (see the finally block).
 * @param {(args:string[], o:object)=>string} [opts.run]  injectable for tests
 * @returns {{url:string|null, claim:string|null, mode:string, raw:string}}
 */
export function deployWithWrangler(siteDir, opts = {}) {
  const {
    name,
    compatibilityDate,
    allowPauseOAuth = false,
    run = defaultRun,
    env = process.env,
  } = opts;
  if (!name) throw new Error('wrangler deploy: --name is required');
  if (!compatibilityDate) throw new Error('wrangler deploy: --compatibility-date is required');

  const detected = opts.mode ? { mode: opts.mode } : detectAuthMode({ env });
  const mode = detected.mode;

  const args = ['exec', '--yes', 'wrangler@latest', '--', 'deploy', siteDir,
    '--name', name, '--compatibility-date', compatibilityDate];
  if (mode === 'temporary') args.push('--temporary');

  // The OAuth pause is the only way to reach an anonymous temporary preview on a
  // machine that has a login it cannot use. It touches the USER'S credential file,
  // so it is guarded, opt-in, and restored in `finally` — a crash must never leave
  // the user logged out.
  const cfg = oauthConfigPath(env);
  const paused = mode === 'temporary' && allowPauseOAuth && existsSync(cfg);
  const parked = `${cfg}.paused-by-cloudflare-drop`;
  if (paused) renameSync(cfg, parked);
  let raw = '';
  try {
    raw = run(args, { env });
  } finally {
    if (paused && existsSync(parked)) renameSync(parked, cfg);
  }

  return { url: parseDeployedUrl(raw), claim: parseClaimUrl(raw), mode, raw };
}

function defaultRun(args, { env }) {
  return execFileSync('npm', args, {
    encoding: 'utf8',
    env,
    timeout: 300_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Read the deployed URL from wrangler output — never invent one. */
export function parseDeployedUrl(out) {
  const s = String(out || '');
  const m = s.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?/i);
  return m ? m[0].replace(/\/$/, '') : null;
}

/** Read the claim URL (temporary previews only). */
export function parseClaimUrl(out) {
  const m = String(out || '').match(/https:\/\/dash\.cloudflare\.com\/claim-preview\?claimToken=[\w-]+/i);
  return m ? m[0] : null;
}
