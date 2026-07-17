// Static checks for upload.mjs — the playwright uploader can't run without a
// real browser + real Cloudflare Drop (that's the e2e criterion), but we can
// assert its SHAPE: it exists, parses, exports the upload function, and encodes
// the three real-machine gotchas round-012 discovered (round-013 spec 01).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const uploadPath = join(here, '..', 'references', 'upload.mjs');
const src = readFileSync(uploadPath, 'utf8');

test('upload.mjs exports an uploadToDrop function', async () => {
  const mod = await import(uploadPath);
  assert.equal(typeof mod.uploadToDrop, 'function', 'must export uploadToDrop');
});

test('gotcha 1 — ToS dialog is handled AFTER the file is set (not before)', () => {
  const setIdx = src.indexOf('setInputFiles');
  const acceptIdx = src.search(/accept/i);
  assert.ok(setIdx !== -1, 'must call setInputFiles');
  assert.ok(acceptIdx > setIdx, 'the Accept/ToS handling must come after setInputFiles');
  assert.match(src, /after (the )?upload|after setInputFiles|surfaces? (a )?(terms|tos)/i,
    'must note the ToS-appears-after-upload gotcha');
});

test('gotcha 2 — deploy is slow: poll at least 120s', () => {
  assert.match(src, /120000|120_000|120\s*\*\s*1000|regions reached/i,
    'must wait >=120s for the slow deploy (round-012: "18/18 regions reached")');
});

test('gotcha 3 — only / serves: index.html must be the zip root', () => {
  assert.match(src, /index\.html|zip root|only .*\/ .*serve/i,
    'must note the index.html-at-zip-root / only-/-serves gotcha');
});

test('reads the URL from the DOM, never invents it', () => {
  assert.match(src, /workers\.dev/, 'must look for the real *.workers.dev URL');
  assert.match(src, /never (invent|transcribe|screenshot)|from the DOM/i,
    'must state the do-not-invent-URL discipline');
});

// --- playwright dependency honesty (round-016 spec 02, U1a) ----------------
// A restricted/offline device may not have playwright and can't install it. The
// deploy must fail with an EXPLICIT error + install instructions, never a silent
// assumption (a bare ERR_MODULE_NOT_FOUND) that leaves the device hanging.

test('exports ensurePlaywright as an explicit, testable dependency guard', async () => {
  const mod = await import(uploadPath);
  assert.equal(typeof mod.ensurePlaywright, 'function', 'must export ensurePlaywright');
});

test('ensurePlaywright throws a clear error WITH install guidance when missing', async () => {
  const { ensurePlaywright } = await import(uploadPath);
  // Simulate playwright being absent by injecting a loader that rejects.
  const missingLoader = async () => {
    throw new Error("Cannot find package 'playwright'");
  };
  await assert.rejects(
    () => ensurePlaywright({ importFn: missingLoader }),
    (e) => {
      assert.match(e.message, /playwright/i, 'names the missing dependency');
      assert.match(e.message, /npx playwright install|pnpm add|npm i/i, 'gives an install command');
      return true;
    },
    'a missing playwright must surface an explicit, actionable error',
  );
});

test('ensurePlaywright returns the chromium handle when present', async () => {
  const { ensurePlaywright } = await import(uploadPath);
  const fakeChromium = { launch: async () => ({}) };
  const okLoader = async () => ({ chromium: fakeChromium });
  const chromium = await ensurePlaywright({ importFn: okLoader });
  assert.equal(chromium, fakeChromium, 'returns the chromium API when playwright loads');
});

test('the deploy path does NOT statically import playwright (loads it lazily)', () => {
  // A static top-level `import ... from 'playwright'` crashes the whole module on
  // a device without playwright — before any honest error can be shown. The
  // dependency must be loaded lazily through the guard instead.
  assert.doesNotMatch(
    src,
    /^\s*import\s+\{[^}]*\}\s+from\s+['"]playwright['"]/m,
    'must not statically import playwright at module top level',
  );
});
