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

const REPO = "ofoxai/skills";
const argv = process.argv.slice(2);

const HELP = `ofox-skills — install the Ofox agent skills

Usage:
  npx ofox-skills                        install every skill into every agent
  npx ofox-skills <skill-name>           install one skill
  npx ofox-skills doctor                 check which agents can see these skills
  npx ofox-skills [...] --agent <agent>  target specific agents instead

Defaults: every skill, every agent, user-level, no prompts
(\`--skill '*' --agent '*' --global --yes\`). Pass any of those flags yourself
and yours is used instead — \`--agent codex\`, \`--project\`, and so on.

Why every agent by default: \`skills add\` otherwise asks interactively, or —
when an agent is driving — installs only to the agent it detects. Both leave
the other agents on your machine without these skills, and the failure is
silent until something asks for a skill that isn't there.

Why every skill by default: each scenario skill reaches its execution layer
(ofox-video-core, and for seedance-anime-drama also ofox-image-core) by
relative path, which only resolves when they are installed side by side.

Skills in this repo:
  Video    ofox-video-core, seedance-short-drama, seedance-ad-creative,
           seedance-product-video, seedance-anime-drama
  Image    ofox-image-core
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
// missing: which agents can see these? It reads `skills ls -g` rather than
// looking inside ~/.codex/skills, ~/.claude/skills and friends, because the
// CLI already knows where every agent keeps its skills and that list grows
// without us.
if (argv[0] === "doctor") {
  const OURS = [
    "ofox-video-core", "ofox-image-core",
    "seedance-short-drama", "seedance-ad-creative",
    "seedance-product-video", "seedance-anime-drama",
    "hal-vault", "hal-image", "cloudflare-drop",
  ];

  const listed = spawnSync("npx", ["-y", "skills", "ls", "-g"], { encoding: "utf8" });
  if (listed.error) {
    console.error(`ofox-skills: could not run the skills.sh CLI — ${listed.error.message}`);
    console.error(`  Run it directly instead:  npx skills ls -g`);
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

  let missing = 0;
  for (const skill of OURS) {
    const agents = agentsOf(skill);
    if (agents === null) {
      console.log(`  MISSING  ${skill}`);
      missing++;
    } else {
      console.log(`  ok       ${skill}  →  ${agents || "(no agent linked)"}`);
      if (!agents) missing++;
    }
  }

  console.log("");
  if (missing) {
    console.log(`${missing} of ${OURS.length} skills are not installed, or are installed`);
    console.log("without being linked into any agent. Install them all:");
    console.log("  npx ofox-skills");
    process.exit(1);
  }
  console.log(`All ${OURS.length} skills are installed and linked. If an agent still`);
  console.log("cannot see one, restart it — most agents read their skills at startup.");
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
