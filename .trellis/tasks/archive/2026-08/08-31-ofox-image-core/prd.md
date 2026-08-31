# 用实测账单坐实图片计价公式，让 ofox-image-core 能报出真实成本

## Goal

`ofox-image-core` 生成完图片只打印 token 数，然后叫用户自己去看 `pricing.md`，
而那份文档说"费率有歧义，别算"。结果是**这个 skill 无法报价**——与 `ofox-video-core`
每次都打印 `VIDEO_COST` 的行为完全不对等。

歧义现在被真实账单消除了，可以补上。

## What I already know

* 用户提供的真实账单：**$0.06723950**（第二次图片调用，input 79 / output 1120）。
* 公开 catalog（`GET /v2/models/catalog/google/gemini-3.1-flash-image?include=provider_price`，
  免密钥）给出机器可读费率：
  `input=0.0000005`、`output=0.000003`、`output_image=0.00006`。
* **验证通过（8 位小数逐位吻合）**：
  ```
  cost = input_tokens × 0.0000005 + output_tokens × 0.00006
  79 × 0.0000005 + 1120 × 0.00006 = 0.0000395 + 0.0672 = 0.06723950
  ```
  → 图片端点的 output tokens **全部按 `output_image`（$60/M）计**，
  `output`（$3/M）那一行不参与。20 倍歧义就此消除。
* 第一次调用（input 51 / output 1120）按同公式为 $0.06722550，两张合计 $0.13446500。
* **API 没有账单端点**：v1/v2 共探 14 个（usage/billing/credits/me/account/balance…）全 404。
  `app.ofox.ai` 网页端是唯一入口。所以成本只能由脚本用费率 × usage 自行计算。
* 脚本**已经有** `load_models()`，且 `cmd_models` 已在读 `.pricing.output_image`
  （`ofox-image.sh:336`）——费率一直可得，只是从未用于计算。
* 现状输出止于 `USAGE_*` 三行 + 一句"没有已验证费率，别报价"（`:657`）。
* `ofox-video-core` 的 `rate_for()` 是现成的先例：从 catalog 取费率、取不到就明确放弃，
  **绝不猜**。本任务沿用同一纪律。

## Requirements

* 新增成本计算：`input_tokens × pricing.input + output_tokens × pricing.output_image`
* `generate` 成功后输出 `IMAGE_COST <数值>` 行
* 费率取不到时（无网络、无缓存、模型不在列表里）**不猜**——不打印 IMAGE_COST，
  改打印一行说明为什么算不出来，与 `ofox-video-core` 的做法一致
* 删除 `:657` 那句"没有已验证费率"的免责声明，替换为真实数字
* `pricing.md` 用实测证据重写歧义段落，写明公式、账单值与验证方法
* `cmd_models` 的表尾提示同步更新（不再说"see pricing.md for how that turns into a cost"）
* `ofox-image-core/SKILL.md` 与 `seedance-anime-drama` 中"图片成本未知"的说法一并订正

## Acceptance Criteria

* [x] 用 input=79 / output=1120 的 usage 计算，结果为 `0.06723950`（与账单逐位一致）
* [x] 用 input=51 / output=1120 计算，结果为 `0.06722550`
* [x] `generate` 成功输出里含 `IMAGE_COST` 行
* [x] 费率不可得时不打印 IMAGE_COST，且明确说明原因，退出码不变
* [x] 非 Gemini 的图片模型（费率不同）也用各自 catalog 费率，不硬编码
* [x] `pricing.md` 不再声称费率有歧义
* [x] 全仓不再有"图片成本无法报价"的残留说法

## Definition of Done

* 上述 AC 实测通过（费率计算用离线 usage 数据验证，不必再花钱生成图片）
* 文档 English-only，与 CONTRIBUTING.md 一致
* `shellcheck -S warning` 干净

## Technical Approach

新增 `image_cost_for()`：读 `MODELS_FILE` 里该模型的 `.pricing.input` 与
`.pricing.output_image`，与 usage 相乘。bash 无浮点，用 `jq` 做算术（jq 已是硬依赖，
且视频脚本算价也是这么干的）。

输出精度对齐视频侧的风格：`VIDEO_COST` 打印 API 原样的 10 位小数字符串，
这里是本地计算，取 8 位小数足以覆盖账单精度（实测账单本身就是 8 位）。

## Decision (ADR-lite)

**Context**: 图片 API 响应不含 cost 字段（不像视频的 `usage.video_cost`），
且平台无账单端点。要报价只能本地用费率算。此前因费率语义不明而选择不报，
现已被真实账单证伪。

**Decision**: 本地计算并输出 `IMAGE_COST`，费率取自公开 catalog；取不到就明说算不出，不猜。

**Consequences**:
* `ofox-image-core` 与 `ofox-video-core` 的报价行为终于对等
* 依赖 catalog 费率的准确性——若 Ofox 改价而 catalog 未同步，数字会偏；
  但这与视频侧承担的是同一个风险，不引入新的风险类别
* 公式基于**单次**账单验证。多验一次不同 token 数的调用会更稳，但当前证据已到
  8 位小数吻合，不属于巧合

## Verification

* `image_cost_for()` 单元验证 6/6：
  * in=79 / out=1120 → `0.0672395`，与账单 **$0.06723950 逐位吻合**
  * in=51 / out=1120 → `0.0672255`
  * 零 token → `0`；未知模型 / 非数字 token → 拒绝给数字
  * `openai/gpt-image-2` → `0.033995`（不同费率，证明未硬编码 Gemini）
* 端到端（本地 mock 图片端点，零花费）：`generate` 输出 `IMAGE_COST 0.0672395`
* 降级路径：未知模型时不打印 IMAGE_COST，改打印原因说明，token 数照常输出
* `shellcheck -S warning` 干净

### 实现中发现的坑

`/v1/models` 与 `/v2/models/catalog` 对同一组费率用了**不同键名**：
前者 `prompt`/`completion`，后者 `input`/`output`（`output_image` 两边同名）。
初版按 catalog 键名写，脚本加载的却是 v1 列表，导致取不到费率、静默不输出成本。
现已同时接受两种拼法，并在代码与 `pricing.md` 中记录。

## Out of Scope

* 补算历史图片的花费（无留存 usage 记录）
* 图片的 sidecar / 命名改造（视频那套暂不移植到图片侧）
* 追踪账户余额（无端点）

## Technical Notes

* 账单值 $0.06723950 由用户从 app.ofox.ai 提供，对应 19:11 那次调用
* `output_image` 是**每 token** 费率，不是每张图——`cmd_models` 表头已经写对了，
  只是没人拿它算过
* Gemini 无论传什么 `--size` 都按 1024×1024 出图，但计价看的是 usage token，与 size 无关
