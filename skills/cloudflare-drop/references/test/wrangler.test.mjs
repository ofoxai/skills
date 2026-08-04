// Tests for wrangler.mjs — the CLI deploy backend (round-015).
//
// Two things here are load-bearing:
//   1. mode detection — wrangler REFUSES --temporary when it sees auth, and
//      refuses a normal deploy non-interactively without a token. Picking the
//      wrong mode means a guaranteed failed deploy.
//   2. the OAuth pause — it moves the USER'S credential file. It must ALWAYS be
//      restored, including when the deploy throws. A crash that leaves someone
//      logged out of Cloudflare is the worst thing this skill could do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  detectAuthMode,
  deployWithWrangler,
  parseDeployedUrl,
  parseClaimUrl,
  oauthConfigPath,
} from '../wrangler.mjs';

const SAMPLE_TEMP_OUT = `
 ⛅️ wrangler 4.116.0
Temporary account ready:
	Account: Ethereal Composer (created)
	Claim within: 60 minutes
	Claim URL: https://dash.cloudflare.com/claim-preview?claimToken=Xq0YTSsDErZOL1wldOExbeIuO0VR4qdFCPqUKqvYWeM
✨ Success! Uploaded 1 file (3.37 sec)
Deployed my-report triggers (0.92 sec)
  https://my-report.ethereal-composer.workers.dev
Current Version ID: dd01a3e0-fd84-4a4f-a628-78364d3a0ff6
`;

function tempHome() {
  const dir = mkdtempSync(join(tmpdir(), 'wr-home-'));
  mkdirSync(join(dir, 'config'), { recursive: true });
  return dir;
}

test('parseDeployedUrl reads the real url, never invents one', () => {
  assert.equal(parseDeployedUrl(SAMPLE_TEMP_OUT), 'https://my-report.ethereal-composer.workers.dev');
  assert.equal(parseDeployedUrl('no url here'), null);
  assert.equal(parseDeployedUrl(''), null);
  assert.equal(parseDeployedUrl(null), null);
});

test('parseClaimUrl extracts the claim link when present', () => {
  assert.match(parseClaimUrl(SAMPLE_TEMP_OUT), /claimToken=Xq0YTSs/);
  assert.equal(parseClaimUrl('deployed, no claim'), null);
});

test('detectAuthMode: a token means a permanent deploy', () => {
  const r = detectAuthMode({ env: { CLOUDFLARE_API_TOKEN: 'x' }, configPath: '/nope' });
  assert.equal(r.mode, 'permanent');
  assert.equal(r.hasToken, true);
});

test('detectAuthMode: no credentials at all means a temporary preview', () => {
  const r = detectAuthMode({ env: {}, configPath: '/definitely/not/here.toml' });
  assert.equal(r.mode, 'temporary');
  assert.equal(r.hasOAuth, false);
});

test('detectAuthMode: OAuth-only is temporary, and says why it needs the pause', () => {
  const home = tempHome();
  const cfg = join(home, 'config', 'default.toml');
  writeFileSync(cfg, 'oauth_token = "x"');
  try {
    const r = detectAuthMode({ env: { WRANGLER_HOME: home } });
    assert.equal(r.mode, 'temporary');
    assert.equal(r.hasOAuth, true);
    assert.match(r.reason, /pause/i, 'reason tells the caller a pause is required');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('oauthConfigPath honours WRANGLER_HOME', () => {
  assert.equal(
    oauthConfigPath({ WRANGLER_HOME: '/tmp/wh' }),
    join('/tmp/wh', 'config', 'default.toml'),
  );
});

test('deploy passes --temporary only in temporary mode, with name + compat date', () => {
  let seen = null;
  const run = (args) => { seen = args; return SAMPLE_TEMP_OUT; };
  deployWithWrangler('/site', {
    name: 'my-report', compatibilityDate: '2026-07-31', mode: 'temporary', run, env: {},
  });
  assert.ok(seen.includes('--temporary'));
  assert.ok(seen.includes('--name') && seen.includes('my-report'));
  assert.ok(seen.includes('--compatibility-date') && seen.includes('2026-07-31'));

  deployWithWrangler('/site', {
    name: 'my-report', compatibilityDate: '2026-07-31', mode: 'permanent', run, env: {},
  });
  assert.ok(!seen.includes('--temporary'), 'permanent deploy must not pass --temporary');
});

test('deploy requires name and compatibility-date (wrangler rejects without them)', () => {
  assert.throws(() => deployWithWrangler('/site', { compatibilityDate: '2026-07-31' }), /name/);
  assert.throws(() => deployWithWrangler('/site', { name: 'x' }), /compatibility-date/);
});

test('OAuth pause restores the credential file after a successful deploy', () => {
  const home = tempHome();
  const cfg = join(home, 'config', 'default.toml');
  writeFileSync(cfg, 'oauth_token = "precious"');
  try {
    deployWithWrangler('/site', {
      name: 'r', compatibilityDate: '2026-07-31', mode: 'temporary',
      allowPauseOAuth: true, env: { WRANGLER_HOME: home },
      run: () => SAMPLE_TEMP_OUT,
    });
    assert.ok(existsSync(cfg), 'credential file restored');
    assert.equal(readFileSync(cfg, 'utf8'), 'oauth_token = "precious"', 'content intact');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('OAuth pause restores the credential file even when the deploy THROWS', () => {
  const home = tempHome();
  const cfg = join(home, 'config', 'default.toml');
  writeFileSync(cfg, 'oauth_token = "precious"');
  try {
    assert.throws(() =>
      deployWithWrangler('/site', {
        name: 'r', compatibilityDate: '2026-07-31', mode: 'temporary',
        allowPauseOAuth: true, env: { WRANGLER_HOME: home },
        run: () => { throw new Error('wrangler exploded'); },
      }), /exploded/);
    assert.ok(existsSync(cfg), 'credential file restored despite the crash');
    assert.equal(readFileSync(cfg, 'utf8'), 'oauth_token = "precious"');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('OAuth is left untouched when the pause is not opted into', () => {
  const home = tempHome();
  const cfg = join(home, 'config', 'default.toml');
  writeFileSync(cfg, 'oauth_token = "precious"');
  try {
    deployWithWrangler('/site', {
      name: 'r', compatibilityDate: '2026-07-31', mode: 'temporary',
      allowPauseOAuth: false, env: { WRANGLER_HOME: home },
      run: () => SAMPLE_TEMP_OUT,
    });
    assert.ok(existsSync(cfg), 'never moved');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
