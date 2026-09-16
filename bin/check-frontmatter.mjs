#!/usr/bin/env node
// check-frontmatter.mjs — refuse to ship a SKILL.md whose frontmatter does not
// parse as YAML.
//
// Why this exists, and why it is not a style check: `ugc-ads`,
// `ofox-image-core` and `music-video` each shipped a `description` containing
// a `: ` (colon then space) inside an unquoted value. YAML reads that as a
// nested mapping and rejects the whole block, so `skills add` SKIPPED the
// file — and then printed the number of skills it found and exited zero.
// It reports what it found, never what it dropped. `ugc-ads` was
// uninstallable from skills.sh for two release rounds and nobody noticed,
// because the publish gate checked field presence with grep, and a broken
// YAML block passes grep perfectly.
//
// So the gate that was missing is not "are the fields there" but "does this
// parse at all".
//
// No dependencies, on purpose: this ships inside the npm package so `doctor`
// can use it too, and that package has none. Node has no built-in YAML
// parser, so instead of half-parsing YAML this validates the one shape this
// repo's frontmatter actually uses — a flat block of `key: value` lines plus
// an indented `metadata:` subtree — against the real rules for a YAML plain
// scalar. What it covers is listed in FATAL below. What it does NOT cover:
// multi-line values, anchors, flow collections, and anything else this repo
// does not write. If that changes, parse it for real instead of extending
// this.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// A YAML plain (unquoted) scalar cannot contain these. Each one is a real
// failure mode, not a preference — the third is the only one that errors
// loudly; the other two corrupt the value and keep going, which is worse.
const FATAL = [
  {
    // "a: b" inside a value => YAML sees a nested mapping and rejects the
    // block. This is the one that cost two release rounds.
    test: (v) => v.indexOf(": "),
    label: "a colon followed by a space",
    consequence:
      "YAML reads this as a nested mapping and rejects the whole frontmatter block. The installer then skips the skill silently.",
    fix: 'use an em dash (" — ") instead, as the rest of these descriptions do',
  },
  {
    // " #" starts a comment. No error — the value is just truncated there.
    test: (v) => v.indexOf(" #"),
    label: "a space followed by a hash",
    consequence:
      "YAML treats the rest of the line as a comment. No error is raised; the value is silently truncated.",
    fix: "rephrase, or quote the whole value",
  },
];

// A value that opens a flow collection — `env: [OFOX_API_KEY]` — is ordinary
// valid YAML, and the rules above do not apply inside one. The first draft of
// this file flagged the leading `[` as an indicator character and reported all
// nineteen skills as broken, which is the failure mode that gets a gate
// switched off rather than fixed. So: flow collections are skipped, and this
// checker deliberately has no opinion about anything it has not seen break.
const opensFlowCollection = (v) => v.startsWith("[") || v.startsWith("{");

// The two facts about a frontmatter block that more than one reader needs:
// where the block ends, and what counts as a `key:` line inside it.
// check-skills.mjs reads the same block for a different purpose (it wants the
// values; this file only wants to know the block parses), and two files
// disagreeing about where the block stops or what a key looks like is the
// failure where both report themselves correct about a different set of lines.
// So there is one definition, here, and the other reader imports it.
export const frontmatterEnd = (lines) =>
  lines[0] === "---" ? lines.indexOf("---", 1) : -1;

export const KEY_LINE = /^(\s*)([A-Za-z_][\w.-]*):(.*)$/;

export function checkFrontmatter(skillMdPath) {
  const problems = [];
  const text = readFileSync(skillMdPath, "utf8");
  const lines = text.split("\n");

  if (lines[0] !== "---") {
    problems.push({ line: 1, message: "no frontmatter: the file must open with `---`" });
    return problems;
  }
  const end = frontmatterEnd(lines);
  if (end === -1) {
    problems.push({ line: 1, message: "frontmatter is never closed with `---`" });
    return problems;
  }

  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;

    const m = KEY_LINE.exec(line);
    if (!m) continue; // list items and continuations: not this checker's shape
    const [, indent, key, rest] = m;

    // `key:` with nothing after it opens a subtree (metadata:, openclaw:) —
    // there is no scalar to validate.
    if (rest.trim() === "") continue;
    if (!rest.startsWith(" ")) {
      problems.push({
        line: i + 1,
        column: indent.length + key.length + 2,
        message: `\`${key}:\` needs a space after the colon`,
      });
      continue;
    }

    const value = rest.slice(1);
    const valueCol = indent.length + key.length + 3;

    // Quoted values are allowed to contain anything the quoting permits; the
    // fatal patterns below only apply to plain scalars.
    const quoted =
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1);
    if (quoted) continue;
    if (opensFlowCollection(value)) continue;

    for (const rule of FATAL) {
      const at = rule.test(value);
      if (at === -1) continue;
      problems.push({
        line: i + 1,
        column: valueCol + at,
        message: `\`${key}\` contains ${rule.label}`,
        excerpt: value.slice(Math.max(0, at - 32), at + 34),
        consequence: rule.consequence,
        fix: rule.fix,
      });
      break;
    }
  }
  return problems;
}

export function checkAll(skillsDir) {
  const results = [];
  for (const name of readdirSync(skillsDir).sort()) {
    const dir = join(skillsDir, name);
    let path;
    try {
      if (!statSync(dir).isDirectory()) continue;
      path = join(dir, "SKILL.md");
      statSync(path);
    } catch {
      continue; // not a skill directory
    }
    results.push({ name, path, problems: checkFrontmatter(path) });
  }
  return results;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const skillsDir =
    process.argv[2] ?? fileURLToPath(new URL("../skills", import.meta.url));
  const results = checkAll(skillsDir);
  const broken = results.filter((r) => r.problems.length);

  for (const { name, problems } of broken) {
    for (const p of problems) {
      console.error(
        `BROKEN  ${name}/SKILL.md:${p.line}${p.column ? ":" + p.column : ""}  ${p.message}`,
      );
      if (p.excerpt) console.error(`          …${p.excerpt}…`);
      if (p.consequence) console.error(`          ${p.consequence}`);
      if (p.fix) console.error(`          Fix: ${p.fix}`);
    }
  }

  if (broken.length) {
    console.error(
      `\n${broken.length} of ${results.length} skills have frontmatter that will not parse.`,
    );
    console.error(
      "A skill in this state is skipped by the installer without an error, so it looks published everywhere and cannot be installed anywhere. Do not publish.",
    );
    process.exit(1);
  }
  console.log(`ok  ${results.length} skills, every frontmatter block parses.`);
}
