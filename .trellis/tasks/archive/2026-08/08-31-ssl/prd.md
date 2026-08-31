# 修今天用下来暴露的三个缺陷：首帧设计、价格插值、请求无超时

三个缺陷都来自今天的真实使用，不是推测。按顺序修，各自独立提交。

---

## A. `seedance-anime-drama` 让模型产出了最不适合当首帧的图

### 问题

skill 的 Step 1 指示写 `character reference sheet, plain neutral background,
front-facing full body`。模型忠实照做，产出一张**真正的多视图设定集**：
4 个视角 + 3 个表情 + 调色板 + 大量文字标注（还自作主张起名 "HANA TANAKA (高橋 花)"）。

而 Step 2 要把这张图当 `--frame-first-image` —— 那是**字面意义上的视频第一帧**。
结果是镜头会从一张带文字的九宫格开始动。

实测：今天生成 `ofox_image_20260831190827_22781.png` 就是这个形态，只能弃用，
另花一次钱重生成一张"入戏首帧"（背影站在天台门口）才可用。

### 根因

skill 把两种**用途完全不同**的产物混为一谈：

| 产物 | 用途 | 要求 |
|---|---|---|
| 角色设定集 | 给人看、锁定设计、跨镜头复用参考 | 多视角、标注、白底 |
| 首帧图 | 喂给视频模型当第一帧 | 单张入戏画面、无文字、构图即开场 |

现有文档只有前者，却拿去干后者的活。

### 要修的

* Step 1 拆成两种产物，讲清各自用途与提示词差异
* 首帧图的提示词必须含 `no text, no panels, single illustration`（今天实测有效）
* 说明单镜头场景下设定集**不是必需品**——跨镜头一致性才是它的价值
* 说明首帧决定成片画幅（`adaptive` 跟随参考图），要特定比例得在出图前裁

---

## B. `$0.xx` 的价格数字被 skill 加载时的参数插值吃掉

### 问题

skill 正文加载时会做 shell 式变量替换，`$0` 被替换成传入参数。
本次实测：`seedance-anime-drama` 文档里的 `$0.10` 渲染成
`"likely well under 小说片段：林砚推开天台的门..."`。

`$1.92` / `$5.76` / `$7.68` 未受影响，**只有 `$0` 这个序列会中招**。

全仓 9 处：
```
seedance-product-video/SKILL.md:264      $0.64
seedance-ad-creative/SKILL.md:240        $0.64
seedance-anime-drama/SKILL.md:246,335    $0.10 / $0.64
seedance-short-drama/SKILL.md:235        $0.64
ofox-video-core/SKILL.md:56              $0.04/s, $0.10/s
ofox-video-core/SKILL.md:176             $0.40
ofox-video-core/SKILL.md:252             $0.24/s
ofox-video-core/SKILL.md:315             $0.44
```

### 讽刺之处

这几个 skill 的核心职责就是**如实报价**、反复强调"绝不编数字"，
而它们自己文档里的小额价格全是坏的。

### 要修的

改写为不含 `$0` 序列的等价表达（如 `4 cents/s`、`USD 0.64`），
语义不变。同时在 `CONTRIBUTING.md` 记一条，避免以后再写回去。

---

## C. 真正花钱的请求全都没有超时

### 问题

今天 4 次 `curl exit 35`（LibreSSL SSL_ERROR_SYSCALL），全部发生在轮询中。
脚本每次都正确地只重试 poll、从不重试 create，所以**没有多花钱**。

但排查时发现更实在的问题：只有模型列表请求带 `--max-time 10`，
真正花钱的调用一个超时参数都没有。

| 位置 | 调用 | 超时 |
|---|---|---|
| `ofox-video.sh:215` | 模型列表 | `--max-time 10` ✓ |
| `ofox-video.sh:285` | catalog | `--max-time 10` ✓ |
| **`ofox-video.sh:1071`** | **create（POST，计费）** | **无** |
| **`ofox-video.sh:1983`** | **poll** | **无** |
| **`ofox-video.sh:2314`** | **download** | **无** |
| **`ofox-image.sh:624`** | **图片 generate（计费）** | **无** |

后果：
* 连接挂住 = 无限等待，用户终端干等
* poll 无超时意味着 **`--max-wait` 的契约可被静默突破**：
  `elapsed` 只在 curl 返回后才累加，curl 不返回就永远不超时

### 对照实验（免费公开端点，各 30 次）

默认 HTTP/2：30/30 成功；强制 `--http1.1`：30/30 成功。
→ 不是这台机器与该域名的普遍 TLS 问题，是长轮询中的瞬时中断。
现有重试逻辑已能恢复，**不需要改重试策略**，要补的是超时。

### 要修的

* create：给一个宽裕的 `--max-time`（正常几秒内返回）。
  注意权衡——超时会落入 exit 5「无响应，不可判断是否已计费」路径，
  但那条路径本来就存在且处理正确，而无限挂起没有任何好处
* poll：较短超时，且不长于 `poll_interval` 的合理倍数，保证 `--max-wait` 说到做到
* download：**不能用固定 `--max-time`**（大文件合法地慢），
  改用 `--connect-timeout` + `--speed-limit`/`--speed-time` 检测停滞
* 图片 generate：同 create

## Acceptance Criteria

* [x] A：Step 1 明确区分设定集与首帧图，首帧提示词含 no text / no panels
* [x] A：说明单镜头不需要设定集，以及画幅由首帧决定
* [x] B：全仓 `grep '\$0\.'` 在 SKILL.md 中零命中
* [x] B：改写后价格语义不变（数值不改）
* [x] B：`CONTRIBUTING.md` 记下这条约束
* [x] C：四处计费/下载请求均有超时或停滞检测
* [x] C：poll 超时后仍走既有重试路径，绝不重试 create
* [x] C：download 的慢速大文件不被误杀（用停滞检测而非固定 max-time）
* [x] C：`--max-wait` 在 poll 卡死时仍能按时退出并给出 exit 4

## Definition of Done

* 三项各自独立提交
* 文档 English-only
* `shellcheck -S warning` 干净；既有测试套件不回归

## Out of Scope

* 追查 SSL 中断的根因（对照实验显示非普遍性问题，且重试已能恢复）
* 给图片侧加轮询（图片 API 是同步的，没有 job 可轮询）

## Verification

* A：改动为文档级；依据是今天两张真实参考图的对比——按旧措辞产出多视图设定集
  （四视角 + 表情行 + 调色板 + "HANA TANAKA" 字幕），按新措辞产出可直接当首帧的
  单张入戏图。
* B：`grep '\$0' skills/*/SKILL.md` 零命中；数值未改，仅改写法。
* C：
  * `--max-wait 30` 实测 31 秒退出、exit 4（改前 elapsed 只按 poll_interval 累加，
    墙钟可远超）
  * 四处计费/下载请求均已带超时或停滞检测
  * 回归：seed/handoff 13/13、slug 18/18、图片成本 6/6，均全过
  * `shellcheck -S warning` 干净
* 第四项（out/ 里的裸 job id 文件）：与 `便利店分手-d12c2787.mp4` 的 SHA-256 完全相同，
  确认为冗余副本后删除，未丢失任何内容。
