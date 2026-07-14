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

/**
 * Deploy an already-staged HTML string to Drop: write it to a temp index.html,
 * zip, upload, backoff-verify. Returns the live url/claim/expiry, or throws if
 * no url comes back. This is the deployFn `renew` hands its rebuilt page to, and
 * it's the shared core the CLI file-path entry uses too.
 * @param {string} html   the page HTML (countdown already injected)
 * @returns {Promise<{url:string, claim:string|null, expiryEpoch:number}>}
 */
export async function deployHtmlString(html) {
  const { execFileSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'drop-'));
  const stagedDir = join(root, 'site');
  mkdirSync(stagedDir, { recursive: true });
  writeFileSync(join(stagedDir, 'index.html'), html);

  const zipPath = join(root, 'drop-site.zip');
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stagedDir });

  const { uploadToDrop } = await import('./upload.mjs');
  const { url, claim, uploadedAtUTC } = await uploadToDrop(zipPath);
  if (!url) throw new Error('deployHtmlString: no url returned from Drop');

  const verified = await verifyWithBackoff(url);
  if (!verified) {
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
      console.log('CLAIM_LINK', res.claim || '(none found)');
      console.log('EXPIRY_EPOCH', res.expiryEpoch);
      console.log('RENEWED_FROM', res.renewedFrom);
      console.log('NOTE this is a NEW url — the original could not be revived; claim it to keep it permanently');
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
    const { execFileSync } = await import('node:child_process');
    const nowEpoch = Math.floor(Date.now() / 1000);
    const expiryEpoch = expiryFor(nowEpoch);

    const { stagedDir, indexPath } = stageForDrop(htmlPath, expiryEpoch);
    const zipPath = join(dirname(stagedDir), 'drop-site.zip');
    // zip the STAGED CONTENTS so index.html is at the archive root (cd into it).
    execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stagedDir });

    const { uploadToDrop } = await import('./upload.mjs');
    const { url, claim, uploadedAtUTC } = await uploadToDrop(zipPath);
    if (!url) {
      console.log('NO_URL_FOUND'); // caller fails open (deliver the file; no token reflex)
      process.exitCode = 1;
    } else {
      // Self-verify with backoff to ride out Drop's edge propagation (#89).
      const ok = await verifyWithBackoff(url);
      const realExpiry = expiryFor(Math.floor(Date.parse(uploadedAtUTC) / 1000));
      if (ok) {
        // Archive the deploy so `renew` can rebuild it after it expires.
        try {
          recordDeploy({
            url,
            html: readFileSync(indexPath, 'utf8'),
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
      } else {
        console.log('URL_UNVERIFIED', url); // do not report a link that didn't 200
        process.exitCode = 1;
      }
    }
  }
}
