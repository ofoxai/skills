// Tests for inject-countdown.mjs — the pre-deploy guard that ensures every
// deployed Drop page carries a 60-minute expiry countdown (round-013 spec 01).
// Run: node --test agents/.template/sessions/.session-template/.claude/skills/cloudflare-drop/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectCountdown, stripCountdown } from '../references/inject-countdown.mjs';

const EXPIRY = 1_800_000_000; // a fixed epoch-seconds value for deterministic assertions

test('injects a countdown into a page that has none', () => {
  const html = '<!doctype html><html><head></head><body><h1>Report</h1></body></html>';
  const out = injectCountdown(html, EXPIRY);
  assert.match(out, /id="drop-expiry-countdown"/, 'countdown element must be present');
  assert.match(out, new RegExp(String(EXPIRY)), 'the real expiry epoch must be stamped in');
  assert.match(out, /链接将在/, 'countdown copy must be present');
  assert.ok(out.includes('<h1>Report</h1>'), 'original content preserved');
});

test('is idempotent — a page that already has the countdown is returned unchanged', () => {
  const html = '<!doctype html><html><body><h1>X</h1></body></html>';
  const once = injectCountdown(html, EXPIRY);
  const twice = injectCountdown(once, EXPIRY);
  assert.equal(twice, once, 'second inject must be a no-op (no duplicate countdown)');
  const count = (twice.match(/id="drop-expiry-countdown"/g) || []).length;
  assert.equal(count, 1, 'exactly one countdown element');
});

test('countdown uses :root vars, not hardcoded colors (light/dark ready)', () => {
  const html = '<!doctype html><html><body></body></html>';
  const out = injectCountdown(html, EXPIRY);
  // The injected style must reference CSS variables, matching the playground standard.
  assert.match(out, /var\(--/, 'countdown styling must go through :root variables');
});

test('fail-open — unparseable/empty input returns something usable, never throws', () => {
  // Countdown is an enhancement; it must never block delivery.
  assert.doesNotThrow(() => injectCountdown('', EXPIRY));
  const out = injectCountdown('not really html', EXPIRY);
  assert.ok(typeof out === 'string' && out.length > 0, 'returns a non-empty string');
});

// --- strip content integrity (round-016 spec 02, A3) -----------------------
// The renew path is inject → archive → strip → re-inject. round-015 A3: a 33.7KB
// page renewed to 1.8KB — strip's fragile cross-body regex ate the whole body,
// leaving only head + the countdown CSS. A page that carries its OWN <style> /
// <div> / <script> (every real page does) is exactly what tripped it.

// A realistic large page: its own <style>, many <div>s, its own <script> — the
// shapes the old strip regex spanned across when it swallowed the body.
function bigPage() {
  const rows = Array.from(
    { length: 40 },
    (_, i) => `<div class="row">Section ${i}: substantial body content here.</div>`,
  ).join('\n');
  return (
    '<!doctype html><html><head><title>Big Report</title>\n' +
    '<style>.row{padding:8px}</style>\n</head><body>\n' +
    '<h1>Quarterly Report</h1>\n' +
    rows +
    "\n<script>function foo(){return 1;}</script>\n</body></html>"
  );
}

test('strip preserves the full body of a page that has its own style/div/script', () => {
  const page = bigPage();
  const withCd = injectCountdown(page, EXPIRY);
  const stripped = stripCountdown(withCd);

  // The whole body survives — the A3 regression was strip eating everything
  // between the page's first <style> and the countdown's </script>.
  assert.ok(stripped.includes('Section 39'), 'last body row survives strip');
  assert.ok(stripped.includes('<h1>Quarterly Report</h1>'), 'heading survives strip');
  assert.ok(stripped.includes('function foo(){return 1;}'), "page's own script survives strip");
  assert.ok(stripped.includes('.row{padding:8px}'), "page's own <style> survives strip");
  // And the countdown itself is gone (so re-inject won't stack two).
  assert.ok(!stripped.includes('id="drop-expiry-countdown"'), 'countdown removed');
  // Size sanity: stripped ≈ original (not the head-only ~1.8KB artifact).
  assert.ok(
    stripped.length >= page.length * 0.9,
    `stripped size ~= original (got ${stripped.length} vs ${page.length})`,
  );
});

test('inject → strip round-trips back to (effectively) the original page', () => {
  const page = bigPage();
  const restored = stripCountdown(injectCountdown(page, EXPIRY));
  // Every non-countdown byte is preserved; the only delta is the injected block.
  assert.equal(
    restored.replace(/\s+/g, ' ').trim(),
    page.replace(/\s+/g, ' ').trim(),
    'strip(inject(page)) === page (modulo the injected countdown block)',
  );
});
