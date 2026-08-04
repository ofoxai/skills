// deploy.mjs — one-command cloudflare-drop delivery (round-015).
//
// Turns an HTML deliverable into a live, shareable URL. Orchestrates:
//   1. ttl              → resolve the countdown window (default 60m, --ttl to shorten)
//   2. inject-countdown → stamp the expiry into the page (temporary deploys only)
//   3. stage            → index.html at the ROOT, junk excluded
//   4. wrangler         → `wrangler deploy` (CLI, per Cloudflare's own agent guidance)
//   5. self-verify      → HTTP 200 backoff + content check (size + sentinel)
//                         before reporting (never report an unverified URL)
//
// Usage:
//   node references/deploy.mjs <page.html> [--ttl 30m] [--name my-report] [--permanent]
//   node references/deploy.mjs renew <url|id> [--ttl 30m]
//
// Prints RESULT_URL / MODE / CLAIM_LINK / EXPIRY_EPOCH on success; fails open
// otherwise (the caller then delivers the file — it must NOT reflexively ask for
// a token; that discipline lives in hal-html, not here).

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { injectCountdown } from './inject-countdown.mjs';
import { recordDeploy, renew as renewDeploy, idFromUrl } from './drop-index.mjs';
import { resolveTtlSeconds, honestTtl, formatTtl, TEMPORARY_HARD_TTL_SECONDS } from './ttl.mjs';
import { deployWithWrangler, detectAuthMode } from './wrangler.mjs';

// Self-verify backoff schedule (round-014 spec 05, folding in #89). Edge
// propagation means a fresh URL can 404 for a few seconds after the deploy
// reports done. We poll with escalating gaps (~5 tries, ~60s total budget) and
// only report URL_UNVERIFIED once every probe has failed. The first probe fires
// immediately (no delay before it); these are the waits BETWEEN probes.
export const BACKOFF_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

/**
 * Stage an HTML deliverable: inject the countdown and write it as index.html at
 * a clean staged root (only `/` serves reliably).
 * If the source page references sibling assets, its whole directory is copied.
 *
 * @param {string} htmlPath      the HTML file to publish
 * @param {number|null} expiryEpoch  unix seconds for the countdown; falsy = no countdown
 *        (permanent deploys get none — there is nothing to count down to)
 * @param {string} [baseDir]     where to create the staged dir (default: a temp dir)
 * @returns {{stagedDir:string, indexPath:string}}
 */
export function stageForDrop(htmlPath, expiryEpoch, baseDir) {
  const root = baseDir || mkdtempSync(join(tmpdir(), 'drop-'));
  const stagedDir = join(root, 'site');
  mkdirSync(stagedDir, { recursive: true });

  // Copy sibling assets (css/js/img) so a multi-file page renders — but only when
  // the source dir is a SEPARATE directory (not our staged root's parent), and
  // never the staged dir itself, so we can't recurse into our own output.
  const srcDir = dirname(htmlPath);
  if (
    existsSync(srcDir) &&
    statSync(srcDir).isDirectory() &&
    srcDir !== stagedDir &&
    srcDir !== root
  ) {
    cpSync(srcDir, stagedDir, {
      recursive: true,
      filter: (s) =>
        !s.includes('node_modules') &&
        !s.includes('.git') &&
        !s.includes('__MACOSX') &&
        !basename(s).startsWith('.') &&
        s !== stagedDir, // guard against copying the staged dir into itself
    });
  }

  const html = readFileSync(htmlPath, 'utf8');
  const staged = expiryEpoch ? injectCountdown(html, expiryEpoch) : html;
  const indexPath = join(stagedDir, 'index.html');
  writeFileSync(indexPath, staged);
  return { stagedDir, indexPath };
}

/**
 * Poll a URL for an HTTP 200 with escalating backoff, riding out edge
 * propagation before declaring it unverified (round-014 spec 05 / #89).
 *
 * The first probe fires immediately; subsequent probes wait BACKOFF_DELAYS_MS
 * between attempts. A probe that throws counts as a failed attempt (not a crash).
 *
 * @param {string} url
 * @param {object} [opts]
 * @param {(url:string)=>Promise<number>} [opts.probe]  returns the HTTP status code
 * @param {(ms:number)=>Promise<void>} [opts.sleepFn]   waits ms (injectable for tests)
 * @param {number} [opts.tries]  number of probes (default: BACKOFF_DELAYS_MS.length + 1)
 * @returns {Promise<boolean>} true once a probe returns 200; false if all fail
 */
export async function verifyWithBackoff(url, { probe = curlProbe, sleepFn = sleep, tries } = {}) {
  const attempts = Number.isFinite(tries) ? tries : BACKOFF_DELAYS_MS.length + 1;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      // Wait the escalating gap before this retry; clamp to the last delay if we
      // somehow run more attempts than the schedule has entries.
      const delay = BACKOFF_DELAYS_MS[Math.min(i - 1, BACKOFF_DELAYS_MS.length - 1)];
      await sleepFn(delay);
    }
    let code = 0;
    try {
      code = await probe(url);
    } catch {
      code = 0; // transient probe error — treat as a failed attempt, keep going
    }
    if (code === 200) return true;
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Default probe: a single curl returning the HTTP status code.
async function curlProbe(url) {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    'curl',
    ['-s', '-L', '-o', '/dev/null', '-w', '%{http_code}', url],
    { encoding: 'utf8', timeout: 20000 },
  );
  return parseInt(out.trim(), 10) || 0;
}

// Default fetch: curl the whole page body (what the viewer actually gets).
async function curlFetch(url) {
  const { execFileSync } = await import('node:child_process');
  return execFileSync('curl', ['-s', '-L', url], {
    encoding: 'utf8',
    timeout: 20000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

// The served page must be at least this fraction of the source's byte size to
// count as "full content served" (round-016 spec 02 / A6). The deployed page is
// always a bit LARGER than the source (the countdown block is injected), so the
// only way to fall below this is a truncated/blank husk — which is exactly the
// A3/A6 failure (a 33.7KB source served as a 1.8KB head-only page).
const CONTENT_SIZE_MIN_RATIO = 0.9;

/**
 * Verify the LIVE page is the real content, not a blank/truncated husk that
 * still returns HTTP 200 (round-016 spec 02, A6). Downloads the page and checks:
 *   - its byte size is >= CONTENT_SIZE_MIN_RATIO of the source (the deployed page
 *     is larger than the source because the countdown is injected, so a husk is
 *     the only way to fall short), AND
 *   - a body sentinel string from the source is present in the served page.
 * Either check failing → false (the caller reports URL_UNVERIFIED, non-zero).
 *
 * @param {string} url
 * @param {object} opts
 * @param {string} opts.sourceHtml   the html we deployed (the exact bytes we sent)
 * @param {string} [opts.sentinel]   a body string that MUST be present (default: derived)
 * @param {(url:string)=>Promise<string>} [opts.fetchFn]  downloads the page body
 * @returns {Promise<boolean>}
 */
export async function verifyContent(url, { sourceHtml, sentinel, fetchFn = curlFetch } = {}) {
  const src = typeof sourceHtml === 'string' ? sourceHtml : '';
  const mark = sentinel || bodySentinel(src);
  let served = '';
  try {
    served = await fetchFn(url);
  } catch {
    return false; // couldn't read it back → treat as unverified
  }
  if (typeof served !== 'string' || served.length === 0) return false;

  // Size gate: the served page must be at least ~90% of the source's bytes.
  const bytes = Buffer.byteLength(served, 'utf8');
  const srcBytes = Buffer.byteLength(src, 'utf8');
  if (srcBytes > 0 && bytes < srcBytes * CONTENT_SIZE_MIN_RATIO) return false;

  // Sentinel gate: a distinctive body string must be present.
  if (mark && !served.includes(mark)) return false;

  return true;
}

// Derive a body sentinel from the source: a stable slice of the page's body
// text, away from the head/countdown, so "is the real body there" is checkable
// without the caller having to supply one. Best-effort — returns '' if the page
// has no usable body slice (then verifyContent falls back to the size gate only).
function bodySentinel(html) {
  const src = typeof html === 'string' ? html : '';
  const lower = src.toLowerCase();
  const bodyStart = lower.indexOf('<body');
  const from = bodyStart === -1 ? 0 : lower.indexOf('>', bodyStart) + 1;
  // Strip the injected countdown block so the sentinel is page content, not ours.
  let body = src.slice(from);
  const fence = body.indexOf('<!--drop-expiry-countdown:start-->');
  if (fence !== -1) body = body.slice(0, fence);
  const trimmed = body.trim();
  if (trimmed.length < 24) return '';
  // A middle slice — robust to head/tail edits, unlikely to be a generic tag.
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.slice(Math.max(0, mid - 24), mid + 24);
}

/** Today's date as YYYY-MM-DD (wrangler requires --compatibility-date). */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Derive a wrangler-safe worker name from a filename (or an explicit override). */
export function workerNameFrom(htmlPath, explicit) {
  if (explicit) return sanitizeName(explicit);
  const base = basename(String(htmlPath || '')).replace(/\.html?$/i, '');
  return sanitizeName(base || 'drop-site');
}

function sanitizeName(s) {
  const n = String(s)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 54);
  return n || 'drop-site';
}

/** Minimal flag parser for the CLI (`--ttl 30m`, `--name x`, `--permanent`). */
export function parseArgs(argv) {
  const out = { _: [], ttl: null, name: null, permanent: false, pauseOAuth: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ttl') out.ttl = argv[++i];
    else if (a === '--name') out.name = argv[++i];
    else if (a === '--permanent') out.permanent = true;
    else if (a === '--no-pause-oauth') out.pauseOAuth = false;
    else out._.push(a);
  }
  return out;
}

/**
 * The full pipeline: resolve TTL → stage → wrangler deploy → verify.
 *
 * The verification is the single exit shared with `renew` (round-016 spec 02,
 * A6): verifyWithBackoff rides out edge propagation to a real HTTP 200, THEN
 * verifyContent confirms the served page is the full content (size + sentinel),
 * not a blank/truncated husk that happens to 200.
 *
 * @param {string} htmlPath
 * @param {{ttl?:string|number, name?:string, permanent?:boolean, pauseOAuth?:boolean,
 *          probe?:Function, fetchFn?:Function, sleepFn?:Function}} [opts]
 * @returns {Promise<{url:string|null, claim:string|null, expiryEpoch:number|null,
 *                    mode:string, verified:boolean, ttlNote:string|null, indexPath?:string}>}
 */
export async function deployPage(htmlPath, opts = {}) {
  const mode = opts.permanent ? 'permanent' : detectAuthMode().mode;

  // A permanent deploy has no expiry, so it gets no countdown at all — a countdown
  // on a link that never dies is the same dishonesty as showing 3h on a link
  // that dies at 60.
  let expiryEpoch = null;
  let ttlNote = null;
  if (mode === 'temporary') {
    const honest = honestTtl(resolveTtlSeconds({ ttl: opts.ttl }), 'temporary');
    ttlNote = honest.clamped ? honest.reason : null;
    expiryEpoch = Math.floor(Date.now() / 1000) + honest.seconds;
  }

  const { stagedDir, indexPath } = stageForDrop(htmlPath, expiryEpoch);
  const res = deployWithWrangler(stagedDir, {
    name: workerNameFrom(htmlPath, opts.name),
    compatibilityDate: todayISO(),
    mode,
    allowPauseOAuth: opts.pauseOAuth !== false,
  });
  if (!res.url) {
    return { url: null, claim: null, expiryEpoch, mode, verified: false, ttlNote, raw: res.raw };
  }

  // Single verification exit: edge-propagation 200 poll, THEN content check —
  // a 200 that serves a blank/truncated husk is still a failure (A6).
  const stagedHtml = readFileSync(indexPath, 'utf8');
  const live = await verifyWithBackoff(res.url, { probe: opts.probe, sleepFn: opts.sleepFn });
  const verified =
    live && (await verifyContent(res.url, { sourceHtml: stagedHtml, fetchFn: opts.fetchFn }));
  return { url: res.url, claim: res.claim, expiryEpoch, mode, verified, ttlNote, indexPath };
}

/**
 * Deploy an HTML string and return the live url ONLY after it self-verifies —
 * the single post-deploy verification exit (round-016 spec 02, A6). `renew`
 * hands its rebuilt page here, so it inherits the exact same 200-backoff +
 * content check as a fresh deploy — a caller never hand-`sleep`+curls.
 *
 * @param {string} html   the page HTML (countdown already injected by the renew
 *                        path; injectCountdown is idempotent so it is never
 *                        double-stamped) — also the bytes for the content check.
 * @param {object} [opts] injectable seams for tests (all default to the real path)
 * @param {(html:string)=>Promise<{url:string,claim:string|null}>} [opts.uploadFn]
 * @param {(url:string)=>Promise<number>} [opts.probe]      HTTP status probe
 * @param {(url:string)=>Promise<string>} [opts.fetchFn]    page-body fetch
 * @param {(ms:number)=>Promise<void>} [opts.sleepFn]       backoff sleep
 * @returns {Promise<{url:string, claim:string|null, expiryEpoch:number|null}>}
 */
export async function deployHtmlString(html, opts = {}) {
  const { probe, fetchFn, sleepFn } = opts;

  // Injected upload seam (tests / alternate backends): upload the raw html,
  // then run the exact same verification exit as the real path below.
  if (opts.uploadFn) {
    const { url, claim } = await opts.uploadFn(html);
    if (!url) throw new Error('deployHtmlString: no url returned');
    const live = await verifyWithBackoff(url, { probe, sleepFn });
    const contentOk = live && (await verifyContent(url, { sourceHtml: html, fetchFn }));
    if (!contentOk) {
      // A 200 husk is still a failure — never report a link that serves a blank
      // or truncated page (round-016 A6).
      const e = new Error('URL_UNVERIFIED');
      e.url = url;
      throw e;
    }
    const honest = honestTtl(resolveTtlSeconds({ ttl: opts.ttl }), 'temporary');
    return { url, claim: claim || null, expiryEpoch: Math.floor(Date.now() / 1000) + honest.seconds };
  }

  // Real path: write the html out and run the full wrangler pipeline, which
  // ends in the same verification exit inside deployPage.
  const root = mkdtempSync(join(tmpdir(), 'drop-'));
  const htmlPath = join(root, `${opts.name || 'page'}.html`);
  writeFileSync(htmlPath, html);
  const res = await deployPage(htmlPath, opts);
  if (!res.url) throw new Error('renew: redeploy produced no url');
  if (!res.verified) {
    const e = new Error('URL_UNVERIFIED');
    e.url = res.url;
    throw e;
  }
  return res;
}

// CLI entry — two modes:
//   node deploy.mjs <page.html> [--ttl 30m] [--name n] [--permanent]
//   node deploy.mjs renew <url|id> [--ttl 30m]
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const [arg1, arg2] = args._;

  if (arg1 === 'renew') {
    if (!arg2) {
      console.error('usage: node deploy.mjs renew <url|id> [--ttl 30m]');
      process.exit(2);
    }
    try {
      // Reuse the original worker name so a renewed link stays recognizable
      // (and keeps the same index key), unless the caller overrides it.
      const renewName = args.name || idFromUrl(arg2);
      const res = await renewDeploy(arg2, {
        ttl: args.ttl,
        deployFn: (html) => deployHtmlString(html, { ttl: args.ttl, name: renewName }),
      });
      // Expectation honesty: renew produces a NEW url (an expired preview can't be
      // revived). Surface it plainly along with the renew chain + claim link.
      console.log('RESULT_URL', res.url);
      console.log('EXPIRY_EPOCH', res.expiryEpoch);
      console.log('RENEWED_FROM', res.renewedFrom);
      console.log('RENEW_COUNT', res.renewCount);
      // Claim etiquette (round-016 spec 03, U1b): offer the permanent link ONLY
      // when the same content has been renewed 3 times — a viewer who keeps
      // coming back for it. Before that, it's just a new link + expiry reminder,
      // like a normal person, no upsell.
      if (res.renewCount >= 3) {
        console.log('CLAIM_LINK', res.claim || '(none found)');
        console.log('NOTE renewed 3× — offer the claim link so it can be kept permanently instead of renewing again');
      } else {
        console.log('CLAIM_OFFER none');
        console.log('NOTE new url (the original could not be revived), ~60-min preview — just deliver the link + expiry');
      }
    } catch (e) {
      // Loud failure: an unarchived id, a failed redeploy, or an unverified url.
      if (e && e.url) console.log('URL_UNVERIFIED', e.url);
      else console.log('RENEW_FAILED', (e && e.message) || String(e));
      process.exitCode = 1;
    }
  } else {
    const htmlPath = arg1;
    if (!htmlPath || !existsSync(htmlPath)) {
      console.error('usage: node deploy.mjs <page.html> [--ttl 30m] [--name n] [--permanent]');
      console.error('       node deploy.mjs renew <url|id> [--ttl 30m]');
      process.exit(2);
    }
    let res;
    try {
      res = await deployPage(htmlPath, args);
    } catch (e) {
      console.log('DEPLOY_FAILED', (e && e.message) || String(e));
      process.exit(1);
    }
    if (!res.url) {
      console.log('NO_URL_FOUND'); // caller fails open (deliver the file; no token reflex)
      process.exitCode = 1;
    } else if (!res.verified) {
      console.log('URL_UNVERIFIED', res.url); // 200 husk or edge never propagated
      process.exitCode = 1;
    } else {
      if (res.ttlNote) console.log('TTL_CLAMPED', res.ttlNote);
      // Archive so `renew` can rebuild after expiry (temporary deploys only — a
      // permanent url never needs renewing).
      if (res.mode === 'temporary') {
        try {
          recordDeploy({
            url: res.url,
            html: readFileSync(res.indexPath, 'utf8'),
            expiryEpoch: res.expiryEpoch,
            claimUrl: res.claim || '',
            title: basename(htmlPath),
          });
        } catch (e) {
          // Archiving is durability, not the deliverable — never let a failed
          // index write block reporting a live, verified URL.
          console.error('INDEX_WRITE_SKIPPED', (e && e.message) || String(e));
        }
      }
      console.log('RESULT_URL', res.url);
      console.log('MODE', res.mode);
      if (res.mode === 'permanent') {
        console.log('EXPIRY none — deployed to your Cloudflare account; this link is permanent');
      } else {
        console.log('CLAIM_LINK', res.claim || '(none found)');
        console.log('EXPIRY_EPOCH', res.expiryEpoch);
        console.log(
          `NOTE unclaimed previews really expire after ${formatTtl(TEMPORARY_HARD_TTL_SECONDS)} — ` +
            'claim within that window to keep the link',
        );
      }
    }
  }
}
