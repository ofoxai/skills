#!/usr/bin/env node
// Thin forwarder to the skills.sh CLI, which is what actually installs these
// skills. This package exists so `npx ofox-skills` works and so the repo is
// findable on npm; it deliberately does NOT reimplement the installer.
//
// It does supply defaults, which is a different thing. `skills add` without
// `--agent` picks agents interactively when a human runs it, and silently
// installs to only the *detected* agent when an agent runs it — so what you
// end up with depends on which terminal you happened to be in. That is how a
// machine ends up with these skills visible in Claude Code and missing in
// Codex. Every skill, every agent, user-level, is the only combination that
// makes the cross-skill relative paths resolve, so that is what this defaults
// to. Any flag you pass wins; pass `--agent codex` and you get exactly that.
//
// Whatever skills.sh does, this script does — including its exit code. If the
// CLI is unreachable, that is reported as-is rather than papered over with a
// fallback that would silently install nothing.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkAll } from "./check-frontmatter.mjs";

const REPO = "ofoxai/skills";
const argv = process.argv.slice(2);

const HELP = `ofox-skills — install the Ofox agent skills

Usage:
  npx ofox-skills                        install every skill into every agent
  npx ofox-skills <skill-name>           install one skill
  npx ofox-skills doctor                 check which agents can see these skills
  npx ofox-skills doctor --project       ...checking this project instead of global
  npx ofox-skills [...] --agent <agent>  target specific agents instead

Defaults: every skill, every agent, user-level, no prompts
(\`--skill '*' --agent '*' --global --yes\`). Pass any of those flags yourself
and yours is used instead — \`--agent codex\`, \`--project\`, and so on.

Why every agent by default: \`skills add\` otherwise asks interactively, or —
when an agent is driving — installs only to the agent it detects. Both leave
the other agents on your machine without these skills, and the failure is
silent until something asks for a skill that isn't there.

Why every skill by default: each scenario skill reaches its execution layer by
relative path, which only resolves when they are installed side by side — the
video scenarios need ofox-video-core, image-edit and product-image need
ofox-image-core, and seedance-anime-drama needs both.

Skills in this repo:
  Video    ofox-video-core, seedance-short-drama, seedance-ad-creative,
           seedance-product-video, seedance-anime-drama, keyframe-animation,
           product-demo, video-extend-edit, ugc-ads, shorts-reels,
           talking-head, explainer, music-video
  Image    ofox-image-core, image-edit, product-image
  Secrets  hal-vault
  Media    hal-image
  Deploy   cloudflare-drop

Every Ofox skill needs OFOX_API_KEY: https://app.ofox.ai (Settings -> API Keys)
Docs: https://github.com/ofoxai/skills#readme`;

if (argv[0] === "--help" || argv[0] === "-h") {
  console.log(HELP);
  process.exit(0);
}

const run = (args) => spawnSync("npx", ["-y", "skills", ...args], { stdio: "inherit" });

const bail = (result, suggestion) => {
  if (result.error) {
    console.error(`ofox-skills: could not run the skills.sh CLI — ${result.error.message}`);
    console.error(`  Run it directly instead:  npx skills ${suggestion}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
};

// `doctor` answers the one question people actually ask when a skill is
// missing: which agents can see these? It reads `skills ls` rather than
// looking inside ~/.codex/skills, ~/.claude/skills and friends, because the
// CLI already knows where every agent keeps its skills and that list grows
// without us.
//
// Scope is stated in the output and never guessed at. `skills ls` reports one
// scope at a time, so a doctor that silently picked global would cheerfully
// print "all of them installed" to someone standing in a project that has
// none — which is the one situation this command exists to catch. (The count
// in that message comes from OURS.length, never from a number typed here:
// a hardcoded total goes stale the next time a skill is added.)
if (argv[0] === "doctor") {
  const OURS = [
    "ofox-video-core", "ofox-image-core",
    "seedance-short-drama", "seedance-ad-creative",
    "seedance-product-video", "seedance-anime-drama",
    "keyframe-animation", "product-demo",
    "video-extend-edit", "ugc-ads", "shorts-reels",
    "talking-head", "explainer", "music-video",
    "image-edit", "product-image",
    "hal-vault", "hal-image", "cloudflare-drop",
  ];

  const wantsProject = argv.includes("-p") || argv.includes("--project");
  const scopeFlag = wantsProject ? "-p" : "-g";
  const scopeName = wantsProject ? "this project" : "user-level (global)";
  const scopePossessive = wantsProject ? "this project's" : "your user-level (global)";

  console.log(`Checking ${scopePossessive} skills.`);
  if (!wantsProject) {
    console.log("For a project-scoped install, run:  npx ofox-skills doctor --project");
  }
  console.log("");

  const listed = spawnSync("npx", ["-y", "skills", "ls", scopeFlag], { encoding: "utf8" });
  if (listed.error) {
    console.error(`ofox-skills: could not run the skills.sh CLI — ${listed.error.message}`);
    console.error(`  Run it directly instead:  npx skills ls ${scopeFlag}`);
    process.exit(1);
  }

  // Strip ANSI so the agent names survive; `skills ls -g` prints an
  // "Agents: ..." line under each skill it knows about.
  const plain = (listed.stdout ?? "").replace(/\[[0-9;]*[a-zA-Z]/g, "");
  const lines = plain.split("\n");
  const agentsOf = (skill) => {
    const at = lines.findIndex((l) => new RegExp(`^\\s*${skill}\\s`).test(l));
    if (at === -1) return null;
    const found = lines.slice(at + 1, at + 3).find((l) => l.includes("Agents:"));
    return found ? found.split("Agents:")[1].split("Source:")[0].trim() : "";
  };

  // A skill whose frontmatter does not parse is SKIPPED by the installer
  // without an error, so it shows up here as plain MISSING and reinstalling
  // does nothing — which is exactly how `ugc-ads` stayed uninstallable for two
  // release rounds. Separate the two, so "run the installer again" is never
  // the advice for a skill the installer is refusing to read.
  const unparseable = new Map();
  try {
    for (const { name, problems } of checkAll(
      fileURLToPath(new URL("../skills", import.meta.url)),
    )) {
      if (problems.length) unparseable.set(name, problems[0]);
    }
  } catch {
    // Reading our own copy is a nicety; never let it break the real check.
  }

  let missing = 0;
  let broken = 0;
  for (const skill of OURS) {
    const agents = agentsOf(skill);
    const bad = unparseable.get(skill);
    if (bad) {
      console.log(`  BROKEN   ${skill}  →  frontmatter does not parse (${bad.message})`);
      broken++;
    } else if (agents === null) {
      console.log(`  MISSING  ${skill}`);
      missing++;
    } else {
      console.log(`  ok       ${skill}  →  ${agents || "(no agent linked)"}`);
      if (!agents) missing++;
    }
  }

  console.log("");
  if (broken) {
    console.log(`${broken} of ${OURS.length} skills have frontmatter that will not parse.`);
    console.log("The installer skips those silently, so reinstalling will not help —");
    console.log("they have to be fixed at the source. For the file and column:");
    console.log("  node bin/check-frontmatter.mjs");
    console.log("");
  }
  if (missing) {
    console.log(`${missing} of ${OURS.length} skills are missing from ${scopeName}, or are`);
    console.log("installed there without being linked into any agent. Install them all:");
    console.log(`  npx ofox-skills${wantsProject ? " --project" : ""}`);
  }
  if (missing || broken) process.exit(1);
  console.log(`All ${OURS.length} skills are installed and linked in ${scopeName}. If an`);
  console.log("agent still cannot see one, restart it — most read their skills at startup.");
  process.exit(0);
}

// A leading non-flag argument names a single skill; otherwise install them all.
const [first] = argv;
const wantsOneSkill = first !== undefined && !first.startsWith("-");
const target = wantsOneSkill ? `${REPO}@${first}` : REPO;
const passthrough = wantsOneSkill ? argv.slice(1) : argv;

// Defaults, each dropped the moment the caller expresses an opinion about it.
const has = (...flags) => flags.some((f) => passthrough.includes(f));
const defaults = [];
if (!wantsOneSkill && !has("-s", "--skill")) defaults.push("--skill", "*");
if (!has("-a", "--agent")) defaults.push("--agent", "*");
if (!has("-g", "--global", "-p", "--project")) defaults.push("--global");
if (!has("-y", "--yes")) defaults.push("--yes");

bail(
  run(["add", target, ...defaults, ...passthrough]),
  `add ${target} ${defaults.join(" ")}`.trim(),
);
