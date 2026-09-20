// Falsification suite for bin/check-frontmatter.mjs.
//
// Same rule as its sibling: every test plants a block that SHOULD be rejected.
// The defect this gate exists for — a `: ` inside an unquoted description —
// made `ugc-ads` uninstallable from skills.sh for two release rounds while
// every publish gate reported success, so "it passes on the real corpus" is
// not evidence that it works.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEY_LINE, checkFrontmatter, frontmatterEnd } from "../bin/check-frontmatter.mjs";

const ROOT = mkdtempSync(join(tmpdir(), "check-frontmatter-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));

let n = 0;
function check(text) {
  const path = join(ROOT, `s${n++}.md`);
  writeFileSync(path, text);
  return checkFrontmatter(path);
}

const GOOD = `---
name: probe
description: Does a thing — use when a thing needs doing.
license: MIT
version: "1.0.0"
metadata:
  author: ofoxai
  openclaw:
    requires:
      env: [OFOX_API_KEY]
---

Body.
`;

test("a well-formed block reports nothing", () => {
  assert.deepEqual(check(GOOD), []);
});

test("a colon-space inside an unquoted value is caught, with its column", () => {
  const r = check(GOOD.replace("Does a thing —", "Does a thing: it"));
  assert.equal(r.length, 1);
  assert.equal(r[0].line, 3);
  assert.equal(r[0].column, 26); // the colon itself, not the start of the value
  assert.match(r[0].message, /colon followed by a space/);
});

test("a space-hash inside an unquoted value is caught", () => {
  const r = check(GOOD.replace("a thing —", "a thing #2 —"));
  assert.equal(r.length, 1);
  assert.match(r[0].message, /space followed by a hash/);
});

test("the same characters inside a quoted value are fine", () => {
  assert.deepEqual(check(GOOD.replace('"1.0.0"', '"1.0.0: rc #1"')), []);
});

test("a missing space after the colon is caught", () => {
  const r = check(GOOD.replace("license: MIT", "license:MIT"));
  assert.equal(r.length, 1);
  assert.match(r[0].message, /needs a space after the colon/);
});

test("a file with no frontmatter at all is caught", () => {
  const r = check("# Just a heading\n");
  assert.deepEqual(r.map((p) => p.message), ["no frontmatter: the file must open with `---`"]);
});

test("a block that is never closed is caught", () => {
  const r = check("---\nname: probe\n\nBody with no closing marker.\n");
  assert.deepEqual(r.map((p) => p.message), ["frontmatter is never closed with `---`"]);
});

test("a flow collection is not read as a plain scalar", () => {
  // The first draft flagged the leading `[` and reported all nineteen skills
  // broken, which is the failure that gets a gate switched off, not fixed.
  assert.deepEqual(check(GOOD.replace("[OFOX_API_KEY]", "[OFOX_API_KEY, OFOX_BASE: x]")), []);
});

// The two definitions check-skills.mjs imports from here. They are exported so
// there is one answer to each question rather than one per reader.
test("frontmatterEnd finds the closing marker, and -1 when there is none", () => {
  assert.equal(frontmatterEnd(["---", "name: x", "---", "body"]), 2);
  assert.equal(frontmatterEnd(["---", "name: x", "body"]), -1);
  assert.equal(frontmatterEnd(["# heading", "---"]), -1);
});

test("KEY_LINE matches a key line and its indent, and not a list item", () => {
  assert.deepEqual(KEY_LINE.exec("  version: 1.0.0").slice(1), ["  ", "version", " 1.0.0"]);
  assert.equal(KEY_LINE.exec("      - name: OFOX_API_KEY"), null);
});
