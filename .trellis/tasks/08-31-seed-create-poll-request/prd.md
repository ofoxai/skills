# 让同一条片子可以重渲：seed 与 create+poll 路径的 request 丢失

## Goal

上一个任务给产物加了 sidecar，卖点之一是"这条换 1080p 重渲"。实际用下来发现**做不到**，
两个独立缺口叠加：

1. **seed 从不落盘**。不传 `--seed` 时脚本不生成 seed，服务端自己选一个且**不在响应里回传**
   （实测响应字段只有 `id / status / model / prompt / unsigned_urls / usage / created_at /
   updated_at`）。同样的 prompt 再跑一次就是重新掷骰子。
2. **`request` 在 create+poll 路径下丢失**。sidecar 的 `resolution` / `aspect_ratio` 只能来自
   create payload，而 `create` 和 `poll` 是两个独立进程，payload 传不过去。

讽刺的是 skill 自己推荐长任务用 `create` + `poll`（避免工具调用超时把任务跑丢），
**推荐路径恰好是丢信息的那条**。两条真实片子 `d12c2787`、`3e830902` 的 sidecar 都缺 `request`。

## What I already know

* `batch` 已经这么干了：`take_seed=$(( (RANDOM << 15 | RANDOM) & 0x7FFFFFFF ))`
  （`ofox-video.sh:1274`），不传 seed 时自己 roll 一个并记录 —— 这是仓库里现成的先例，
  `generate` / `create` 只是没跟上。
* 脚本目前**没有任何 `SEED` 输出**（grep 无结果）。
* `seed` 是合法的 create 请求字段（`api-params.md:23`，"Deterministic generation"）。
* sidecar 的 `request` 段由 `write_sidecar()` 从 payload 生成，已剥除 `frame_images`。
* `download_result()` / `poll_and_download()` 已支持可选的 `request_json` 入参 —— 管道是通的，
  缺的只是 create→poll 之间的持久化。

## Requirements

* 不传 `--seed` 时，`generate` / `create` 客户端 roll 一个 seed 并写进 payload
  （与 `batch` 同一表达式，保持一致）
* `generate` / `create` / `batch` 均输出 `SEED <n>` 行
* `create` 把（剥除 `frame_images` 后的）payload 持久化到 out-dir，
  `poll` 自动读取并合入 sidecar，成功后清理
* 找不到持久化文件时优雅退化为当前行为（sidecar 无 `request`），不报错
* 持久化文件不污染 out-dir 的正常浏览（点文件），且不与视频/ sidecar 命名冲突

## Acceptance Criteria

* [x] `generate` 不传 `--seed` 时输出 `SEED <n>`，且 sidecar 的 `request.seed` 与之相同
* [x] 传了 `--seed 12345` 时输出的 `SEED` 与 sidecar 均为 `12345`（不被随机值覆盖）
* [x] `create` 输出 `SEED <n>`
* [x] `create` + `poll` 走完后，sidecar 含完整 `request`（`resolution` / `aspect_ratio` / `seed`）
* [x] poll 成功后 out-dir 里不残留持久化的中间文件
* [x] `poll` 一个非本机 create 的 job（无持久化文件）仍成功，sidecar 无 `request` 段且不报错
* [x] `create` 到一个 out-dir、`poll` 到另一个 out-dir 时不崩，退化为无 `request`
* [x] `batch` 现有的 seed 行为与输出不被破坏

## Definition of Done

* 上述 AC 实测通过（mock 覆盖 create+poll 全链路，真实 job 至少验证一次退化路径）
* `api-params.md` 与 `ofox-video-core/SKILL.md` 同步 seed 与 request 持久化说明
* 四个场景 skill 中"重渲同一条"的说法与实际能力一致
* `shellcheck -S warning` 干净

## Technical Approach

**Seed**：`cmd_generate` 在构建 payload 前，若 `$seed` 为空则 roll 一个，
沿用 `batch` 的表达式。之后一切自动生效——payload 里有了，sidecar 的 `request.seed` 就有了。

**Request 持久化**：`create`（`submit_only`）在返回前把 payload 写到
`<out_dir>/.ofox-request-<job_id>.json`；`poll_and_download()` 在下载前查找同名文件，
命中则作为 `request_json` 传给 `download_result()`，sidecar 写成功后删除。

选点文件而非普通文件：out-dir 是用户会用 Finder 浏览的目录，中间态不该混在成片里。

## Decision (ADR-lite)

**Context**: create 与 poll 是两个进程，payload 无法直接传递；而 payload 是
`resolution` / `aspect_ratio` / `seed` 的唯一来源（API 响应都不回）。

**Decision**: 客户端 roll seed（对齐 batch 的既有做法）+ out-dir 内点文件做 create→poll 的交接。

**Consequences**:
* seed 由服务端选变为客户端选 —— 随机性无实质差别，但从此每个 job 都可复现
* out-dir 在 create 与 poll 之间会短暂存在一个点文件
* 跨 out-dir 或跨机器 poll 时退化为无 `request`，与今天行为一致，不算回归

## Verification

Mock 覆盖（`OFOX_API_BASE_URL` 指向本地 http server，零计费）13/13 通过：
seed 有无显式传入两种情况、create+poll 全链路 request 贯通、handoff 清理、
跨 out-dir 退化、batch 未回归。

真实 API 补验一次退化路径：`3e830902`（改动前创建，天然无 handoff）重 poll
成功，sidecar 无 `request` 段且不报错，目录无残留点文件。

`shellcheck -S warning` 干净；上一任务的 slug 套件 18/18 仍全过。

## Out of Scope

* 补写历史 sidecar 的 `request`（`d12c2787` / `3e830902` 的 seed 已不可考，服务端不回传）
* 真正的"重渲"子命令（读 sidecar 一键重跑）—— 本任务只保证信息齐全，不做编排

## Technical Notes

* `RANDOM << 15 | RANDOM` 在 bash 下产生 30 位，`& 0x7FFFFFFF` 截到正 int 范围
* 点文件命名含 job id，天然避免并发 create 互相覆盖
* 清理必须在 sidecar 写成功之后，否则失败重跑就没得读了
