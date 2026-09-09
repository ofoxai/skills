import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { stageOtp, verifyOtp } from '../otp.mjs';
import { parseArgs, deployPage, deployHtmlString } from '../deploy.mjs';
import { deployWithWrangler } from '../wrangler.mjs';

const sourceHtml = '<html><body>CONFIDENTIAL_CONTENT_72981</body></html>';
async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'otp-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'site'));
  const staged = stageOtp(join(root, 'site'), { name: 'test-otp', compatibilityDate: '2026-09-09' });
  const config = JSON.parse(readFileSync(staged.configPath, 'utf8'));
  const html = readFileSync(join(root, 'otp-gate.html'), 'utf8');
  const js = readFileSync(join(root, 'otp-worker.mjs'), 'utf8').replace("import gateHtml from './otp-gate.html';", `const gateHtml = ${JSON.stringify(html)};`);
  const mod = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const store = new Map();
  let queue = Promise.resolve();
  const storage = {
    get: async key => structuredClone(store.get(key)),
    put: async (key, value) => store.set(key, structuredClone(value)),
    transaction(fn) { const next = queue.then(() => fn(storage)); queue = next.catch(() => {}); return next; },
  };
  const limiter = new mod.OtpLimiter({ storage });
  let assetCalls = 0;
  const env = { ...config.vars, OTP_LIMITER: { idFromName: s => s, get: () => ({ fetch: (url, init) => limiter.fetch(new Request(url, init)) }) }, ASSETS: { fetch: async () => { assetCalls++; return new Response(sourceHtml, { headers: { ETag: 'private', 'Cache-Control': 'public, max-age=3600' } }); } } };
  const request = (path = '/', init = {}) => mod.default.fetch(new Request(new URL(path, 'https://test.example'), init), env);
  const login = (code = staged.otpCode, ip = '1.2.3.4', extra = {}) => request('/__drop/login', { method: 'POST', headers: { Origin: 'https://test.example', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...extra }, body: JSON.stringify({ code }) });
  return { ...staged, root, config, env, request, login, store, get assetCalls() { return assetCalls; } };
}

test('both OTP spellings parse; temporary mode rejects before reading or deploying', async () => {
  assert.equal(parseArgs(['page.html', '-otp']).otp, true);
  assert.equal(parseArgs(['--otp', '--permanent', 'page.html']).otp, true);
  const saved = [process.env.CLOUDFLARE_API_TOKEN, process.env.CF_API_TOKEN];
  delete process.env.CLOUDFLARE_API_TOKEN; delete process.env.CF_API_TOKEN;
  try { await assert.rejects(deployPage('/missing.html', { otp: true }), /requires permanent/); }
  finally { ['CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN'].forEach((k, i) => saved[i] === undefined ? delete process.env[k] : process.env[k] = saved[i]); }
  await assert.rejects(deployHtmlString(sourceHtml, { otp: true, uploadFn() { throw new Error('must not run'); } }), /protected Worker/);
});

test('OTP material stays outside assets and Worker-first config reaches Wrangler', async t => {
  const f = await fixture(t);
  assert.match(f.otpCode, /^\d{6}$/);
  assert.deepEqual(readdirSync(join(f.root, 'site')), []);
  assert.equal(f.config.assets.run_worker_first, true);
  assert.equal(statSync(f.configPath).mode & 0o777, 0o600);
  assert.ok(!readFileSync(f.configPath, 'utf8').includes(`code:${f.otpCode}`));
  let args;
  deployWithWrangler(join(f.root, 'site'), { configPath: f.configPath, name: 'test', compatibilityDate: '2026-09-09', mode: 'permanent', run: a => { args = a; return ''; } });
  assert.ok(args.includes('--config')); assert.ok(args.includes(f.configPath)); assert.ok(!args.includes('--temporary')); assert.ok(!args.includes(join(f.root, 'site')));
});

test('anonymous paths, HEAD/range/query and forged cookie never read assets', async t => {
  const f = await fixture(t);
  for (const path of ['/', '/index.html', '/data.json', '/file.csv', '/%69ndex.html', '/wrangler.json', '/otp-worker.mjs', '/?code=' + f.otpCode]) {
    for (const method of ['GET', 'HEAD']) {
      const res = await f.request(path, { method, headers: { Range: 'bytes=0-999', Cookie: '__Host-drop_session=9999999999.fake' } });
      assert.equal(res.status, 401);
      const body = await res.text(); assert.ok(!body.includes('CONFIDENTIAL_CONTENT')); assert.ok(!body.includes(f.env.SESSION_KEY));
      assert.match(res.headers.get('Cache-Control'), /no-store/);
    }
  }
  assert.equal(f.assetCalls, 0);
});

test('wrong, malformed, cross-origin and oversized submissions fail; session grants exact content', async t => {
  const f = await fixture(t);
  const wrong = String((Number(f.otpCode) + 1) % 1000000).padStart(6, '0');
  assert.equal((await f.login(wrong)).status, 401);
  assert.equal((await f.login(123456)).status, 400);
  assert.equal((await f.login('12345')).status, 400);
  assert.equal((await f.login(f.otpCode, 'ip', { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.request('/__drop/login', { method: 'POST', headers: { Origin: 'https://test.example', 'Content-Type': 'application/json' }, body: 'x'.repeat(300) })).status, 413);
  const auth = await f.login(); assert.equal(auth.status, 200);
  const cookie = auth.headers.get('Set-Cookie');
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(attr));
  assert.equal((await f.request('https://other.example/', { headers: { Cookie: cookie.split(';')[0] } })).status, 401);
  const content = await f.request('/data.json', { headers: { Cookie: cookie.split(';')[0] } });
  assert.equal(await content.text(), sourceHtml); assert.match(content.headers.get('Cache-Control'), /no-store/); assert.equal(content.headers.get('ETag'), null);
  assert.equal((await f.request('/', { headers: { Cookie: cookie.split(';')[0] + 'a' } })).status, 401);
  for (const expiry of [Math.floor(Date.now()/1000)-1, Math.floor(Date.now()/1000)+7200]) {
    const sig = createHmac('sha256', f.env.SESSION_KEY).update(`session:test.example:${expiry}`).digest('hex');
    assert.equal((await f.request('/', { headers: { Cookie: `__Host-drop_session=${expiry}.${sig}` } })).status, 401);
  }
  assert.equal(await verifyOtp('https://test.example', { otpCode: f.otpCode, sourceHtml, request: f.request }), true);
});

test('durable limits serialize concurrent attempts and bound distributed guesses', async t => {
  const f = await fixture(t);
  const codes = await Promise.all(Array.from({ length: 15 }, () => f.login('000000')));
  assert.equal(codes.filter(r => r.status === 429).length, 5);
  assert.ok(codes.find(r => r.status === 429).headers.has('Retry-After'));
  for (let i = 0; i < 90; i++) await f.login('000000', `ip-${i}`);
  assert.equal((await f.login(f.otpCode, 'fresh-ip')).status, 429);
  f.store.get('window').until = Date.now() - 1;
  assert.equal((await f.login(f.otpCode)).status, 200);
});

test('binding failure fails closed; verifier rejects public fallback', async t => {
  const f = await fixture(t);
  f.env.OTP_LIMITER = null;
  assert.equal((await f.request()).status, 503); assert.equal(f.assetCalls, 0);
  assert.equal(await verifyOtp('https://test.example', { otpCode: f.otpCode, sourceHtml, request: async () => new Response(sourceHtml) }), false);
});
