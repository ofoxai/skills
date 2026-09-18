// Falsification tests for the staging review added in 2.4.0
// (.trellis/spec/skills/falsifiable-gates.md).
//
// The defect: staging copies the source page's whole sibling directory,
// recursively, and this skill's job is to turn a directory into a PUBLIC URL.
// The pre-existing filter already dropped `node_modules`, `.git`, `__MACOSX`
// and every dotfile, so `.env` was never the gap — the gap is the ordinarily
// named file (`secrets.json`, `credentials.txt`, `backup.sql`, `id_rsa`), which
// was staged and published with nothing printed about it.
//
// So these tests plant exactly those files and assert they are NAMED in the
// review, and — the half that matters just as much — that an ordinary
// multi-file page still stages and still reports clean. A review that blocked a
// normal deploy would violate discipline #3 (fail open) and be a worse bug than
// the one it prevents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  stageForDrop,
  stagingReview,
  classifyStagedFile,
  listStagedFiles,
  deployPage,
} from '../deploy.mjs';

const PAGE = '<!doctype html><html><body><h1>Quarterly report</h1><p>Body text long enough to sentinel.</p></body></html>';

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), 'drop-review-'));
  const src = join(dir, 'src');
  mkdirSync(src, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const full = join(src, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
  return { dir, src };
}

test('a plainly named credential file is staged AND named in the review', () => {
  const { dir, src } = project({
    'report.html': PAGE,
    'style.css': 'body{}',
    'secrets.json': '{"who":"cares"}',
    'config/credentials.txt': 'nothing real here',
    'backup.sql': 'CREATE TABLE t (id int);',
    'keys/id_rsa': 'not a key',
  });
  try {
    const { files } = stageForDrop(join(src, 'report.html'), null, dir);
    const lines = stagingReview(files);

    // The exact files the defect was about, each named with its path.
    const text = lines.join('\n');
    for (const name of ['secrets.json', 'config/credentials.txt', 'backup.sql', 'keys/id_rsa']) {
      assert.ok(text.includes(name), `${name} must be named in the review`);
    }
    assert.match(text, /SENSITIVE_NAME {2}secrets\.json/);
    assert.match(text, /UNEXPECTED_TYPE {2}backup\.sql/);
    assert.match(lines[0], /^STAGED_FILES \d+$/);
    assert.match(lines[1], /^STAGED_REVIEW 4 of 7 staged files are outside/);
    assert.match(lines[1], /publicly readable/);

    // And it did NOT block: the deliverable is staged either way.
    assert.ok(files.some((f) => f.path === 'index.html'));
    assert.ok(files.some((f) => f.path === 'style.css'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an ordinary multi-file page reports clean — the review is not a gate', () => {
  const { dir, src } = project({
    'report.html': PAGE,
    'style.css': 'body{}',
    'app.js': 'console.log(1)',
    'img/logo.png': 'PNG',
    'fonts/inter.woff2': 'FONT',
  });
  try {
    const { files } = stageForDrop(join(src, 'report.html'), null, dir);
    const lines = stagingReview(files);
    assert.equal(lines.length, 2, 'a clean run prints a headline and a verdict, nothing else');
    assert.equal(lines[0], 'STAGED_FILES 6');
    assert.match(lines[1], /^STAGED_REVIEW ok —/);
    assert.ok(files.every((f) => f.kind === 'asset'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the review prints a headline even with nothing flagged, so silence means nothing ran', () => {
  const lines = stagingReview([]);
  assert.equal(lines[0], 'STAGED_FILES 0');
  assert.match(lines[1], /^STAGED_REVIEW ok/);
});

test('classification: extension decides, and a credential name overrides the extension', () => {
  assert.equal(classifyStagedFile('index.html'), 'asset');
  assert.equal(classifyStagedFile('img/logo.png'), 'asset');
  assert.equal(classifyStagedFile('fonts/inter.woff2'), 'asset');
  assert.equal(classifyStagedFile('data.json'), 'asset');
  // `secrets.json` has an allowed extension; the name is what catches it.
  assert.equal(classifyStagedFile('secrets.json'), 'sensitive');
  assert.equal(classifyStagedFile('deploy/service-account.pem'), 'sensitive');
  assert.equal(classifyStagedFile('id_rsa'), 'sensitive');
  assert.equal(classifyStagedFile('prod.env'), 'sensitive');
  assert.equal(classifyStagedFile('backup.sql'), 'unexpected');
  assert.equal(classifyStagedFile('dump.sqlite'), 'unexpected');
  assert.equal(classifyStagedFile('export.csv'), 'unexpected');
  assert.equal(classifyStagedFile('README'), 'unexpected');
});

test('--assets-only leaves the flagged files behind, and says which', () => {
  const { dir, src } = project({
    'report.html': PAGE,
    'style.css': 'body{}',
    'secrets.json': '{}',
    'backup.sql': 'x',
    'img/logo.png': 'PNG',
  });
  try {
    const { stagedDir, files, skipped } = stageForDrop(join(src, 'report.html'), null, dir, {
      assetsOnly: true,
    });
    assert.ok(!existsSync(join(stagedDir, 'secrets.json')), 'not staged, so not publishable');
    assert.ok(!existsSync(join(stagedDir, 'backup.sql')));
    // The page and its real assets survive — the opt-in must not break the page.
    assert.ok(existsSync(join(stagedDir, 'index.html')));
    assert.ok(existsSync(join(stagedDir, 'style.css')));
    assert.ok(existsSync(join(stagedDir, 'img', 'logo.png')), 'subdirectories still recurse');
    assert.ok(files.every((f) => f.kind === 'asset'));

    const text = stagingReview(files, { skipped }).join('\n');
    assert.match(text, /STAGED_SKIPPED 2 file\(s\) left behind by --assets-only/);
    assert.ok(text.includes('secrets.json') && text.includes('backup.sql'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the pre-existing exclusions are unchanged — this did not quietly re-scope them', () => {
  const { dir, src } = project({
    'report.html': PAGE,
    '.env': 'STILL_EXCLUDED=1',
    'node_modules/pkg/index.js': 'x',
    'assets/app.js': 'x',
  });
  try {
    const { files } = stageForDrop(join(src, 'report.html'), null, dir);
    const paths = files.map((f) => f.path);
    assert.ok(!paths.includes('.env'), 'dotfiles were already excluded and still are');
    assert.ok(!paths.some((p) => p.startsWith('node_modules/')));
    assert.deepEqual(paths.sort(), ['assets/app.js', 'index.html', 'report.html']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the review reaches the caller BEFORE anything is uploaded', async () => {
  // A review printed after the upload is a review of a page that is already
  // public — the same defect shape as an estimate printed after the job was
  // submitted. Nothing here touches the network: the upload is stubbed.
  const { dir, src } = project({ 'report.html': PAGE, 'secrets.json': '{}' });
  try {
    const events = [];
    const res = await deployPage(join(src, 'report.html'), {
      permanent: true,
      note: (line) => events.push(['note', line]),
      run: () => {
        events.push(['upload', null]);
        return 'https://r.acct.workers.dev\n';
      },
      probe: async () => 200,
      fetchFn: async () => PAGE,
      sleepFn: async () => {},
    });
    assert.equal(res.url, 'https://r.acct.workers.dev');

    const uploadAt = events.findIndex(([kind]) => kind === 'upload');
    assert.ok(uploadAt > 0, 'the upload happened');
    const before = events.slice(0, uploadAt).map(([, line]) => line).join('\n');
    assert.match(before, /^STAGED_FILES 3/m);
    assert.ok(before.includes('secrets.json'), 'the flagged file is named before the upload');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('listStagedFiles walks subdirectories and reports real byte sizes', () => {
  const { dir, src } = project({ 'report.html': PAGE, 'deep/a/b/note.txt': 'hello' });
  try {
    const { stagedDir } = stageForDrop(join(src, 'report.html'), null, dir);
    const found = listStagedFiles(stagedDir).find((f) => f.path === 'deep/a/b/note.txt');
    assert.ok(found, 'a file four levels down is still going to be public');
    assert.equal(found.bytes, 5);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
