#!/usr/bin/env node
// check-skills.mjs — the parts of CONTRIBUTING.md that a human has to
// remember today, run as a command instead.
//
// Why this exists: the 14 Ofox scenario skills ship no code at all — a
// SKILL.md and a CHANGELOG.md each — so there is nothing here a test suite can
// drive. What they do have is ~1800 lines of documentation quoting the flags,
// versions and paths of scripts that live in a DIFFERENT skill. Documentation
// drifting away from the execution layer is this repo's most-repeated defect
// (a `--real-person` writeback missed 7 files and 11 places and took three
// sweeps; a shared-layer wording change had to be chased across nine skills),
// and none of it is reachable from `bash -n`, from the shell suites, or from
// check-frontmatter.mjs.
//
// So the object under test is the agreement between the docs and the
// execution layer, not the templates themselves.
//
// No dependencies, on purpose: this ships inside the npm package (see
// package.json `files`) so `doctor` can reuse it, and that package has none.
//
// Deliberately NOT checked, so nobody assumes otherwise:
//   - whether a flag is valid for the SUBCOMMAND it is written under. Rule 1
//     checks a flag against the union of everything its script's parsers
//     accept, so `poll --seed` would pass here. Per-subcommand sets would have
//     to model `batch`/`chain` forwarding unknown flags to `generate`, and a
//     miss there produces a false rejection of a command that works — which is
//     the failure mode that gets a gate switched off rather than fixed.
//   - flags in prose in the two core skills and the three standalone tools.
//     Prose is only read in the 14 scenario skills, for the reason set out
//     under collectFlagMentions() — everywhere else it is a false-alarm
//     machine, because those files legitimately quote other tools' flags.
//   - flags in a fenced block that never names `ofox-video.sh` /
//     `ofox-image.sh`. A block is only read as a command once the script is
//     named on a line, and stops being read at the end of that command.
//   - flags in prose outside an inline-code span, or in a span that does not
//     OPEN with one. `` `jq --arg` `` is skipped on purpose; a bare --flag in
//     a sentence is not matched at all.
//   - whether a bin the skill actually needs is MISSING from `requires.bins`.
//     Only the listed-but-unused direction is checked; the other one cannot be
//     decided from a text search without guessing at prose mentions.
//   - `name` matching the directory, `license`, `metadata.author`, the
//     README/skills.sh.json tables. Those are CONTRIBUTING.md rules too; they
//     have not bitten yet, and a rule added before its first defect is a rule
//     with no worked example of what it prevents.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { KEY_LINE, checkFrontmatter, frontmatterEnd } from "./check-frontmatter.mjs";

// Codex truncates a skill description at roughly this many characters when it
// builds its routing table (verified against commit a0ed1f1). It is a WINDOW,
// not a limit: every skill here is over it, the shortest by 174 characters.
// The answer is to put the routing triggers first, not to write a shorter
// description — so this number drives a report, never a failure. See
// reportDescriptions().
const CODEX_DESCRIPTION_WINDOW = 300;

// The two execution-layer skills every scenario skill delegates to, keyed by
// the script filename that appears in the delegating documentation.
const CORES = {
  "ofox-video.sh": "ofox-video-core",
  "ofox-image.sh": "ofox-image-core",
};

// ---------------------------------------------------------------------------
// frontmatter values
//
// check-frontmatter.mjs answers "does this block parse"; it deliberately never
// builds a value tree, and widening it to do so would change what that gate
// is. This reader is the other half: it assumes the block already parses (this
// file refuses to run any rule on a skill where checkFrontmatter() disagrees)
// and returns `{ value, line, column }` per dotted key path, because every
// problem this file reports has to name a line.
//
// Two parsers over one block is a drift risk, so the two things they must
// agree on — where the block ends, and what a `key:` line is — are imported
// from that file rather than restated here.
// ---------------------------------------------------------------------------

function readFrontmatter(skillMdPath) {
  const lines = readFileSync(skillMdPath, "utf8").split("\n");
  const end = frontmatterEnd(lines);
  const out = new Map();
  if (end === -1) return out;

  const stack = []; // open subtrees: [{ indent, key }]
  for (let i = 1; i < end; i++) {
    const m = KEY_LINE.exec(lines[i]);
    if (!m) continue; // list items and continuations: not a key
    const [, indent, key, rest] = m;
    while (stack.length && stack[stack.length - 1].indent >= indent.length) {
      stack.pop();
    }
    const path = [...stack.map((s) => s.key), key].join(".");
    const value = rest.trim();
    if (value === "") {
      stack.push({ indent: indent.length, key });
      continue; // `metadata:` opens a subtree; it has no scalar of its own
    }
    out.set(path, {
      value: unquote(value),
      line: i + 1,
      column: indent.length + key.length + 3,
    });
  }
  return out;
}

const unquote = (v) =>
  (v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
  (v.startsWith("'") && v.endsWith("'") && v.length > 1)
    ? v.slice(1, -1)
    : v;

// `bins: [curl, jq]` — the one flow collection this repo's frontmatter uses.
const flowSeq = (v) =>
  v.startsWith("[") && v.endsWith("]")
    ? v
        .slice(1, -1)
        .split(",")
        .map((s) => unquote(s.trim()))
        .filter(Boolean)
    : null;

// ---------------------------------------------------------------------------
// Rule 1 — every core-script flag the docs quote exists in that script
// ---------------------------------------------------------------------------

// The flags a script accepts, read off its argument parsers rather than off a
// list kept here: a hardcoded copy of a fact you do not own is wrong the day
// the script changes (this repo has five recorded instances of exactly that).
// Every parser in both scripts is a `case` over "$key", so a case pattern in
// flag shape — `--model|--prompt|...)` or `--seed) seed="$val" ;;` — is the
// authoritative list.
export function scriptFlags(scriptPath) {
  const flags = new Set();
  for (const line of readFileSync(scriptPath, "utf8").split("\n")) {
    const m = /^\s*(--[a-z0-9][a-z0-9-]*(?:\|--[a-z0-9][a-z0-9-]*)*)\)/.exec(line);
    if (!m) continue;
    for (const flag of m[1].split("|")) flags.add(flag);
  }
  return flags;
}

// Blank out quoted runs while keeping the line's length, so a flag-looking
// string inside a prompt (`--prompt "shot on a --phone"`) is not read as a
// flag and every column reported below still points at the real character.
//
// Three things it has to get right. Each was a hole when this was a plain
// three-line loop, and each was found by writing the input that should fail
// and watching it pass:
//
//   * `\"` does not close a double-quoted run. Reading it as a close unmasks
//     the rest of the prompt — and `seedance-anime-drama:1109` ships a prompt
//     containing `\"I'm not going back.\"`, so that line was one `--word`
//     away from a false rejection, which is the failure mode that gets a gate
//     switched off rather than fixed.
//   * an apostrophe is not an opening quote. `<the brief's ratio>` masked
//     everything after it to end of line, and the `--out-dir` on
//     `seedance-anime-drama:770` sits after exactly that — one real mention
//     the gate had silently stopped covering, with nothing to show it had.
//     A `'` that never closes on its own line is re-read as an ordinary
//     character.
//   * a double-quoted run may span lines, because a prompt can be written
//     across several. The caller carries the open quote into the next line;
//     without that, the first line of such a prompt ends the command span and
//     every remaining flag of that command goes unchecked.
function maskRun(line, carry, singleQuotes) {
  let out = "";
  let quote = carry;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    // Backslash escapes inside a double-quoted run (and only there — a
    // backslash is literal inside '...'). Two spaces, so columns still line up.
    if (quote === '"' && ch === "\\" && i + 1 < line.length) {
      out += "  ";
      i++;
      continue;
    }
    if (quote) {
      out += ch === quote ? ch : " ";
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || (singleQuotes && ch === "'")) quote = ch;
    out += ch;
  }
  return { out, quote };
}

function maskQuoted(line, carry = null) {
  const first = maskRun(line, carry, true);
  // A `'` still open at end of line was prose, not shell. Re-read the line
  // with `'` demoted to an ordinary character. (A `"` left open is carried
  // instead — that one really does continue onto the next line.)
  return first.quote === "'" ? maskRun(line, carry, false) : first;
}

const FLAG_RE = /(?<![\w-])--[a-z0-9][a-z0-9-]*/g;

// Two contexts, because they carry different risks.
//
// (a) COMMANDS. Inside a fenced code block, a line naming `<core>.sh
//     <subcommand>` starts a command, and the command continues while lines
//     end in a backslash. Every flag in that span belongs to the named script.
//     This is the context that matters most — it is the text an agent copies
//     and runs.
//
// (b) PROSE, and only in the scenario skills. Extracting `--flag` from every
//     SKILL.md indiscriminately yields ~60 distinct flags, most of them other
//     tools' (`jq --arg`, `curl --data-binary`, `npx clawhub --owner`,
//     `hal-vault --reveal`, `cloudflare-drop --ttl`) — a false-alarm machine.
//     But a scenario skill ships no script and talks to nothing except its
//     core, so in those 14 files an inline-code span that OPENS with a flag is
//     a claim about the core's interface. Measured across the repo as it
//     stands: 634 such mentions against 455 inside commands — prose is where
//     most of the surface is — all real, zero false positives. A span that
//     names another tool first — `` `jq --arg` `` — is not matched, which is
//     both the natural way to write it and the escape hatch if one is ever
//     needed here.
//
//     Prose carries no subcommand and no script name, so a prose flag is
//     accepted if ANY core the file mentions has it. A video scenario that
//     points at `ofox-image-core`'s `--target-aspect` for frame preparation is
//     doing something correct, and there is nothing in the sentence to tie the
//     flag to one core or the other.
function collectFlagMentions(text, { cores, prose }) {
  const mentions = [];
  const lines = text.split("\n");
  let inFence = false;
  let command = null;
  let carry = null; // a double-quoted run left open by the line above

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      command = null;
      carry = null;
      continue;
    }

    if (inFence) {
      const { out: masked, quote } = maskQuoted(raw, carry);
      const started = /ofox-(video|image)\.sh\s+[a-z][a-z0-9-]*/.exec(masked);
      if (started) command = `ofox-${started[1]}.sh`;
      if (command) {
        for (const m of masked.matchAll(FLAG_RE)) {
          mentions.push({
            flag: m[0],
            line: i + 1,
            column: m.index + 1,
            raw,
            scripts: [command],
            context: "command",
          });
        }
        // A command ends at the first line that neither continues with a
        // backslash nor leaves a quoted run open.
        carry = quote;
        if (!carry && !/\\\s*$/.test(raw)) command = null;
      }
      if (!command) carry = null;
      continue;
    }
    carry = null;

    if (!prose) continue;
    // A span that OPENS with a flag is a claim about the core's interface, and
    // every flag in that span is part of the same claim — not just the first.
    // Reading only the first left `--size` and `--target-aspect` unchecked in
    // ten places, and invisibly, because an uncounted mention does not move
    // the total this prints on success either.
    for (const span of raw.matchAll(/`(--[a-z0-9][a-z0-9-]*[^`]*)`/g)) {
      for (const m of span[1].matchAll(FLAG_RE)) {
        mentions.push({
          flag: m[0],
          line: i + 1,
          column: span.index + m.index + 2,
          raw,
          scripts: cores,
          context: "prose",
        });
      }
    }
  }
  return mentions;
}

// Returns the problems AND how many mentions were actually compared. The
// count is printed on success on purpose: a gate whose extractor quietly stops
// matching reports the same cheerful "ok" as one that checked everything, and
// the only visible difference is a number nobody was shown.
function checkFlags(skill, flagsByScript) {
  const problems = [];
  let checked = 0;
  const mentions = collectFlagMentions(skill.text, {
    cores: skill.cores,
    prose: skill.isScenario,
  });

  for (const m of mentions) {
    // Fail open when a script it would be checked against is not on disk: a
    // check you could not run is never a reason to block (CONTRIBUTING rule
    // 6). This happens when one skill is installed without its core.
    //
    // EVERY candidate has to be readable, not just one. A prose mention names
    // no script — it is a claim about whichever core the file delegates to —
    // and with one of two cores missing, the remaining core's flags are the
    // only ones left to compare against, so correct documentation reads as
    // broken. Hiding `ofox-video.sh` and re-running is what showed this: 170
    // real, correct mentions were reported as flags `ofox-image.sh` does not
    // accept.
    const known = m.scripts;
    if (known.some((s) => !flagsByScript.has(s))) continue;
    checked++;
    if (known.some((s) => flagsByScript.get(s).has(m.flag))) continue;

    const where = known.join(" or ");
    problems.push({
      rule: "flags",
      line: m.line,
      column: m.column,
      message: `\`${m.flag}\` is not a flag ${where} accepts`,
      excerpt: m.raw.trim().slice(0, 96),
      consequence:
        m.context === "command"
          ? "An agent copies this command verbatim. The script rejects the unknown flag and exits 1 — after the user has approved a cost table for a job that will never be submitted."
          : "This documents an interface the execution layer does not have. The agent builds its command from this table, and the command fails.",
      fix: `run \`grep -n -- '${m.flag}' skills/${CORES[known[0]]}/references/${known[0]}\` — if the flag was renamed, this file was missed by the rename; if it never existed, delete the claim`,
    });
  }
  return { problems, checked };
}

// ---------------------------------------------------------------------------
// Rule 3 — the version is the same in all three places it is written
// ---------------------------------------------------------------------------

// ClawHub's scanner reads the top-level `version`; skills.sh and this repo's
// own docs read `metadata.version`; a human reads the CHANGELOG. Three copies
// of one fact, and nothing until now compared them.
function changelogVersion(changelogPath) {
  let text;
  try {
    text = readFileSync(changelogPath, "utf8");
  } catch {
    return null; // absence is reported by its own rule below
  }
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^##\s+\[?v?(\d+\.\d+\.\d+[^\s\]]*)\]?/.exec(lines[i]);
    if (m) return { version: m[1], line: i + 1 };
  }
  return null;
}

function checkVersions(skill) {
  const problems = [];
  const top = skill.fm.get("version");
  const meta = skill.fm.get("metadata.version");
  const changelog = changelogVersion(join(skill.dir, "CHANGELOG.md"));

  if (!top) {
    problems.push({
      rule: "version",
      line: 1,
      message: "no top-level `version` in the frontmatter",
      consequence:
        "ClawHub's scanner reads the top-level field, not `metadata.version`.",
      fix: "add `version: \"x.y.z\"` next to `license:`",
    });
  }
  if (!meta) {
    problems.push({
      rule: "version",
      line: 1,
      message: "no `metadata.version` in the frontmatter",
      consequence: "skills.sh and this repo's own tooling read that one.",
      fix: "add `version:` under `metadata:`",
    });
  }
  if (top && meta && top.value !== meta.value) {
    problems.push({
      rule: "version",
      line: meta.line,
      column: meta.column,
      message: `\`metadata.version\` is ${meta.value} but the top-level \`version\` is ${top.value} (line ${top.line})`,
      consequence:
        "Different installers read different fields, so the same skill reports two versions depending on where it came from.",
      fix: "make them equal — a version bump has to touch both",
    });
  }
  if (!changelog) {
    problems.push({
      rule: "version",
      line: 1,
      message: "CHANGELOG.md has no `## <version>` heading to compare against",
      consequence:
        "A published change with no changelog entry gives a caller nothing to read when behaviour moves.",
      fix: "add a `## x.y.z — what moved` section at the top",
    });
  } else if (top && changelog.version !== top.value) {
    problems.push({
      rule: "version",
      line: top.line,
      column: top.column,
      message: `frontmatter says ${top.value}, CHANGELOG.md's newest entry says ${changelog.version} (CHANGELOG.md:${changelog.line})`,
      consequence:
        "Either the bump was made without an entry, or the entry was written and the bump forgotten. Both ship a version whose changelog describes a different one.",
      fix: "decide which is right — this check will not guess, because the answer is different each time",
    });
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 4 — homepage, written twice, pointing at this directory
// ---------------------------------------------------------------------------

// ClawHub reads `metadata.openclaw.homepage`; everything else reads the
// top-level `homepage`. A skill copied from a sibling and renamed keeps the
// sibling's URL in whichever of the two the author forgot, and both still
// resolve to a real page — so nothing 404s and the listing quietly points at
// another skill.
function checkHomepage(skill) {
  const problems = [];
  const top = skill.fm.get("homepage");
  const openclaw = skill.fm.get("metadata.openclaw.homepage");

  for (const [key, entry] of [
    ["homepage", top],
    ["metadata.openclaw.homepage", openclaw],
  ]) {
    if (entry) continue;
    problems.push({
      rule: "homepage",
      line: 1,
      message: `no \`${key}\` in the frontmatter`,
      consequence:
        key === "homepage"
          ? "npm and skills.sh have no link back to the source."
          : "ClawHub reads this one specifically, and falls back to nothing.",
      fix: `add \`${key}: https://github.com/ofoxai/skills/tree/main/skills/${skill.name}\``,
    });
  }

  if (top && openclaw && top.value !== openclaw.value) {
    problems.push({
      rule: "homepage",
      line: openclaw.line,
      column: openclaw.column,
      message: "`metadata.openclaw.homepage` differs from the top-level `homepage`",
      excerpt: `${top.value}  vs  ${openclaw.value}`,
      consequence:
        "Two registries link two different places for one skill, and whichever is wrong still resolves, so nothing reports it.",
      fix: "make them identical",
    });
  }

  for (const [key, entry] of [
    ["homepage", top],
    ["metadata.openclaw.homepage", openclaw],
  ]) {
    if (!entry) continue;
    if (entry.value.replace(/\/+$/, "").endsWith(`/${skill.name}`)) continue;
    problems.push({
      rule: "homepage",
      line: entry.line,
      column: entry.column,
      message: `\`${key}\` does not end in /${skill.name}`,
      excerpt: entry.value,
      consequence:
        "The link resolves — to a different skill's page. That is worse than a 404, which someone would report.",
      fix: `end it with /skills/${skill.name}`,
    });
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 5 — every declared bin is one this skill really reaches for
// ---------------------------------------------------------------------------

// `requires.bins` is what an installer uses to tell someone what to install
// before the skill can work. A name that nothing calls sends them to install
// software they do not need; worse, it makes the list look maintained.
//
// The search is deliberately loose — any word-boundary occurrence in the
// skill's own shipped text, or in the script of a core it delegates to
// (CONTRIBUTING.md counts transitive dependencies as the skill's own) — so
// this only ever fires on a name that appears NOWHERE. Something tighter
// would have to decide which mentions are invocations, and a false rejection
// here is worse than the omission it prevents.
const TEXT_FILE = /\.(md|sh|mjs|js|json|txt|html)$/;

// The declaration is not evidence for itself. The first version of this rule
// searched the whole of SKILL.md, frontmatter included, so `bins: [.., sox]`
// matched the word `sox` on its own line and every possible input passed. A
// planted bogus bin is what exposed it — a check that cannot fail is not a
// weak check, it is no check, and it reports "ok" in exactly the voice of one
// that worked.
function withoutFrontmatter(text) {
  const lines = text.split("\n");
  const end = frontmatterEnd(lines);
  return end === -1 ? text : lines.slice(end + 1).join("\n");
}

function skillTextCorpus(skill, skillsDir) {
  const chunks = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (TEXT_FILE.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        chunks.push(path === skill.path ? withoutFrontmatter(text) : text);
      }
    }
  };
  walk(skill.dir);
  for (const script of skill.cores) {
    const core = CORES[script];
    try {
      chunks.push(readFileSync(join(skillsDir, core, "references", script), "utf8"));
    } catch {
      // The core is not installed next to this skill. Fail open.
    }
  }
  return chunks.join("\n");
}

function checkBins(skill, skillsDir) {
  const declared = skill.fm.get("metadata.openclaw.requires.bins");
  if (!declared) return []; // a skill needing no binary declares none
  const bins = flowSeq(declared.value);
  if (!bins) return []; // not the flat `[a, b]` shape this reader understands

  const corpus = skillTextCorpus(skill, skillsDir);
  const problems = [];
  for (const bin of bins) {
    const escaped = bin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(corpus)) continue;
    problems.push({
      rule: "bins",
      line: declared.line,
      column: declared.column,
      message: `\`requires.bins\` lists \`${bin}\`, which appears nowhere in this skill or in the core script it delegates to`,
      excerpt: declared.value,
      consequence:
        "An installer tells the user to install a tool this skill never runs, and the rest of the list stops being trustworthy.",
      fix: `remove \`${bin}\`, or — if it really is needed — the code that needs it is missing`,
    });
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Rule 2 — the description's truncation window (a report, never a failure)
// ---------------------------------------------------------------------------

// The plan this came from said "description <= 300 characters". That is wrong
// and is not implemented: all 19 descriptions here are over it, the shortest
// by 174 characters and the longest by nearly 1100, and they are that long on
// purpose — a description carries the routing triggers and the
// do-not-use-this-for list. ~300 is where Codex CUTS the text it reads, so the
// answer is ordering, not brevity: whatever routes the skill has to be inside
// the window. This prints where each description stands so an author can see
// their own cut point, and never touches the exit code.
function describeDescription(skill) {
  const entry = skill.fm.get("description");
  if (!entry) return null;
  const text = entry.value;
  const triggerAt = text.search(/use (?:when|this when|it when)/i);
  return {
    name: skill.name,
    length: text.length,
    triggerAt,
    insideWindow: triggerAt !== -1 && triggerAt < CODEX_DESCRIPTION_WINDOW,
    before: text.slice(Math.max(0, CODEX_DESCRIPTION_WINDOW - 46), CODEX_DESCRIPTION_WINDOW),
    after: text.slice(CODEX_DESCRIPTION_WINDOW, CODEX_DESCRIPTION_WINDOW + 46),
  };
}

// ---------------------------------------------------------------------------

// Read each core script once; every scenario skill is checked against these.
// A core that is not on disk is not an error — one skill can be installed
// without the other, and rule 1 fails open for anything that needed it. But a
// fail-open that nobody is told about is how a gate goes quiet: rename the
// script and every flag mention in the repo stops being compared, while this
// still prints `ok`. So the absence is returned, and the CLI says it out loud.
export function loadCoreFlags(skillsDir) {
  const flagsByScript = new Map();
  const missing = [];
  for (const [script, core] of Object.entries(CORES)) {
    const path = join(skillsDir, core, "references", script);
    try {
      statSync(path);
      flagsByScript.set(script, scriptFlags(path));
    } catch {
      missing.push(path);
    }
  }
  return { flagsByScript, missing };
}

export function checkSkills(skillsDir) {
  const { flagsByScript } = loadCoreFlags(skillsDir);

  const results = [];
  for (const name of readdirSync(skillsDir).sort()) {
    const dir = join(skillsDir, name);
    const path = join(dir, "SKILL.md");
    try {
      if (!statSync(dir).isDirectory()) continue;
      statSync(path);
    } catch {
      continue; // not a skill directory
    }

    const text = readFileSync(path, "utf8");
    // Frontmatter that does not parse makes every value below a guess, and
    // check-frontmatter.mjs already reports it with a column. Say it is
    // skipped rather than reporting derived nonsense on top of it.
    if (checkFrontmatter(path).length) {
      results.push({ name, path, skipped: true, problems: [], description: null });
      continue;
    }

    // Which cores this file talks about. The script filename is the strong
    // signal; the core's NAME has to count too, because a video scenario
    // routinely points at `ofox-image-core`'s `--target-aspect` when telling
    // someone how to prepare a frame, without ever naming `ofox-image.sh`.
    // Missing that reads a real cross-core mention as an unknown flag — which
    // is exactly what the first run of this checker did, twice.
    const cores = Object.keys(CORES).filter(
      (script) => text.includes(script) || text.includes(CORES[script]),
    );
    // A "scenario skill": ships no script of its own and delegates to a core.
    // Structural, not a hardcoded list of names, so a new one is covered the
    // day it is added.
    const shipsOwnScript = readdirSync(dir, { withFileTypes: true }).some(
      (e) =>
        e.isDirectory() &&
        e.name === "references" &&
        readdirSync(join(dir, "references")).some((f) => /\.(sh|mjs|js)$/.test(f)),
    );
    const skill = {
      name,
      dir,
      path,
      text,
      cores,
      isScenario: cores.length > 0 && !shipsOwnScript,
      fm: readFrontmatter(path),
    };

    const flags = checkFlags(skill, flagsByScript);
    results.push({
      name,
      path,
      skipped: false,
      flagsChecked: flags.checked,
      problems: [
        ...flags.problems,
        ...checkVersions(skill),
        ...checkHomepage(skill),
        ...checkBins(skill, skillsDir),
      ].sort((a, b) => a.line - b.line || (a.column ?? 0) - (b.column ?? 0)),
      description: describeDescription(skill),
    });
  }
  return results;
}

function reportDescriptions(results, { verbose }) {
  const rows = results.map((r) => r.description).filter(Boolean);
  if (!rows.length) return;
  const past = rows.filter((r) => !r.insideWindow);
  const width = Math.max(...rows.map((r) => r.name.length));

  console.log(
    `note  description length vs the ~${CODEX_DESCRIPTION_WINDOW}-character window Codex truncates at.`,
  );
  console.log(
    "      Informational only — this never fails. Long is fine; what matters is that",
  );
  console.log("      the routing trigger lands inside the window.");
  for (const r of rows) {
    const at =
      r.triggerAt === -1
        ? 'no "use when" trigger'
        : `"use when" at ${r.triggerAt}`;
    console.log(
      `      ${String(r.length).padStart(5)}  ${r.name.padEnd(width)}  ${at.padEnd(21)}  ${r.insideWindow ? "inside" : "PAST the window"}`,
    );
    if (verbose && !r.insideWindow) {
      console.log(`             …${r.before}  ✂  ${r.after}…`);
    }
  }
  console.log(
    `      ${past.length} of ${rows.length} put their routing trigger past the window.` +
      (verbose ? "" : "  (--descriptions shows each cut point)"),
  );
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const args = process.argv.slice(2);
  const verbose = args.includes("--descriptions");
  const skillsDir =
    args.find((a) => !a.startsWith("--")) ??
    fileURLToPath(new URL("../skills", import.meta.url));

  const results = checkSkills(skillsDir);
  const broken = results.filter((r) => r.problems.length);
  const skipped = results.filter((r) => r.skipped);

  // Said before the verdict, because it changes what the verdict covers.
  for (const path of loadCoreFlags(skillsDir).missing) {
    console.error(
      `NOTE    ${path} is not here, so nothing was compared against it. Rule 1 is fail-open, and this run's flag total is smaller than it looks.`,
    );
  }

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
  for (const { name } of skipped) {
    console.error(
      `SKIPPED ${name}/SKILL.md  frontmatter does not parse — run check-frontmatter.mjs first; nothing here can be trusted until it does.`,
    );
  }

  reportDescriptions(results, { verbose });

  if (broken.length) {
    const count = broken.reduce((n, r) => n + r.problems.length, 0);
    console.error(
      `\n${count} problem${count === 1 ? "" : "s"} across ${broken.length} of ${results.length} skills.`,
    );
    console.error(
      "Every one of these is a claim the documentation makes that the execution layer does not keep. Fix before publishing.",
    );
    process.exit(1);
  }
  if (skipped.length) process.exit(1);
  const checked = results.reduce((n, r) => n + (r.flagsChecked ?? 0), 0);
  console.log(
    `ok  ${results.length} skills: ${checked} documented flag mentions all exist, versions agree in three places, homepages match, declared bins are real.`,
  );
}
