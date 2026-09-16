// Falsification suite for bin/check-skills.mjs.
//
// Every test here plants an input that SHOULD be rejected and asserts it is.
// That is the whole point: this repo has twice shipped a gate that could not
// fail — a regex that stopped matching and passed everything silently, and a
// `bins` rule whose search matched the declaration it was meant to verify, so
// every possible input passed. Both reported "ok" in exactly the voice of a
// check that worked. Reading the code does not distinguish the two cases;
// only an input that ought to fail does.
//
// So: no test in this file asserts only that a good skill passes. Each rule
// gets at least one planted defect, and the flag extractor additionally gets a
// count assertion, because an extractor that quietly matches less is the one
// failure that produces no output at all.
//
// The fixtures are self-contained — a stand-in core script with its own
// argument parser — so this suite does not go red when the real SKILL.md files
// legitimately change. `npm run check` is what tests the real corpus.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSkills, loadCoreFlags, scriptFlags } from "../bin/check-skills.mjs";

const ROOT = mkdtempSync(join(tmpdir(), "check-skills-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));

// A stand-in for ofox-video.sh. Only the shape of its argument parser matters:
// scriptFlags() reads the `case` patterns, so these five flags are the entire
// accepted surface in these tests. It names curl and jq so the fixture core's
// own `requires.bins` is honest.
const CORE_SCRIPT = `#!/usr/bin/env bash
# Submits with curl and reads the response with jq.
while [ $# -gt 0 ]; do
  key="$1"; val="$2"
  case "$key" in
    --prompt|--name) label="$val" ;;
    --duration) duration="$val" ;;
    --out-dir) out_dir="$val" ;;
    --extra-json) extra="$val" ;;
  esac
  shift
done
`;

function frontmatter(name, o = {}) {
  const home = o.homepage ?? `https://github.com/ofoxai/skills/tree/main/skills/${name}`;
  return [
    "---",
    `name: ${name}`,
    `description: ${o.description ?? "A probe skill — use when exercising the checker."}`,
    "license: MIT",
    `version: "${o.version ?? "1.0.0"}"`,
    `homepage: ${home}`,
    "metadata:",
    "  author: ofoxai",
    `  version: "${o.metaVersion ?? o.version ?? "1.0.0"}"`,
    "  openclaw:",
    "    requires:",
    "      env: [OFOX_API_KEY]",
    `      bins: [${o.bins ?? "curl, jq"}]`,
    "    primaryEnv: OFOX_API_KEY",
    `    homepage: ${o.openclawHomepage ?? home}`,
    "---",
    "",
  ].join("\n");
}

let n = 0;
// Builds a skills directory holding one scenario skill (`probe`) and the core
// it delegates to, and returns what the checker made of `probe`.
function check(body, o = {}) {
  const dir = join(ROOT, `t${n++}`);
  mkdirSync(join(dir, "ofox-video-core", "references"), { recursive: true });
  writeFileSync(join(dir, "ofox-video-core", "references", "ofox-video.sh"), CORE_SCRIPT);
  writeFileSync(
    join(dir, "ofox-video-core", "SKILL.md"),
    frontmatter("ofox-video-core") + "\nRun `references/ofox-video.sh generate`.\n",
  );
  writeFileSync(join(dir, "ofox-video-core", "CHANGELOG.md"), "# Changelog\n\n## 1.0.0 — first\n");

  mkdirSync(join(dir, "probe"), { recursive: true });
  // The trailing line is what makes `probe` a scenario skill: a file that
  // names no core delegates to nothing, so neither the prose rule nor the
  // transitive half of the bins rule applies to it. Appended after the body
  // so a planted defect keeps the line number the test asserts.
  writeFileSync(
    join(dir, "probe", "SKILL.md"),
    `${frontmatter("probe", o) + body}\nEverything mechanical is ofox-video-core's.\n`,
  );
  if (!o.noChangelog) {
    writeFileSync(
      join(dir, "probe", "CHANGELOG.md"),
      `# Changelog\n\n## ${o.changelogVersion ?? o.version ?? "1.0.0"} — first\n`,
    );
  }

  const results = checkSkills(dir);
  const core = results.find((r) => r.name === "ofox-video-core");
  // A defect planted in `probe` must not leak into the core fixture; if it
  // does, the assertions below are measuring the wrong thing.
  assert.deepEqual(core.problems, [], "the core fixture should always be clean");
  return results.find((r) => r.name === "probe");
}

const messages = (r) => r.problems.map((p) => `${p.line}:${p.column ?? 0} ${p.message}`);
const cmd = (...lines) =>
  ["```bash", "bash ../ofox-video-core/references/ofox-video.sh generate \\", ...lines, "```", ""].join("\n");

// ---------------------------------------------------------------------------
// Rule 1 — flags
// ---------------------------------------------------------------------------

test("a flag the core script does not accept is caught inside a command", () => {
  const r = check(cmd("  --duration 4 \\", "  --nosuchflag 7"));
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].rule, "flags");
  assert.match(r.problems[0].message, /`--nosuchflag` is not a flag ofox-video\.sh accepts/);
  assert.equal(r.problems[0].line, 20); // the fourth line of the fenced block
});

test("a flag the core script does not accept is caught in prose", () => {
  const r = check("Pass `--nosuchflag 4` on every run.\n");
  assert.deepEqual(messages(r), ["17:7 `--nosuchflag` is not a flag ofox-video.sh accepts"]);
});

test("the SECOND flag of a prose span is checked too, not just the one it opens with", () => {
  // Reading only the opening flag left ten real mentions unchecked in the
  // repo, and left the printed total unchanged, so nothing showed it.
  const r = check("Pass `--duration 4 --nosuchflag 5` together.\n");
  assert.deepEqual(messages(r), ["17:20 `--nosuchflag` is not a flag ofox-video.sh accepts"]);
});

test("a span that names another tool first is not read as a claim about the core", () => {
  const r = check("Build the payload with `jq --arg name value`.\n");
  assert.deepEqual(r.problems, []);
});

test("a flag-shaped word inside a quoted prompt is not reported", () => {
  const r = check(cmd('  --prompt "shot on a --nosuchflag camera" \\', "  --duration 4"));
  assert.deepEqual(r.problems, []);
});

test("a quoted prompt written across lines keeps masking, and the command survives it", () => {
  // The prompt's own line does not end in a backslash. Before the open quote
  // was carried across lines, the command span ended right there and every
  // remaining flag of that command went unchecked — silently.
  const r = check(
    cmd(
      '  --prompt "line one of the prompt',
      '  --nosuchflag is still inside the quoted string" \\',
      "  --alsobogus 4",
    ),
  );
  assert.deepEqual(messages(r), ["21:3 `--alsobogus` is not a flag ofox-video.sh accepts"]);
});

test("an escaped quote does not end the quoted run", () => {
  const r = check(cmd('  --prompt "she said \\"go --nosuchflag\\" and left" \\', "  --duration 4"));
  assert.deepEqual(r.problems, []);
});

test("an apostrophe earlier on the line does not hide a real defect after it", () => {
  // `<the brief's ratio>` used to mask the rest of its line, which is how one
  // real `--out-dir` mention stopped being checked without anything saying so.
  const r = check(cmd("  --duration 4 \\", "  --out-dir <this project's assets> --nosuchflag"));
  assert.deepEqual(messages(r), ["20:37 `--nosuchflag` is not a flag ofox-video.sh accepts"]);
});

test("a single-quoted argument is masked", () => {
  const r = check(cmd("  --extra-json '{\"mode\":\"--nosuchflag\"}' \\", "  --duration 4"));
  assert.deepEqual(r.problems, []);
});

test("the count of compared mentions is reported, and it counts every one", () => {
  // An extractor that quietly stops matching produces no output at all — the
  // only visible difference is this number. So it is asserted, not eyeballed.
  const r = check(cmd('  --prompt "x" \\', "  --duration 4 \\", "  --out-dir /tmp/x") + "\nAlso `--name` and `--duration 8`.\n");
  assert.equal(r.problems.length, 0);
  assert.equal(r.flagsChecked, 5); // 3 in the command, 2 in prose
});

test("a flag the core really accepts is not reported", () => {
  const r = check("Prepare the frame with `--duration 4` first.\n");
  assert.deepEqual(r.problems, []);
});

test("a mention is left alone when a core it could belong to is not on disk", () => {
  // The fixture has ofox-video-core and not ofox-image-core. A prose mention
  // names no script, so it is a claim about either — and it cannot be refuted
  // while only one of them is readable. Hiding one core from the real repo and
  // re-running is what found this: 170 correct mentions were reported as flags
  // the OTHER core does not accept.
  const r = check("Prepare it with `--nosuchflag 4` first.\nSee ofox-image-core for the still.\n");
  assert.deepEqual(r.problems, []);
  assert.equal(r.flagsChecked, 0, "it must not be counted as checked either");
});

test("loadCoreFlags reports the core it could not read, so the fail-open is visible", () => {
  const { flagsByScript, missing } = loadCoreFlags(join(ROOT, "t0"));
  assert.deepEqual([...flagsByScript.keys()], ["ofox-video.sh"]);
  assert.equal(missing.length, 1);
  assert.match(missing[0], /ofox-image-core[/\\]references[/\\]ofox-image\.sh$/);
});

test("scriptFlags reads the parser rather than a list kept here", () => {
  const dir = join(ROOT, "flags");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "s.sh");
  writeFileSync(path, CORE_SCRIPT);
  assert.deepEqual(
    [...scriptFlags(path)].sort(),
    ["--duration", "--extra-json", "--name", "--out-dir", "--prompt"],
  );
});

// ---------------------------------------------------------------------------
// Rule 3 — versions
// ---------------------------------------------------------------------------

test("metadata.version drifting from the top-level version is caught", () => {
  const r = check("Body.\n", { version: "1.1.0", metaVersion: "1.0.9", changelogVersion: "1.1.0" });
  assert.deepEqual(messages(r), [
    "9:12 `metadata.version` is 1.0.9 but the top-level `version` is 1.1.0 (line 5)",
  ]);
});

test("a CHANGELOG whose newest entry names another version is caught", () => {
  const r = check("Body.\n", { version: "1.1.0", changelogVersion: "1.2.0" });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0].message, /frontmatter says 1\.1\.0, CHANGELOG\.md's newest entry says 1\.2\.0/);
});

test("a missing CHANGELOG is caught", () => {
  const r = check("Body.\n", { noChangelog: true });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0].message, /CHANGELOG\.md has no/);
});

// ---------------------------------------------------------------------------
// Rule 4 — homepage
// ---------------------------------------------------------------------------

test("a homepage pointing at a sibling skill is caught in both fields", () => {
  const home = "https://github.com/ofoxai/skills/tree/main/skills/some-other-skill";
  const r = check("Body.\n", { homepage: home });
  assert.deepEqual(messages(r), [
    "6:11 `homepage` does not end in /probe",
    "15:15 `metadata.openclaw.homepage` does not end in /probe",
  ]);
});

test("the two homepage fields disagreeing is caught", () => {
  const r = check("Body.\n", {
    openclawHomepage: "https://github.com/ofoxai/skills/tree/main/skills/probe/",
  });
  // The trailing slash alone is fine; the mismatch between the two is not.
  assert.deepEqual(messages(r), [
    "15:15 `metadata.openclaw.homepage` differs from the top-level `homepage`",
  ]);
});

// ---------------------------------------------------------------------------
// Rule 5 — declared bins
// ---------------------------------------------------------------------------

test("a declared bin that nothing reaches for is caught", () => {
  const r = check("Body.\n", { bins: "curl, jq, zzznotarealbin" });
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0].message, /lists `zzznotarealbin`/);
});

test("the frontmatter declaration is not accepted as evidence for itself", () => {
  // The first version of this rule searched the whole SKILL.md, so the word in
  // `bins: [.., sox]` matched its own declaration and no input could fail.
  // A bin named nowhere BUT the declaration is the input that proves it.
  const r = check("Body with no tool names in it at all.\n", { bins: "sox" });
  assert.equal(r.problems.length, 1, "a bin present only in its own declaration must still fail");
  assert.match(r.problems[0].message, /lists `sox`/);
});

test("a bin reached only through the core script it delegates to is accepted", () => {
  // CONTRIBUTING.md counts a transitive dependency as the skill's own: `curl`
  // appears in the core script, never in this skill's text.
  const r = check("Body with no tool names in it at all.\n", { bins: "curl" });
  assert.deepEqual(r.problems, []);
});

// ---------------------------------------------------------------------------
// The gate in front of the gate
// ---------------------------------------------------------------------------

test("a skill whose frontmatter does not parse is skipped, not guessed at", () => {
  const dir = join(ROOT, "unparseable");
  mkdirSync(join(dir, "probe"), { recursive: true });
  writeFileSync(
    join(dir, "probe", "SKILL.md"),
    "---\nname: probe\ndescription: broken by a colon: like this\n---\n\nBody.\n",
  );
  const r = checkSkills(dir).find((x) => x.name === "probe");
  assert.equal(r.skipped, true);
  assert.deepEqual(r.problems, []);
});
