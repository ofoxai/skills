// Tests for deploy.mjs's staging step — the part that turns an HTML deliverable
// into an upload-ready zip (round-013 spec 01). The actual upload is e2e.
// Staging must: inject the countdown, put index.html at the ZIP ROOT, exclude junk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageForDrop } from '../references/deploy.mjs';

const EXPIRY = 1_800_000_000;

test('staging injects the countdown and writes index.html at the staged root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'drop-stage-'));
  try {
    const src = join(dir, 'report.html');
    writeFileSync(src, '<!doctype html><html><body><h1>Report</h1></body></html>');
    const { stagedDir, indexPath } = stageForDrop(src, EXPIRY, dir);
    assert.ok(indexPath.endsWith('index.html'), 'staged entry must be index.html (gotcha 3)');
    const staged = readFileSync(indexPath, 'utf8');
    assert.match(staged, /id="drop-expiry-countdown"/, 'countdown injected into the staged page');
    assert.match(staged, new RegExp(String(EXPIRY)), 'real expiry stamped');
    assert.ok(staged.includes('<h1>Report</h1>'), 'original content preserved');
    assert.ok(stagedDir.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a page that already has a countdown is not double-injected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'drop-stage-'));
  try {
    const src = join(dir, 'page.html');
    // Pre-inject once via the same guard the staging uses.
    writeFileSync(src, '<!doctype html><html><body><div id="drop-expiry-countdown"></div></body></html>');
    const { indexPath } = stageForDrop(src, EXPIRY, dir);
    const staged = readFileSync(indexPath, 'utf8');
    const count = (staged.match(/id="drop-expiry-countdown"/g) || []).length;
    assert.equal(count, 1, 'exactly one countdown after staging');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
