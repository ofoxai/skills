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
