// wrangler.mjs — deploy a static site via the Wrangler CLI (round-015).
//
// WHY THIS IS NOW THE DEFAULT BACKEND:
// cloudflare.com/drop's own "For AI agents" section instructs agents to prefer
// Wrangler over hand-driving the dropzone. Their published line is
// `npm exec --yes wrangler@latest -- deploy ./dist --name <n> --temporary
// --compatibility-date <YYYY-MM-DD>`; this file runs the same command with the
// version pinned instead of floating — see narrowing 1 below.
// The old playwright dropzone path was REMOVED in 2.0.0: the dropzone DOM changed
// and that flow silently returned no URL. The CLI is now the only path.
//
// TWO HOSTING MODES, and the choice is NOT ours to make freely:
//   authenticated (CLOUDFLARE_API_TOKEN / OAuth)  → normal deploy, PERMANENT url
//   unauthenticated                               → --temporary, 60-min preview + claim url
// Wrangler REFUSES `--temporary` when it detects existing auth, and refuses a
// normal deploy in a non-interactive shell without a token. So we detect first
// and pick the mode that will actually work, rather than guessing and retrying.
//
// TWO NARROWINGS ADDED IN 2.4.0, both stated here rather than left implicit:
//
//   1. The wrangler version is PINNED (WRANGLER_VERSION below), not `@latest`.
//      `@latest` meant every deploy fetched and executed whatever npm resolved
//      that minute — an unreviewed third party running with this process's
//      credentials. Bumping the pin is a normal, reviewable change; see the
//      CHANGELOG for how the current pin was verified.
//   2. The child process gets an ALLOWLISTED environment, not `process.env`.
//      A deploy needs Cloudflare credentials and enough of the OS to run; it
//      has no business seeing every other API key in the session. What is
//      deliberately NOT forwarded, and why:
//        - CLOUDFLARE_API_BASE_URL / CF_API_BASE_URL / CLOUDFLARE_BASE_URL —
//          they redirect the Cloudflare token to a host of someone else's
//          choosing. That is the exfiltration shape this narrowing exists for.
//        - CLOUDFLARE_INCLUDE_PROCESS_ENV — it asks wrangler to copy the
//          process environment into the deployed Worker, i.e. to publish it.
//        - everything else in the environment (other vendors' keys included).
//      Fail-open escape hatch: CLOUDFLARE_DROP_ENV_PASSTHROUGH="NAME1,NAME2"
//      adds names back, and the names it added are printed. A narrowing with
//      no route around it blocks work that used to succeed, which this repo
//      treats as worse than the thing it prevents.

import { execFileSync } from 'node:child_process';
import { existsSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * The exact wrangler the deploy runs. NOT `@latest` — see narrowing 1 above.
 * Verified on a real machine before it was written down:
 *   $ npm exec --yes wrangler@4.134.0 -- --version
 *   4.134.0
 */
export const WRANGLER_VERSION = '4.134.0';

/**
 * Every environment variable the deploy child process is allowed to see.
 * Each group is here for a reason that was checked, not guessed:
 */
export const WRANGLER_ENV_ALLOWLIST = [
  // Run the process at all. Without PATH, `npm` is not findable; without HOME,
  // npm has no cache and wrangler has no config directory.
  'PATH', 'HOME', 'TMPDIR',
  // The same three on Windows, plus SystemRoot, which node's crypto needs.
  'SystemRoot', 'SYSTEMROOT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PATHEXT', 'COMSPEC', 'TEMP', 'TMP',
  // Reach the network. Measured: `npm exec --yes wrangler@4.134.0 -- --version`
  // on the machine this pin was verified on printed "Proxy environment
  // variables detected. We'll use your proxy for fetch requests." Drop these
  // and a deploy behind a proxy stops working. NODE_EXTRA_CA_CERTS is the same
  // class — a proxy that terminates TLS needs it.
  'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY',
  'http_proxy', 'https_proxy', 'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  // Cloudflare credentials. The first pair is what detectAuthMode() reads; the
  // rest are the other auth inputs wrangler 4.134.0 reads (global-key auth).
  'CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID',
  'CLOUDFLARE_API_KEY', 'CF_API_KEY',
  'CLOUDFLARE_EMAIL', 'CF_EMAIL',
  // Where wrangler's config and cache live. oauthConfigPath() below keys off
  // the first two, so wrangler has to resolve the same paths this file does or
  // the OAuth pause and wrangler would disagree about which file matters.
  'WRANGLER_HOME', 'XDG_CONFIG_HOME', 'XDG_CACHE_HOME',
  // Keep wrangler's own non-interactive detection working under CI.
  'CI',
];

/**
 * Build the child process environment: the allowlist, plus anything the
 * operator opted back in through CLOUDFLARE_DROP_ENV_PASSTHROUGH.
 *
 * @param {Record<string,string|undefined>} [env] the environment to narrow
 * @returns {{env:Record<string,string>, withheld:string[], passedThrough:string[]}}
 */
export function wranglerEnv(env = process.env) {
  const source = env || {};
  const extra = String(source.CLOUDFLARE_DROP_ENV_PASSTHROUGH || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set([...WRANGLER_ENV_ALLOWLIST, ...extra]);

  const out = {};
  const withheld = [];
  const passedThrough = [];
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) {
      withheld.push(key);
      continue;
    }
    out[key] = value;
    if (!WRANGLER_ENV_ALLOWLIST.includes(key)) passedThrough.push(key);
  }
  return { env: out, withheld: withheld.sort(), passedThrough: passedThrough.sort() };
}

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
 * @param {(line:string)=>void} [opts.note]  where the environment NOTE goes
 * @returns {{url:string|null, claim:string|null, mode:string, raw:string,
 *            envWithheld:number, envPassedThrough:string[]}}
 */
export function deployWithWrangler(siteDir, opts = {}) {
  const {
    name,
    compatibilityDate,
    allowPauseOAuth = false,
    run = defaultRun,
    env = process.env,
    note = (line) => console.error(line),
  } = opts;
  if (!name) throw new Error('wrangler deploy: --name is required');
  if (!compatibilityDate) throw new Error('wrangler deploy: --compatibility-date is required');

  const detected = opts.mode ? { mode: opts.mode } : detectAuthMode({ env });
  const mode = detected.mode;

  const args = ['exec', '--yes', `wrangler@${WRANGLER_VERSION}`, '--', 'deploy', ...(opts.configPath ? ['--config', opts.configPath] : [siteDir]),
    '--name', name, '--compatibility-date', compatibilityDate];
  if (mode === 'temporary') args.push('--temporary');

  // Narrow the child environment, and say so — a silent narrowing reads, to
  // whoever debugs the next failed deploy, as "wrangler just broke".
  const childEnv = wranglerEnv(env);
  if (childEnv.withheld.length > 0) {
    note(
      `NOTE wrangler runs with ${Object.keys(childEnv.env).length} allowlisted environment ` +
      `variables; ${childEnv.withheld.length} were withheld. Add names back with ` +
      'CLOUDFLARE_DROP_ENV_PASSTHROUGH="NAME1,NAME2" if a deploy needs one.',
    );
  }
  if (childEnv.passedThrough.length > 0) {
    note(`NOTE CLOUDFLARE_DROP_ENV_PASSTHROUGH forwarded: ${childEnv.passedThrough.join(', ')}`);
  }

  // The OAuth pause is the only way to reach an anonymous temporary preview on a
  // machine that has a login it cannot use. It touches the USER'S credential file,
  // so it is guarded, opt-in, and restored in `finally` — a crash must never leave
  // the user logged out.
  const cfg = oauthConfigPath(env);
  const paused = mode === 'temporary' && allowPauseOAuth && existsSync(cfg);
  const parked = `${cfg}.paused-by-cloudflare-drop`;
  if (paused && existsSync(parked)) throw new Error('OAuth backup already exists; refusing to overwrite it.');
  if (paused) renameSync(cfg, parked);
  let raw = '';
  try {
    raw = run(args, { env: childEnv.env });
  } finally {
    if (paused && existsSync(parked)) renameSync(parked, cfg);
  }

  return {
    url: parseDeployedUrl(raw),
    claim: parseClaimUrl(raw),
    mode,
    raw,
    envWithheld: childEnv.withheld.length,
    envPassedThrough: childEnv.passedThrough,
  };
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
