# 把结构性 grep 断言换成行为断言，删掉冗余用例

## Goal

上一轮补的三个测试文件里有 4 项断言不合格：一项冗余、三项用 `grep` 检查源码文本
而不是检查行为。后者违反 CLAUDE.md 的 **"Test behavior, not implementation"**——
无害重构会让它们误报，逻辑真坏了又可能照样通过。

## What I already know

* 新增断言共 53 项（naming 25 / handoff 20 / imagecost 8），其中 4 项要改。
* 逐条诊断：

| 位置 | 诊断 |
|---|---|
| `imagecost.test.sh` "not priced at the text-output rate" | 冗余。锚定用例已断言精确等于 `0.0672395`，费率退回 $3/M 时它会先失败。本条是弱化重述；逻辑 `${got%%0.003*}` 晦涩；且复用上一块残留的 `$got`（本块从未赋值） |
| `imagecost.test.sh:121` 键名 grep | 测源码文本 |
| `handoff.test.sh:66` seed roll grep | 测源码文本 |
| `handoff.test.sh:71` `echo "SEED"` 计数 grep | 低价值。可复现性真正依赖的是 seed 进 payload 与 sidecar，两者已有行为覆盖；stdout 那行只是便利输出 |

* **已验证的可用观测点**：`generate --dry-run --print-payload` 会把完整请求体打到 stderr，
  实测输出含 `"seed":1032458752`。这让 seed 可以做纯行为断言，且不花钱、不联网
  （`--dry-run` 不发请求）。
* `model_entry()` 读的是全局 `MODELS_FILE`，测试里可直接指向一个合成 JSON，
  从而在不联网的前提下验证费率键名的两种拼法。

## Requirements

* 删除 imagecost 里那条冗余断言
* seed：改为断言 `--dry-run --print-payload` 的 payload 中
  * 不传 `--seed` 时含 seed 字段
  * 两次运行的 seed 不同（证明确实在 roll，而非常量）
  * 传了 `--seed N` 时payload 中就是 N
* 费率键名：改为用两份合成模型列表（一份只有 `prompt`/`completion`，
  一份只有 `input`/`output`）分别验证 `image_cost_for` 都能算出成本
* 保留 `handoff.test.sh:197`（`grep -q '^VIDEO_COST '`）与 `:211`
  （`grep -q 'unbound variable'`）——这两条 grep 的是**程序输出**，属于行为断言，不在整改范围
* 不得降低覆盖：改完后每一条断言都必须能因真实缺陷而失败

## Acceptance Criteria

* [x] `imagecost.test.sh` 与 `handoff.test.sh` 中不再有针对 `$TARGET` 源码的 grep
* [x] seed 的三条行为断言全部通过
* [x] 费率键名的两条合成列表断言全部通过
* [x] 12 个测试文件在 `/bin/bash` 3.2 下全绿
* [x] 变异检验：人为破坏实现（去掉 seed roll、只认一种键名）时，
      对应断言确实失败——证明新断言不是永真

## Definition of Done

* 上述 AC 实测通过，含变异检验
* 测试文件 English-only，与既有套件风格一致
* `shellcheck -S warning` 干净

## Verification

### 变异检验（本任务的核心验收）

在临时副本上人为破坏实现，确认新断言确实会失败：

| 变异 | 结果 |
|---|---|
| 移除 `generate` 的 seed roll | seed 的 2 条断言失败；显式 `--seed` 那条正确地仍通过 |
| 去掉 `.pricing.prompt` 回退（只认 catalog 键名） | `'prompt'` 那条失败、`'input'` 通过——精确区分；锚定用例也一并失败，因为真实 v1 列表用的正是 prompt |
| 让成本公式忽略 input token | 锚定用例失败（`0.0672` vs `0.0672395`）——8 位小数把 3.95e-5 的差异抓住 |

### 其他

* 三个测试文件中针对 `$TARGET` 源码的 grep 计数为 0
* 12 个测试文件在 `/bin/bash` 3.2 下通过 250 项、失败 0
  （整改前 248：删 1 条冗余、seed 2→3、键名 1→3）
* `shellcheck -S warning` 干净
* 保留的两条输出 grep（`^VIDEO_COST`、`unbound variable`）grep 的是程序输出，
  属行为断言，未在整改范围内

## Out of Scope

* 重构既有 8 个测试文件里的结构性断言（如 `pricing.test.sh` 里那条刻意检查
  "旧硬编码价格表已删除" 的 grep——那条的对象就是源码结构，是合理用法）
* 增加新功能的覆盖面（本任务只做质量整改，不扩范围）

## Technical Notes

* `--dry-run` 在任何请求发出前就返回，所以 seed 断言天然免费
* 合成模型列表只需 `{"data":[{"id":..., "pricing":{...}}]}` 这一最小形状
* 变异检验用临时副本做，不改动真实脚本
