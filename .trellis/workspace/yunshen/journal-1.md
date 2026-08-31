# Journal - yunshen (Part 1)

> AI development session journal
> Started: 2026-08-29

---



## Session 1: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills

**Date**: 2026-08-29
**Task**: Build ofox-video-core, seedance-short-drama, seedance-ad-creative skills
**Branch**: `main`

### Summary

Shipped v1 of the Seedance 2.5 execution-layer skills: ofox-video-core (shared script wrapping the Ofox video API: create/poll/download/cost report, no-resubmit-on-timeout rule) plus two scenario skills (seedance-short-drama, seedance-ad-creative) that delegate to it. Real paid end-to-end tests ($1.32 total) confirmed the pipeline and caught a real bug: completed jobs don't reliably include mirror_urls, only unsigned_urls -- fixed with a fallback and captured in a new .trellis/spec/skills/ layer for future scenario skills.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e834198` | (see git log) |
| `a968012` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Fix ofox-video-core VIDEO_PATH to always be absolute

**Date**: 2026-08-29
**Task**: Fix ofox-video-core VIDEO_PATH to always be absolute
**Branch**: `main`

### Summary

Real end-to-end testing surfaced a UX gap: a relative --out-dir made the printed VIDEO_PATH ambiguous, and the calling agent could report a path the user couldn't reliably locate. Fixed by resolving out_dir to an absolute path in poll_and_download() (new exit code 6 for an uncreatable/unwritable out-dir), added a standalone-VIDEO_PATH-line reporting requirement to ofox-video-core's SKILL.md, and generalized the lesson into .trellis/spec/skills/index.md's Quality Check for future scenario skills.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f25a1e1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: Add seedance-product-video; fix Seedance 2.5 image-to-video

**Date**: 2026-08-29
**Task**: Add seedance-product-video; fix Seedance 2.5 image-to-video
**Branch**: `main`

### Summary

Built seedance-product-video (e-commerce catalog videos). Real paid debugging (~$6 total across this and a scope-violating fork) uncovered the actual root cause of a Seedance 2.5 image-to-video failure that also affected the already-shipped seedance-ad-creative: the model requires aspect_ratio=adaptive when an image is attached, undocumented and outside the parameter's normal value list. Fixed ofox-video-core to auto-correct with a visible notice, added local-file-to-base64 support (remote URLs proved unreliable), surfaced previously-swallowed upstream error messages, and mapped a new output_moderation_failed error code. Corrected seedance-ad-creative's now-stale examples. Captured the general lesson in .trellis/spec/skills/external-api-integration.md. Also: a forked subagent exceeded its scope and made an unauthorized real paid API call mid-investigation -- flagged to the user immediately and filed as product feedback.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e38918f` | (see git log) |
| `f552e4e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Add ofox-image-core (text-to-image execution layer)

**Date**: 2026-08-29
**Task**: Add ofox-image-core (text-to-image execution layer)
**Branch**: `main`

### Summary

Built ofox-image-core, the shared execution layer for Ofox's synchronous image-generation API (POST /v1/images/generations), scoped to text-to-image only for now -- the prerequisite for a future seedance-anime-drama task. Two real, user-approved paid calls found two more real bugs: (1) google/gemini-3.1-flash-image's response claims the requested size but actually always returns 1024x1024 -- the field can't be trusted; (2) the earlier-documented 'confirmed' error code (provider_type_unavailable) was never actually observed, just inferred from doc prose -- the real error shape is {error:{message,type,code}} with code as a bare HTTP status number and type as the real classifier. Both findings corrected in the skill's docs and in .trellis/spec/skills/external-api-integration.md. Real image-to-image (input_references) and video-to-video remain untested, deferred until a scenario actually needs them.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6e76c8b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Add seedance-anime-drama (image+video orchestration); fix ARG_MAX bug

**Date**: 2026-08-30
**Task**: Add seedance-anime-drama (image+video orchestration); fix ARG_MAX bug
**Branch**: `main`

### Summary

Shipped seedance-anime-drama, the first scenario skill to orchestrate two execution-layer skills: ofox-image-core generates one character reference image, then ofox-video-core reuses that exact image as --frame-first-image across every shot for real visual consistency. Real two-step paid test (image + video) succeeded end-to-end. Along the way, real testing found ofox-video-core's local-file image support was silently broken for any real photo over ~750KB since it launched: base64-encoding a large local file and passing it via jq --arg/--argjson (and even the final curl -d) hits the OS's ARG_MAX (1MB), producing 'Argument list too long' before any network call. Fixed by routing all three call sites through temp files (jq --rawfile/--slurpfile, curl --data-binary @file). Also found the earlier 'Nano Banana 2 always outputs 1024x1024' claim doesn't generalize -- a second real test produced 1408x768 -- output size is genuinely unpredictable, not a fixed fallback.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e88e2fa` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: Phase A: ClawHub metadata, per-agent install commands, upstream compatibility

**Date**: 2026-08-30
**Task**: Phase A: ClawHub metadata, per-agent install commands, upstream compatibility
**Branch**: `main`

### Summary

Closed a gap-analysis finding against the source plan: none of the 9 shipped skills declared metadata.openclaw.requires (env/bins) or homepage, which ClawHub's automated scan explicitly checks for -- would have failed as 'metadata mismatch' on any real publish attempt. Added accurate requires.env/bins (traced through each skill's actual delegation chain, not copy-pasted) and homepage to all 9 SKILL.md files, retrofit the 3 pre-existing skills with homepage only, updated CONTRIBUTING.md's template so this doesn't regress, rewrote README's Install section with the --agent claude-code/codex/opencode/'*' pattern (independently verified against the real installed skills CLI, not just inherited from the doc), and added an upstream-compatibility note to ofox-video-core naming the popular prompt-writing 'director' skills it complements. Pure documentation -- no scripts touched, no external action taken (no push, no publish, no PRs to third-party repos).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0fb1089` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Close §5.5 test-matrix gap for 4 scenario skills

**Date**: 2026-08-30
**Task**: Close §5.5 test-matrix gap for 4 scenario skills
**Branch**: `feat/seedance-video-skills`

### Summary

Verified the 3 previously-unexercised §5.5 test items (bad-param errors, jq-less install prompt via a PATH sandbox since Docker wasn't running, and a live Codex CLI cross-agent run of seedance-short-drama triggered by natural language with no OFOX_API_KEY set) for ofox-video-core and ofox-image-core, which both scenario-skill families delegate to. All cases passed cleanly on first try -- no bugs found, no script changes needed. Also ran one extra real API call (user-approved, confirmed $0 cost) with a nonexistent model name to verify the model_not_found error-code mapping matches real server behavior. OpenCode left as a documented known gap (not installed locally). npm packaging and the four-directory publish stay deferred per the existing V1 scope decision -- this closes the doc's own §5.5 quality bar for the 4 already-shipped skills without expanding scope.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0e33ce8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Install OpenCode CLI, close last §5.5 cross-agent test gap

**Date**: 2026-08-30
**Task**: Install OpenCode CLI, close last §5.5 cross-agent test gap
**Branch**: `feat/seedance-video-skills`

### Summary

Installed OpenCode CLI (pnpm add -g opencode-ai, manual postinstall since pnpm blocks postinstall scripts by default) and verified seedance-short-drama + ofox-video-core work correctly under it. Key finding: OpenCode discovers skills from ~/.claude/skills/ (and ~/.agents/skills/, project-local .claude/skills/), confirmed via 'opencode debug skill' -- no OpenCode-specific install location needed. Symlinked both skills there; 'opencode run' with no OFOX_API_KEY set correctly loaded both SKILL.md files via natural-language trigger, read pricing.md, ran the check subcommand, computed the same $3.60 cost estimate Codex CLI produced independently, and stopped cleanly asking for the missing key and script text -- $0 cost, no real API call. This closes the last open item from the prior MVP test-coverage task: all 3 target agents (Claude Code, Codex CLI, OpenCode) are now verified for the 4 shipped scenario skills, with zero bugs found across both sessions.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d1e6a08` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: Scaffold awesome-seedance-2.5 collection repo (local-only)

**Date**: 2026-08-30
**Task**: Scaffold awesome-seedance-2.5 collection repo (local-only)
**Branch**: `feat/seedance-video-skills`

### Summary

Built the second of the two planned repo types from the source task doc -- a case/prompt showcase repo distinct from the already-shipped ofoxai/skills execution-layer repo. Corrected a brainstorm misfire mid-task: initially assumed 'the other repo' meant the minor ofox-media-skills-cli npm installer mentioned in doc §5.2, but the user clarified it meant the doc's actual second top-level repo type (§1/§3.1), the awesome-seedance-2.5 collection repo -- scrapped the wrong task and restarted on the right one. Created a new sibling repo at ~/code/awesome-seedance-2.5 with its own standalone PRD.md (kept separate from this repo's trellis task per explicit user instruction, so the two projects' planning docs don't mix), then scaffolded via trellis-implement/trellis-check sub-agents: tri-lingual README (en/zh-CN/ja) with the full doc-specified case-collection layout, CC0 LICENSE, CONTRIBUTING.md, CASE_TEMPLATE.md, images/ convention doc. Zero real cases this round (need the user's own Ofox playground runs first). The check pass found and fixed one real defect: 4 links pointed at the bare ofox.ai homepage, violating the source doc's own link policy (homepage linked exactly once, from the org profile README, never from this repo) -- repointed to the case-backlink target instead. Repo is committed locally but deliberately NOT pushed and NOT created on GitHub -- the source doc explicitly gates publishing this repo on an ofox.ai site page (seedance-2-5-prompts) that doesn't exist yet. One trellis-implement sub-agent run failed mid-task on an unrelated API-level content-filtering error before producing any files; a clean retry succeeded fully.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `36a071b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Harden and re-test shipped skills (publish gate, quality, gacha)

**Date**: 2026-08-30
**Task**: 08-30-harden-and-re-test-shipped-skills-publish-gate-quality-polish-differentiator-features
**Branch**: `feat/seedance-video-skills`

### Summary

Audited the 9 shipped skills against the source plan and found the repo was in
better shape than expected on process (frontmatter, §5.5 coverage, shellcheck)
and worse than expected on substance: four real defects, all from the same root
cause of hardcoding an external API's valid values. Three in ofox-video.sh
(aspect ratios that no model accepts passing local validation; duration checked
for exactly one of eight models; a resolution list wrong in both directions),
one in ofox-image.sh (a hardcoded three-model list that locally rejected the
eleven other models the API serves).

The unlock was discovering GET /v1/models is public, keyless and free — each
video model publishes its real limits in a video_attributes object. Validation
is now driven by it, with a cache/live/stale/snapshot/fail-open ladder where
every fallback is announced. Also built stage 2 of the gacha chain: batch
--takes N with real per-take billing from usage.video_cost, a stop-on-first-
failure rule so a broken run can't burn the remaining takes, and an ffmpeg-only
contact sheet (tile/vstack filters — no ImageMagick dependency).

Three of the plan doc's publish-gate items turned out not to exist: ClawHub's
format defines neither _meta.json nor llms-install.md, and skills.sh's schema
has no package.json field. Dropped with evidence rather than built. The three
frontmatter fields ClawHub actually reads were all missing, and are now added.

### Main Changes

| Area | Change |
|---|---|
| `ofox-video-core` | v1.2.0 per-model validation + `models`; v1.3.0 `batch`/`contact-sheet` |
| `ofox-image-core` | v1.1.0 dynamic model check, 14 models usable instead of 3 |
| All 9 skills | ClawHub frontmatter (top-level version, openclaw.homepage, envVars) |
| `cloudflare-drop` | v2.2.0 Chinese countdown copy → English (CONTRIBUTING rule 1) |
| Standards | CONTRIBUTING + spec updated; CHANGELOG for all 9 skills |
| Spec | Model-endpoint pattern + 4 new gotchas in external-api-integration.md |

### Git Commits

| Hash | Message |
|---|---|
| `32cc769` | fix(ofox-video-core): validate parameters per model |
| `133fade` | fix(ofox-image-core): check --model against the live model list |
| `d2827b7` | feat(skills): declare the frontmatter fields ClawHub actually reads |
| `5888358` | fix(cloudflare-drop): render countdown copy in English |
| `d3d9552` | docs(skills): CHANGELOG for every skill + standards |
| `36d68e7` | docs(ofox): bring reference docs in line with per-model validation |
| `e995ffb` | feat(ofox-video-core): batch takes with real billing + contact sheet |
| `6cd6287` | docs(spec): record the model-endpoint pattern and four gotchas |

### Testing

- [OK] ofox-video-core validation: 36/36
- [OK] ofox-video-core batch: 21/21
- [OK] ofox-image-core validation: 18/18
- [OK] cloudflare-drop: 57/57
- [OK] shellcheck -S warning: zero warnings across all scripts and tests
- [OK] zero CJK under skills/; README + skills.sh.json in sync; 9/9 frontmatter
- [OK] clawhub skill publish --dry-run: ok on all 7 tried
- [OK] Live paid: 3 takes, $0.24 billed, matched the estimate exactly. That run
      also exercised the no-resubmit rule for real (two curl 35 poll failures,
      script retried the poll, never the create).

### Status

[OK] **Completed** (stages 1 and 2; stage 3 deliberately deferred)

### Next Steps

- Stage 3: multi-model fallback (`--fallback-models`) as its own task — it
  touches the no-resubmit rule and deserves isolated testing
- Four-directory publish is still blocked on the same prerequisite as before:
  nothing is pushed. `feat/seedance-video-skills` now carries 10+ commits
  unmerged to main.


## Session 10: 让产物可辨认、可复现、可信任：命名、seed、成本与四个使用中暴露的缺陷

**Date**: 2026-08-31
**Task**: 让产物可辨认、可复现、可信任：命名、seed、成本与四个使用中暴露的缺陷
**Branch**: `feat/seedance-video-skills`

### Summary

本轮全部问题来自真实使用，没有一个是读代码读出来的。

1) 命名与 sidecar：下载文件名从裸 job id 改为 <slug>-<短id>，slug 取自 --name 或 job 自带的 prompt（所以裸跑 poll 也不退化）。API 无 list 接口，短 id 不可反查，故用同名 .json sidecar 承载完整 job id、prompt 与真实花费。

2) 可复现：seed 此前从不落盘（服务端选、响应不回传），create+poll 两进程间 request 也会丢。改为客户端 roll seed 并输出，create 把 payload 留在 out-dir 的点文件里交给 poll。

3) 图片成本：用户从 app.ofox.ai 提供的账单 0.06723950 与 input*pricing.input + output*pricing.output_image 逐位吻合，坐实了此前 20 倍歧义——图片 output tokens 全按 output_image 计。ofox-image-core 现在输出 IMAGE_COST。实现中发现 /v1/models 与 /v2/catalog 对同一费率用不同键名（prompt/completion vs input/output）。

4) 四个使用缺陷：设定集被当首帧（skill 指引本身有问题）、/bin/zsh.xx 被参数插值吃掉 9 处、计费请求全无超时（--max-wait 因此可被静默突破）、旧冗余文件。

5) 测试补齐时逮到两个崩溃：bash 3.2 下展开空数组会终止脚本——sidecar 全失败时会在付费下载后崩溃、成本永不报出（我引入的）；chain 仅传 --shot 时同样崩溃（既有）。

方法论教训：两次误判 bug 未修好，一次因为在 zsh 下 source 了 bash 脚本，一次因为把「文件不存在」当成「被删除」而没先断言它存在过。测试现在全部带前置断言，并在 macOS 默认 /bin/bash 3.2 下运行。

验证：12 个测试文件 248 项断言全过；真实付费 3 条视频 + 2 张图，合计约 3.21 美元。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8ebe485` | (see git log) |
| `256c85d` | (see git log) |
| `b5c5036` | (see git log) |
| `a45cb5a` | (see git log) |
| `830ebb8` | (see git log) |
| `4971301` | (see git log) |
| `e8b5edc` | (see git log) |
| `b68d5bf` | (see git log) |
| `298c622` | (see git log) |
| `0bee796` | (see git log) |
| `a3fc11a` | (see git log) |
| `5d761f6` | (see git log) |
| `5b8029e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
