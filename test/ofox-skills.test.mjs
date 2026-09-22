import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "bin", "ofox-skills.mjs");
const manifest = JSON.parse(readFileSync(join(ROOT, "skills.sh.json"), "utf8"));
const allSkills = manifest.groupings.flatMap(({ skills }) => skills);
const TEMP = mkdtempSync(join(tmpdir(), "ofox-skills-test-"));
after(() => rmSync(TEMP, { recursive: true, force: true }));

test("help derives every published skill from skills.sh.json", () => {
  const output = execFileSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
  const section = output.split("Skills in this repo:\n")[1].split("\n\nEvery Ofox skill")[0];

  for (const { title, skills } of manifest.groupings) {
    assert.match(section, new RegExp("^  " + title + "\\s", "m"));
    for (const skill of skills) {
      assert.equal(
        section.match(new RegExp("\\b" + skill + "\\b", "g"))?.length,
        1,
        skill + " should appear exactly once in the help skill list",
      );
    }
  }
});

test("doctor checks every skill in skills.sh.json", () => {
  const fakeNpx = join(TEMP, "npx");
  const listing = allSkills.map((skill) => skill + " installed\n  Agents: Codex").join("\n");
  writeFileSync(fakeNpx, "#!/bin/sh\ncat <<'EOF'\n" + listing + "\nEOF\n");
  chmodSync(fakeNpx, 0o755);

  const output = execFileSync(process.execPath, [CLI, "doctor"], {
    encoding: "utf8",
    env: { ...process.env, PATH: TEMP + ":" + process.env.PATH },
  });

  assert.match(output, new RegExp("All " + allSkills.length + " skills are installed"));
  for (const skill of allSkills) {
    assert.match(output, new RegExp("ok\\s+" + skill + "\\s"));
  }
});

const makePackageFixture = (manifestContents) => {
  const fixture = mkdtempSync(join(TEMP, "package-"));
  mkdirSync(join(fixture, "bin"));
  cpSync(join(ROOT, "bin"), join(fixture, "bin"), { recursive: true });
  if (manifestContents !== null) {
    writeFileSync(join(fixture, "skills.sh.json"), manifestContents);
  }
  return join(fixture, "bin", "ofox-skills.mjs");
};

test("missing or malformed packaged manifest fails closed with a useful error", () => {
  for (const [label, contents, expected] of [
    ["missing", null, /cannot read packaged skills\.sh\.json/],
    ["invalid JSON", "{", /cannot read packaged skills\.sh\.json/],
    ["empty groupings", '{"groupings":[]}', /must contain a non-empty groupings array/],
    ["missing title", '{"groupings":[{"skills":["one"]}]}', /groupings\[0\] needs a title/],
    ["empty skills", '{"groupings":[{"title":"One","skills":[]}]}', /needs a non-empty skills array/],
    ["invalid skill", '{"groupings":[{"title":"One","skills":[""]}]}', /has an invalid skill name/],
    [
      "duplicate skill",
      '{"groupings":[{"title":"One","skills":["same"]},{"title":"Two","skills":["same"]}]}',
      /lists same more than once/,
    ],
  ]) {
    const result = spawnSync(process.execPath, [makePackageFixture(contents), "--help"], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0, label + " manifest must not run with zero skills");
    assert.match(result.stderr, expected, label + " manifest should explain the package defect");
    assert.doesNotMatch(result.stderr, /\n\s+at /, label + " manifest should not dump a stack trace");
  }
});

test("the actual npm tarball resolves its manifest relative to the installed bin", () => {
  const packDir = mkdtempSync(join(TEMP, "pack-"));
  const packed = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", packDir], {
      cwd: ROOT,
      encoding: "utf8",
    }),
  );
  const tarball = join(packDir, packed[0].filename);
  execFileSync("tar", ["-xzf", tarball, "-C", packDir]);

  const installedCli = join(packDir, "package", "bin", "ofox-skills.mjs");
  const output = execFileSync(process.execPath, [installedCli, "--help"], { encoding: "utf8" });
  assert.match(output, /\bprevis-rerender\b/);
  assert.match(output, /\bofox-video-core\b/);
  assert.equal(JSON.parse(readFileSync(join(packDir, "package", "package.json"))).version, "2.1.1");

  const fakeBin = join(packDir, "fake-bin");
  const argsLog = join(packDir, "npx-args.txt");
  mkdirSync(fakeBin);
  const fakeNpx = join(fakeBin, "npx");
  writeFileSync(fakeNpx, '#!/bin/sh\nprintf "%s\\n" "$@" > "$OFOX_SKILLS_TEST_ARGS"\n');
  chmodSync(fakeNpx, 0o755);
  execFileSync(process.execPath, [installedCli, "--project"], {
    cwd: packDir,
    env: {
      ...process.env,
      OFOX_SKILLS_TEST_ARGS: argsLog,
      PATH: fakeBin + ":" + process.env.PATH,
    },
  });
  const forwarded = readFileSync(argsLog, "utf8").trim().split("\n");
  assert.deepEqual(forwarded.slice(0, 4), ["-y", "skills", "add", "ofoxai/skills"]);
  assert.deepEqual(forwarded.slice(4, 6), ["--skill", allSkills[0]]);
  assert.deepEqual(forwarded.slice(5, 5 + allSkills.length), allSkills);
  assert.equal(
    forwarded.filter((arg) => arg === "*").length,
    1,
    "only --agent may use a wildcard; skill selection must name the public manifest entries",
  );
  assert.ok(forwarded.includes("--project"));
});
