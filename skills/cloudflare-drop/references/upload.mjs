// upload.mjs — deploy a static-site .zip to Cloudflare Drop and read back the
// live *.workers.dev URL, via headless playwright (round-013 spec 01).
//
// This is the DEFAULT cloudflare-drop backend: Drop is an anonymous dropzone
// (no login), so a headless setInputFiles upload is faster and more reliable
// than an LLM hand-driving a browser. Proven on real Drop in round-012 (two
// sessions independently converged on this exact path).
//
// Usage (self-contained; playwright installed on demand, chromium usually cached):
//   npx playwright install chromium   # once, if not cached
//   node references/upload.mjs <path-to.zip>
// The .zip MUST contain index.html at its ROOT (see gotcha 3).
//
// Prints on success:  RESULT_URL <url>  /  CLAIM_LINK <url|none>  /  EXPIRY_EPOCH <n>
// Prints on failure:  NO_URL_FOUND / ERROR <msg>   (caller fails open — never invents a URL)

const DROP_URL = 'https://cloudflare.com/drop';

// Playwright is loaded LAZILY (not a top-level import) so a device without it
// fails with an explicit, actionable error instead of an opaque module-load
// crash that leaves a restricted/offline box hanging (round-016 spec 02, U1a).
const PLAYWRIGHT_INSTALL_HINT =
  "playwright is required to drive the Cloudflare Drop dropzone but isn't available. " +
  'Install it once, then retry:\n' +
  '  pnpm add -g playwright   # or: npm i -g playwright\n' +
  '  npx playwright install chromium\n' +
  "If this device can't install packages (restricted/offline), Drop can't be " +
  'driven here — deliver the .html file instead (fail open, never invent a link).';

/**
 * Ensure playwright is available and return its `chromium` API, or throw a clear
 * error with install guidance. Never assume it's present — a missing dependency
 * on a restricted/offline device must be an honest, actionable failure.
 * @param {{importFn?:(spec:string)=>Promise<any>}} [opts] injectable for tests
 * @returns {Promise<import('playwright').BrowserType>}
 */
export async function ensurePlaywright({ importFn } = {}) {
  const load = importFn || ((spec) => import(spec));
  let mod;
  try {
    mod = await load('playwright');
  } catch (e) {
    const err = new Error(`${PLAYWRIGHT_INSTALL_HINT}\n(underlying: ${(e && e.message) || e})`);
    err.code = 'PLAYWRIGHT_MISSING';
    throw err;
  }
  const chromium = mod && (mod.chromium || (mod.default && mod.default.chromium));
  if (!chromium) {
    const err = new Error(PLAYWRIGHT_INSTALL_HINT);
    err.code = 'PLAYWRIGHT_MISSING';
    throw err;
  }
  return chromium;
}
// gotcha 2 — the Drop deploy is SLOW. round-012 saw it sit on "18/18 regions
// reached / Finishing up" well past 30s; a short timeout reads no URL. Poll >=120s.
const DEPLOY_POLL_MS = 120_000;

/**
 * Upload a zip to Cloudflare Drop, return the live URL read from the DOM.
 * @param {string} zipPath  absolute path to a .zip whose ROOT is index.html
 * @returns {Promise<{url:string|null, claim:string|null, uploadedAtUTC:string}>}
 */
export async function uploadToDrop(zipPath) {
  const chromium = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    await page.goto(DROP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Target the .zip file input directly — reliable, unlike a simulated OS drag.
    // gotcha 3 — Drop maps the deploy entry to the ROOT, and only `/` serves the
    // page (`/index.html` returns 404). So the zip's root file must be index.html.
    const zipInput = page.locator('input[type=file][accept*=".zip"]').first();
    await zipInput.setInputFiles(zipPath);

    // gotcha 1 — the Terms-of-Service dialog surfaces only AFTER upload (after the
    // file is set); checking for it before upload just hangs. Click Accept once shown.
    await page.waitForTimeout(1200);
    const accept = page.getByRole('button', { name: /^accept$/i }).first();
    try {
      await accept.waitFor({ state: 'visible', timeout: 8000 });
      await accept.click();
    } catch {
      const alt = page.locator('button, [role=button]').filter({ hasText: /^Accept$/ }).first();
      if (await alt.count()) await alt.click();
    }

    // Poll the DOM for the deployed URL. NEVER invent, screenshot-transcribe, or
    // guess it — read the exact *.workers.dev string from the page, or report none.
    let url = null;
    const start = Date.now();
    while (Date.now() - start < DEPLOY_POLL_MS) {
      url = await findUrl(page);
      if (url) break;
      await page.waitForTimeout(1000);
    }

    const uploadedAtUTC = new Date().toISOString();
    const claim = await page.evaluate(() => {
      const a = document.querySelector('a[href*="claim"], a[href*="/drop/claim"]');
      return a ? a.href : null;
    });

    return { url, claim, uploadedAtUTC };
  } finally {
    await browser.close();
  }
}

// Read the real deployed URL from the DOM (attribute hit first, then a body-text
// regex fallback). Returns null when no *.workers.dev URL is present.
async function findUrl(page) {
  return page.evaluate(() => {
    const attrHit = document.querySelector(
      'a[href*=".workers.dev"], input[value*=".workers.dev"]'
    );
    if (attrHit) return attrHit.href || attrHit.value;
    const m = (document.body.innerText || '').match(
      /https:\/\/drop-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i
    );
    return m ? m[0] : null;
  });
}

// CLI entry: node upload.mjs <zip>. Prints machine-readable lines for the caller.
if (import.meta.url === `file://${process.argv[1]}`) {
  const zip = process.argv[2];
  if (!zip) {
    console.error('usage: node upload.mjs <path-to.zip>  (zip root must be index.html)');
    process.exit(2);
  }
  uploadToDrop(zip)
    .then(({ url, claim, uploadedAtUTC }) => {
      if (url) {
        // Drop links expire ~60 min after deploy — stamp the real expiry for the
        // page countdown (inject-countdown.mjs consumes this).
        const expiryEpoch = Math.floor(Date.parse(uploadedAtUTC) / 1000) + 3600;
        console.log('RESULT_URL', url);
        console.log('CLAIM_LINK', claim || '(none found)');
        console.log('EXPIRY_EPOCH', expiryEpoch);
      } else {
        console.log('NO_URL_FOUND');
        process.exitCode = 1;
      }
    })
    .catch((e) => {
      console.log('ERROR', (e && e.message) || String(e));
      process.exitCode = 1;
    });
}
