#!/usr/bin/env node
// Thin forwarder to the skills.sh CLI, which is what actually installs these
// skills. This package exists so `npx ofox-skills` works and so the repo is
// findable on npm; it deliberately does NOT reimplement the installer.
//
// Whatever skills.sh does, this script does — including its exit code. If the
// CLI is unreachable, that is reported as-is rather than papered over with a
// fallback that would silently install nothing.

import { spawnSync } from "node:child_process";

const REPO = "ofoxai/skills";
const argv = process.argv.slice(2);

if (argv[0] === "--help" || argv[0] === "-h") {
  console.log(`ofox-skills — install the Ofox agent skills

Usage:
  npx ofox-skills                        install every skill in ${REPO}
  npx ofox-skills <skill-name>           install one skill
  npx ofox-skills [...] --agent <agent>  target a specific agent

Any flag is passed straight through to the skills.sh CLI, so its own options
(--agent claude-code | codex | opencode | '*', etc.) all work here.

For the seedance-* skills, install the whole repo rather than a single skill:
each scenario skill reaches its execution layer (ofox-video-core, and for
seedance-anime-drama also ofox-image-core) by relative path, which only
resolves when both are installed side by side.

Skills in this repo:
  Video    ofox-video-core, seedance-short-drama, seedance-ad-creative,
           seedance-product-video, seedance-anime-drama
  Image    ofox-image-core
  Secrets  hal-vault
  Media    hal-image
  Deploy   cloudflare-drop

Every Ofox skill needs OFOX_API_KEY: https://app.ofox.ai (Settings -> API Keys)
Docs: https://github.com/ofoxai/skills#readme`);
  process.exit(0);
}

// A leading non-flag argument names a single skill; otherwise install them all.
const [first] = argv;
const wantsOneSkill = first !== undefined && !first.startsWith("-");
const target = wantsOneSkill ? `${REPO}@${first}` : REPO;
const passthrough = wantsOneSkill ? argv.slice(1) : argv;

const result = spawnSync(
  "npx",
  ["-y", "skills", "add", target, ...passthrough],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`ofox-skills: could not run the skills.sh CLI — ${result.error.message}`);
  console.error(`  Install directly instead:  npx skills add ${target}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
