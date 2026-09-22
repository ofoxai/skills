import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KEY_LINE,
  checkFrontmatter,
  frontmatterEnd,
} from "../bin/check-frontmatter.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TRELLIS_SKILLS = join(ROOT, ".agents", "skills");
const PUBLIC_SKILLS = join(ROOT, "skills");
const manifest = JSON.parse(readFileSync(join(ROOT, "skills.sh.json"), "utf8"));
const publicNames = manifest.groupings.flatMap(({ skills }) => skills).sort();
const trellisNames = [
  "trellis-before-dev",
  "trellis-brainstorm",
  "trellis-break-loop",
  "trellis-check",
  "trellis-continue",
  "trellis-finish-work",
  "trellis-meta",
  "trellis-spec-bootstarp",
  "trellis-start",
  "trellis-update-spec",
];

function frontmatterValues(skillMdPath) {
  const lines = readFileSync(skillMdPath, "utf8").split("\n");
  const end = frontmatterEnd(lines);
  const values = new Map();
  const stack = [];

  for (let i = 1; i < end; i++) {
    const match = KEY_LINE.exec(lines[i]);
    if (!match) continue;
    const [, indent, key, rest] = match;
    while (stack.length && stack.at(-1).indent >= indent.length) stack.pop();
    const path = [...stack.map((entry) => entry.key), key].join(".");
    const value = rest.trim();
    if (!value) {
      stack.push({ indent: indent.length, key });
    } else {
      values.set(path, value);
    }
  }
  return values;
}

function discoverNormally(...roots) {
  const names = [];
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      const path = join(root, name, "SKILL.md");
      let values;
      try {
        values = frontmatterValues(path);
      } catch {
        continue;
      }
      if (values.get("metadata.internal") !== "true") names.push(name);
    }
  }
  return [...new Set(names)].sort();
}

test("all repository-local Trellis helpers are internal and public discovery stays at 20 skills", () => {
  assert.equal(publicNames.length, 20);
  assert.equal(publicNames.filter((name) => name.startsWith("trellis-")).length, 0);
  for (const name of trellisNames) {
    const skillMd = join(TRELLIS_SKILLS, name, "SKILL.md");
    assert.deepEqual(checkFrontmatter(skillMd), [], `${name} frontmatter must parse`);
    const values = frontmatterValues(skillMd);
    assert.equal(values.get("name"), name);
    assert.equal(values.get("metadata.internal"), "true", `${name} must remain internal`);
  }
  assert.deepEqual(discoverNormally(PUBLIC_SKILLS, TRELLIS_SKILLS), publicNames);
});

test("normal discovery exposes a Trellis helper when its internal marker is missing", () => {
  const fixture = mkdtempSync(join(tmpdir(), "internal-trellis-skill-"));
  try {
    const skillDir = join(fixture, "trellis-start");
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, "SKILL.md"),
      "---\nname: trellis-start\ndescription: fixture\n---\n",
    );
    assert.deepEqual(discoverNormally(fixture), ["trellis-start"]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
