// deploy.mjs — one-command cloudflare-drop delivery (round-013 spec 01).
//
// Turns an HTML deliverable into a live, shareable Drop URL with a 60-minute
// expiry countdown baked into the page. Orchestrates the three units:
//   1. inject-countdown  → stamp the real expiry into the page
//   2. stage + zip       → index.html at the ROOT (gotcha 3), junk excluded
//   3. upload.mjs        → playwright setInputFiles → *.workers.dev URL
//   4. curl self-verify  → HTTP 200 before reporting (never report an unverified URL)
//
// Usage (self-contained; playwright installed on demand):
//   node references/deploy.mjs <page.html>
// Prints RESULT_URL / CLAIM_LINK / EXPIRY_EPOCH on success; fails open otherwise
// (the caller then delivers the file — it must NOT reflexively ask for a token;
//  that discipline lives in hal-html, not here).

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { injectCountdown } from './inject-countdown.mjs';
import { recordDeploy, renew as renewDeploy } from './drop-index.mjs';

const EXPIRY_WINDOW_SECONDS = 3600; // Drop links live ~60 min from deploy.

// Self-verify backoff schedule (round-014 spec 05, folding in #89). Drop's edge
// propagation means the fresh URL can 404 for a few seconds after the deploy
// reports done — both round-013 rehearsals hit this and pushed the retry onto
// the caller. We poll with escalating gaps (~5 tries, ~60s total budget) and
// only report URL_UNVERIFIED once every probe has failed. The first probe fires
// immediately (no delay before it); these are the waits BETWEEN probes.
export const BACKOFF_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000];

/**
 * Stage an HTML deliverable for Drop: inject the countdown and write it as
 * index.html at a clean staged root (gotcha 3 — only `/` serves).
 * If the source page references sibling assets, its whole directory is copied.
 * @param {string} htmlPath   the HTML file to publish
 * @param {number} expiryEpoch  unix seconds when the link expires
 * @param {string} [baseDir]   where to create the staged dir (default: a temp dir)
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
  const stagedRealParent = root;
  if (
    existsSync(srcDir) &&
    statSync(srcDir).isDirectory() &&
    srcDir !== stagedDir &&
    srcDir !== stagedRealParent
  ) {
    cpSync(srcDir, stagedDir, {
      recursive: true,
      filter: (s) =>
        !s.includes('__MACOSX') &&
        !basename(s).startsWith('.') &&
        s !== stagedDir, // guard against copying the staged dir into itself
    });
  }

  const html = readFileSync(htmlPath, 'utf8');
  const withCountdown = injectCountdown(html, expiryEpoch);
  const indexPath = join(stagedDir, 'index.html');
  writeFileSync(indexPath, withCountdown);
  return { stagedDir, indexPath };
}

// Compute the expiry epoch for a deploy happening now.
export function expiryFor(deployEpochSeconds) {
  return Math.floor(deployEpochSeconds) + EXPIRY_WINDOW_SECONDS;
}

/**
 * Poll a URL for an HTTP 200 with escalating backoff, riding out Drop's edge
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

// Default probe: a single curl HEAD/GET returning the HTTP status code.
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

// The renewed page must be at least this fraction of the source's byte size to
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

/**
 * Deploy an already-staged HTML string to Drop and return the live url ONLY
 * after it self-verifies — the single post-deploy verification exit (round-016
 * spec 02, A6). Both the CLI fresh-deploy path AND `renew` funnel through here,
 * so neither a caller nor Main ever hand-`sleep`+curls: the URL comes back only
 * after (1) verifyWithBackoff rides out edge propagation to a real HTTP 200 AND
 * (2) verifyContent confirms the served page is the full content (size +
 * sentinel), not a blank/truncated husk that happens to 200.
 *
 * @param {string} html   the page HTML (countdown already injected) — the bytes
 *                        used for the content self-verify + the archive copy.
 * @param {object} [opts] injectable seams for tests (all default to the real path)
 * @param {string} [opts.stagedDir]  a pre-staged site dir to zip (preserves
 *        sibling assets for a multi-file page); when omitted, `html` is zipped as
 *        a lone index.html (the renew path — single self-contained page).
 * @param {(zip:string)=>Promise<{url:string,claim:string|null,uploadedAtUTC:string}>} [opts.uploadFn]
 * @param {(url:string)=>Promise<number>} [opts.probe]      HTTP status probe
 * @param {(url:string)=>Promise<string>} [opts.fetchFn]    page-body fetch
 * @param {(ms:number)=>Promise<void>} [opts.sleepFn]       backoff sleep
 * @returns {Promise<{url:string, claim:string|null, expiryEpoch:number}>}
 */
export async function deployHtmlString(html, opts = {}) {
  const { probe, fetchFn, sleepFn } = opts;

  // Upload: real zip+playwright by default, or an injected uploadFn for tests.
  let url, claim, uploadedAtUTC;
  if (opts.uploadFn) {
    ({ url, claim, uploadedAtUTC } = await opts.uploadFn(html));
  } else {
    const { execFileSync } = await import('node:child_process');
    let stagedDir = opts.stagedDir;
    if (!stagedDir) {
      // renew path: no asset dir — zip the html as a lone index.html.
      const root = mkdtempSync(join(tmpdir(), 'drop-'));
      stagedDir = join(root, 'site');
      mkdirSync(stagedDir, { recursive: true });
      writeFileSync(join(stagedDir, 'index.html'), html);
    }
    const zipPath = join(dirname(stagedDir), 'drop-site.zip');
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stagedDir });
    const { uploadToDrop } = await import('./upload.mjs');
    ({ url, claim, uploadedAtUTC } = await uploadToDrop(zipPath));
  }
  if (!url) throw new Error('deployHtmlString: no url returned from Drop');

  // Single verification exit: edge-propagation 200 poll, THEN content check.
  const live = await verifyWithBackoff(url, { probe, sleepFn });
  const contentOk = live && (await verifyContent(url, { sourceHtml: html, fetchFn }));
  if (!contentOk) {
    // A 200 husk is still a failure — never report a link that serves a blank
    // or truncated page (round-016 A6).
    const e = new Error('URL_UNVERIFIED');
    e.url = url;
    throw e;
  }
  const expiryEpoch = expiryFor(Math.floor(Date.parse(uploadedAtUTC) / 1000));
  return { url, claim: claim || null, expiryEpoch };
}

// CLI entry — two modes:
//   node deploy.mjs <page.html>      deploy a page (stage → zip → upload → verify → archive)
//   node deploy.mjs renew <url|id>   renew an expired link from the deploy index
// Kept thin; the units (staging, index, backoff) are tested.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [arg1, arg2] = process.argv.slice(2);

  if (arg1 === 'renew') {
    // --- renew subcommand -------------------------------------------------
    const target = arg2;
    if (!target) {
      console.error('usage: node deploy.mjs renew <url|id>');
      process.exit(2);
    }
    try {
      const res = await renewDeploy(target, { deployFn: deployHtmlString });
      // Expectation honesty: renew produces a NEW url (Drop can't revive the
      // original). Surface it plainly along with the renew chain + claim link.
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
      if (e && e.url) {
        console.log('URL_UNVERIFIED', e.url);
      } else {
        console.log('RENEW_FAILED', (e && e.message) || String(e));
      }
      process.exitCode = 1;
    }
  } else {
    // --- default deploy ---------------------------------------------------
    const htmlPath = arg1;
    if (!htmlPath || !existsSync(htmlPath)) {
      console.error('usage: node deploy.mjs <page.html>  |  node deploy.mjs renew <url|id>');
      process.exit(2);
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const expiryEpoch = expiryFor(nowEpoch);

    // Stage exactly what we'll archive/verify (countdown injected, index.html) —
    // stageForDrop also copies sibling assets, so a multi-file page renders.
    const { stagedDir, indexPath } = stageForDrop(htmlPath, expiryEpoch);
    const stagedHtml = readFileSync(indexPath, 'utf8');

    try {
      // Same single verification exit as renew: upload → 200 backoff → content
      // check, all inside deployHtmlString. Pass the staged dir so assets ship.
      const { url, claim, expiryEpoch: realExpiry } = await deployHtmlString(stagedHtml, { stagedDir });
      // Archive the deploy so `renew` can rebuild it after it expires.
      try {
        recordDeploy({
          url,
          html: stagedHtml,
          expiryEpoch: realExpiry,
          claimUrl: claim || '',
          title: basename(htmlPath),
        });
      } catch (e) {
        // Archiving is a durability enhancement, not the deliverable — never
        // let a failed index write block reporting a live, verified URL.
        console.error('INDEX_WRITE_SKIPPED', (e && e.message) || String(e));
      }
      console.log('RESULT_URL', url);
      console.log('CLAIM_LINK', claim || '(none found)');
      console.log('EXPIRY_EPOCH', realExpiry);
    } catch (e) {
      if (e && e.url) {
        console.log('URL_UNVERIFIED', e.url); // 200 husk or edge never propagated
      } else {
        console.log('NO_URL_FOUND'); // caller fails open (deliver the file; no token reflex)
      }
      process.exitCode = 1;
    }
  }
}
