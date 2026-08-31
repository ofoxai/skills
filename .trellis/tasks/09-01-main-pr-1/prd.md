# 把 main 合并进分支解开 PR #1 的结构性冲突

## Goal

PR #1 报 `mergeable=CONFLICTING`，挡住了后续的发布链路。冲突是**结构性**的
（两条历史各自碰了同一批文件），不是语义性的——已实测确认 main 上没有任何
分支缺少的内容。目标是记录合并关系、消除冲突，且**一行内容都不丢、一行旧文本都不回流**。

## What I already know

### main 那两个提交的来历

* `70631fb`（8-31 01:47）+ `0e845c7`（8-31 15:03），作者均为 yunshen，
  邮箱是 GitHub 的 `...@users.noreply.github.com` —— **网页端/API 签名**，
  本地提交用的是 `lishuo@ofoxai.com`。
* 仓库只有 PR #1 且未合并 → 这两个提交**不是合并 PR 产生的，是直接推到 main 的**。

### 内容关系：main 是本分支的旧快照

逐 blob 比对确认：main 上的 `ofox-video-core/references/ofox-video.sh`
与分支提交 `faceedf` 的版本**逐字节相同**；`skills/` 全目录一致。

```
分支:  ... → faceedf → [15 个代码提交] → f314796 (HEAD)
                ↓ 网页端上传（squash 成 2 个提交）
main:  70631fb → 0e845c7        ← 内容 == 分支@faceedf
```

### 「main 独有」的 116 行逐条查过，全是被分支主动替换的旧文本

| 行段 | 旧文本 | 分支的处置 |
|---|---|---|
| 5 | `  ofox-image.sh models`（漏 `#`） | 已修，就是那个每次调用都吐 command not found 的 bug |
| 10–52 | "费率有歧义，不要计算成本" | 被账单实测公式取代 |
| 53–56, 82, 105… | `$0.xx` 价格 | 被 `64 cents` 等写法取代（参数插值问题） |
| 57–70 | 不含 `--name` 的旧签名 | 已更新 |
| 71–77 | `elapsed=$((elapsed + poll_interval))` | 被墙钟计时取代 |
| 78–81 | `fname="${job_id}"`、无超时 curl | 被命名方案与超时取代 |
| 83–116 | "filename is a bare job id" | 四个场景 skill 均已更新 |
| 86–93 | 旧 Step 1「设定集」 | 被设定集/首帧拆分取代 |

根目录 5 个双改文件（`.env.example` / `.gitignore` / `CONTRIBUTING.md` /
`README.md` / `skills.sh.json`）：main **独有 0 行**，唯一差异是分支的
`CONTRIBUTING.md` 多 9 行（`$0` 约束）。

### main 还缺分支的 `.claude/` 工具链与 AGENTS.md（42 文件 5614 行）

**这一项归属未定**——是有意不放进公开仓库，还是那次网页上传漏了，用户尚未回答。
不影响本次合并（合并 main 进分支不会动分支已有的这些文件），但**会影响 PR 最终合并时
落到 main 上的内容**，需在合并 PR 前确认。

## Requirements

* 用 `git merge -s ours origin/main` —— 记录合并关系、完整保留分支树
* **不用 `-X ours`**：它只在冲突块取我方，非冲突块仍会自动吸收 main 的改动，
  存在把上面那 116 行旧文本重新引入的风险
* 合并提交信息写清为何 `-s ours` 是安全的（依据即上述实测）
* 合并后分支的工作树内容必须与合并前**完全一致**（零字节变化）
* 合并后 PR #1 的 `mergeable` 必须变为可合并
* 既有测试套件不得回归

## Acceptance Criteria

* [x] `git diff` 合并前后 HEAD 的工作树差异为空（除新增的 merge commit 本身）
* [x] `git merge-base --is-ancestor origin/main HEAD` 成立（main 成为祖先）
* [x] `gh pr view 1` 的 `mergeable` 不再是 `CONFLICTING`
* [x] 12 个测试文件在 `/bin/bash` 3.2 下仍全绿
* [x] `grep` 抽查：那 116 行旧文本没有任何一行回流到工作树

## Verification

* 树指纹 `f9798bb` 合并前后**完全相同** —— 零字节变化，`-s ours` 如预期只记录关系
* `git merge-base --is-ancestor origin/main HEAD` 成立
* 那 116 行旧文本**回流 0 行**；抽查两个代表性旧 bug（漏 `#`、旧 elapsed 累加）均未复活
* 12 个测试文件在 `/bin/bash` 3.2 下通过 250 项、失败 0
* PR #1 的 mergeable 状态见下（推送后核验）

## Definition of Done

* 上述 AC 实测通过
* `.claude/` 归属问题已向用户提出（不在本任务内解决）

## Technical Approach

```bash
git merge -s ours origin/main -m "<说明>"
```

`-s ours` 是合并**策略**（保留我方整棵树），区别于 `-X ours` 这个
递归策略的**选项**（仅冲突块取我方）。选前者的依据是已实测确认
main 无独有内容——若该前提不成立，这个策略就会丢东西，所以验证必须先做。

## Out of Scope

* 合并 PR #1 本身（需先解决 `.claude/` 归属）
* 决定 `.claude/` 与 AGENTS.md 是否进公开仓库（用户决策）
* 发布/目录收录链路（依赖 ofox 站内页，不在本仓库）
* 追究那两个提交为何绕过 PR 直推 main

## Technical Notes

* 验证方法：把 `skills/` 全文拼成语料，用 `grep -vxF -f` 批量筛出
  「main 新增且分支侧完全不存在」的行——逐行 `grep -r` 会超时
* `-s ours` 与 `-s theirs` 不对称：git 只提供前者
