# 给下载的视频起有意义的文件名，而不是裸 job id

## Goal

`ofox-video.sh` 下载产物时用裸 job id 命名（`d12c2787-c29c-45c4-b31d-774971715f44.mp4`），
用户在 Finder / 文件列表里无法分辨哪条是哪条，唯一的辨认方式是逐个打开播放。
改成可读命名，同时不丢失回溯到 job 的能力。

## What I already know

* 命名逻辑只有一处：`download_result()`，`skills/ofox-video-core/references/ofox-video.sh:2028-2032`
  ```bash
  if [ "$count" -gt 1 ]; then fname="${job_id}_${i}.${ext}"
  else fname="${job_id}.${ext}"; fi
  ```
* `download_result()` 的入参是 `job_id / body / out_dir` —— **拿不到 prompt 变量**。
* **但 `body`（poll 响应）里有 `.prompt`**。实测 job `d12c2787` 的响应字段：
  `id / status / model / prompt / unsigned_urls / usage{video_seconds,video_cost} / created_at / updated_at`。
  → 无需把 prompt 从 `generate` 透传下来，`poll <job_id>` 单独跑也能拿到语义。
* API 只有 `POST /v1/videos` 和 `GET /v1/videos/{id}`，**没有 list-jobs 接口**
  → 短 id 无法反查完整 UUID，这是要 sidecar 的根本原因。
* 仓库已有命名先例是时间戳式：`contact-sheet-${stamp}.png`（`:1455`）、
  `chain-joined-${stamp}.mp4`（`:1774`）。
* 依赖契约限定 **curl + jq + bash**，无 python，中文 prompt 无法转写拼音。
* 受影响调用路径：`generate` / `poll` / `batch`（多 take）/ `chain`（多 shot）。

## Requirements

* 文件名语义来源优先级：`--name` > `.prompt` 截取 > `job_id` 兜底
* 文件名保留短 job id（前 8 位十六进制）后缀，保证同 prompt 重复生成不覆盖
* 每个视频旁边写一个同名 `.json` sidecar，记录完整 job id / prompt / model / 参数 / 实际花费
* 新增 `--name` 参数，供场景 skill 传入短名
* 四条路径（generate / poll / batch / chain）命名风格一致
* sanitize：空白折叠为 `-` → 剥除控制字符 → 去除 `/ \ : * ? " < > |` → 首尾裁剪非字母数字
  （顺序不可换：制表符/换行既是空白又是控制字符，先剥会把相邻词粘连）
* slug 按 **Unicode 码点** 截断（在 jq 里切片，与 locale 无关，天然不切断 UTF-8），
  上限 40 码点；截断时回退到最近的词边界，避免切出半个英文单词
* 保留非 ASCII：中文 prompt 出中文名，英文 prompt 出英文名，跟随用户语言
* 单 job 多 URL 时沿用现有 `_${i}` 后缀约定

## Acceptance Criteria

* [x] 裸跑 `poll <job_id>`（无 prompt 上下文）仍能产出语义化文件名
* [x] `--name "便利店分手"` 时文件名为 `便利店分手-d12c2787.mp4`
* [x] 不传 `--name` 时从 `.prompt` 截取兜底
* [x] `.prompt` 为空（如纯图生视频）时退回 `job_id` 命名，不产出空名或悬空 `-`
* [x] 同一 prompt 连续生成两次，两个文件不互相覆盖
* [x] 中文 prompt 与英文 prompt 都产出合法文件名
* [x] slug 超长时按字节截断且不切断 UTF-8 字符（不产生乱码半字符）
* [x] `--name` 传入含 `/`、`..`、换行的恶意值时被 sanitize，不能逃出 out-dir
* [x] sidecar json 内容可被 `jq` 解析，含完整 job id
* [x] `VIDEO_PATH` 输出仍是绝对路径

## Definition of Done

* 上述 AC 逐条实测通过（含一次真实 `poll` 已完成 job 的回归）
* 四个场景 skill 的 SKILL.md 与 `api-params.md` 同步 `--name` 说明
* 无 shellcheck 新增告警

## Technical Approach

单点改造 `download_result()`，新增一个 `build_output_slug()` 辅助函数：

```
slug = --name(sanitized)  ||  .prompt 前 40 码点(sanitized, 回退词边界)  ||  ""
short = job_id 前 8 位
fname = slug ? "${slug}-${short}.${ext}" : "${job_id}.${ext}"
sidecar = "${fname%.*}.json"
```

`--name` 需要从 `generate` / `poll` / `batch` / `chain` 的参数解析透传到
`poll_and_download()` → `download_result()`。

## Decision (ADR-lite)

**Context**: 命名要同时满足可读、可追溯、不覆盖，而 `download_result()` 拿不到 prompt 变量，
只能靠 job 响应里的 `.prompt`；场景 skill 才真正知道这条戏叫什么。API 无 list 接口，
短 id 不可反查。

**Decision**:
1. Approach C —— `--name` 显式传名，`.prompt` 自动截取兜底，都拼短 job id 后缀。
2. 同名 `.json` sidecar 承载完整元信息。

**Consequences**:
* 语义质量最高，`poll` 裸跑不退化
* out-dir 文件数翻倍（mp4 + json）
* 顺带补上"换分辨率重渲同一条"的复现缺口：sidecar 存了 prompt 和全部参数
* 引入新公开参数，需在 `api-params.md` 和 4 个 SKILL.md 同步

## Verification (all run on a real machine)

* `build_output_slug` boundary suite: 18/18 pass, including path traversal,
  Windows-illegal characters, control characters, word-boundary truncation,
  UTF-8 integrity after slicing, and identical output under `LC_ALL=C`.
* Real completed job `d12c2787` re-polled twice (GET only, nothing billed):
  bare poll produced a prompt-derived name, `--name` produced
  `便利店分手-d12c2787.mp4` with a matching sidecar carrying the full job id.
* `generate` path exercised against a local mock via `OFOX_API_BASE_URL`, so
  the `request` field (resolution, aspect ratio, provider) was verified
  without submitting a billable job.
* `shellcheck -S warning` clean; `bash -n` clean; no stray control bytes.

### Two defects the tests caught

1. `[\u0000-\u001f]` as a *regex* is read by Oniguruma as the literal
   characters u, 0, 1, f, collapsing into the ASCII range `0-u`. It deleted
   most letters and left the actual control characters in place — the exact
   inverse of the intent. `"A dim convenience store"` came back as `"  v "`.
   Fixed by using `[[:cntrl:]]`.
2. Stripping control characters *before* collapsing whitespace glued words
   together, because tab and newline are both: `"line one\nline two"` became
   `"line onelinetwo"`. Fixed by reordering.

## Out of Scope

* 重命名已下载的历史文件（不做迁移）
* 把元信息写进 mp4 metadata tag
* 用 LLM 从 prompt 里提炼主题词做 slug（脚本层不引入模型调用）
* seed 输出缺口（`create` 不打印 seed）—— 相关但独立，另开任务

## Technical Notes

* 中文 slug 在 macOS/APFS、Linux、Windows(NTFS) 上均合法（UTF-8）
* 最初设计按字节截断，实现时改为在 jq 里按码点切片——jq 是硬依赖且切片与 locale 无关，
  从构造上就不可能切出半个字符，比在 bash 里对齐 UTF-8 边界干净得多
* `--name` 是路径注入面：必须先 sanitize 再拼接，不能信任调用方
