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

const EXPIRY_WINDOW_SECONDS = 3600; // Drop links live ~60 min from deploy.

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

// CLI entry — stage, zip, upload, self-verify. Kept thin; the units are tested.
if (import.meta.url === `file://${process.argv[1]}`) {
  const htmlPath = process.argv[2];
  if (!htmlPath || !existsSync(htmlPath)) {
    console.error('usage: node deploy.mjs <page.html>');
    process.exit(2);
  }
  const { execFileSync } = await import('node:child_process');
  const nowEpoch = Math.floor(Date.now() / 1000);
  const expiryEpoch = expiryFor(nowEpoch);

  const { stagedDir } = stageForDrop(htmlPath, expiryEpoch);
  const zipPath = join(dirname(stagedDir), 'drop-site.zip');
  // zip the STAGED CONTENTS so index.html is at the archive root (cd into it).
  execFileSync('zip', ['-r', '-q', zipPath, '.'], { cwd: stagedDir });

  const { uploadToDrop } = await import('./upload.mjs');
  const { url, claim, uploadedAtUTC } = await uploadToDrop(zipPath);
  if (!url) {
    console.log('NO_URL_FOUND'); // caller fails open (deliver the file; no token reflex)
    process.exitCode = 1;
  } else {
    // Self-verify the deployed URL actually serves before reporting it.
    let ok = false;
    try {
      const out = execFileSync('curl', ['-s', '-L', '-o', '/dev/null', '-w', '%{http_code}', url],
        { encoding: 'utf8', timeout: 20000 });
      ok = out.trim() === '200';
    } catch { ok = false; }
    const realExpiry = expiryFor(Math.floor(Date.parse(uploadedAtUTC) / 1000));
    if (ok) {
      console.log('RESULT_URL', url);
      console.log('CLAIM_LINK', claim || '(none found)');
      console.log('EXPIRY_EPOCH', realExpiry);
    } else {
      console.log('URL_UNVERIFIED', url); // do not report a link that didn't 200
      process.exitCode = 1;
    }
  }
}
