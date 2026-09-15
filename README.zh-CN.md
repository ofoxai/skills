# ofoxai/skills

来自 **OFOX AI** 的高标准开源 [agent skills](https://www.skills.sh/ofoxai/skills) ——
单仓库统一质量门槛：明确的安全契约、真实工具配方、不泄露密钥与本地路径。

这些 skill 通过 [skills.sh](https://skills.sh) 可用于 Claude Code、Cursor、Copilot
及 70 多个其它 agent。

[English](README.md)

```
npx ofox-skills           # 把全部 skill 装进本机每一个 agent
npx ofox-skills doctor    # 查哪些 agent 现在真的能看到它们
```

报价不需要账号 —— 见下文。**请先读那一节：这里有八个 skill 会真实花钱。**

## 视频类 skill 会真实花钱 —— 先用这招查清再决定

八个视频 skill（四个 `seedance-*` 再加 `keyframe-animation`、`product-demo`、
`ugc-ads`、`shorts-reels`）调用 Ofox 视频 API，跑的是
[Seedance 2.5](https://ofox.ai/models/bytedance/seedance-2.5?utm_source=github&utm_medium=readme&utm_campaign=skills)，
**按生成秒数计费**。15 秒 720p 约 **$3.60**，4 秒 480p 草稿约 **$0.44**，还有更便宜的模型。
生成本身是老虎机 —— 你往往要出好几条、留一条 —— 所以单条价格不等于总成本。

**不用账号、不用 API key，就能给任何一个任务报价。** 装完之后：

```
bash ~/.agents/skills/ofox-video-core/references/ofox-video.sh \
  generate --dry-run --prompt "two people arguing in a kitchen" \
  --duration 15 --resolution 720p
# Estimated cost: ~$3.60 (15s x $0.24/s)
# DRY RUN — nothing was submitted and nothing was billed.
```

`~/.agents/skills/` 是安装器存放规范副本的位置，每个 agent 都读它 —— 或直接读，
或通过自己的软链读。Claude Code 另外还会在 `~/.claude/skills/ofox-video-core/`
暴露同一个 skill，但那个路径只在装了 Claude Code 时才存在，所以上面这条命令是
到处都成立的写法。

`--dry-run` 会完整校验参数并报出价格，**不发送任何请求**。`ofox-video.sh models`
和 `ofox-video.sh providers` 同样不需要 key。先判断值不值，**再**去注册。

决定要用时：在 [app.ofox.ai](https://app.ofox.ai/?utm_source=github&utm_medium=badge&utm_campaign=skills)
拿 key（Settings → API Keys → Create New Key，只显示一次），然后

```
export OFOX_API_KEY=your_key_here
```

已经在 Codex / Claude Code / Cline 里配过 Ofox key？**同一个 `OFOX_API_KEY` 直接可用**，
不需要新建。

**前置依赖**：`curl` 和 `jq`。`curl` 通常已预装，`jq` 常常没有
（macOS `brew install jq`，Debian/Ubuntu `apt-get install jq`）。
skill 会检查这两个并告诉你缺哪个。

`hal-vault`、`hal-image` 和 `cloudflare-drop` 不碰 Ofox API，运行不花钱。

## 每一条成片都被完整记录，可以再瞄一次

生成是老虎机，所以你留下的那条值得事后还能说清楚是哪一条。每条成片落地为
`<名称>-<短 job id>.mp4` —— 传 `--name` 就用场景名而不是裸 job id —— 旁边配一个
`.json` 附录，记着完整 job id、prompt、seed、提交时的原样请求，以及**实际花了多少**。

**seed 是最关键的那一项。** 不指定它，服务端会自己挑一个且不在任何地方告诉你，
于是「刚那条不错，给我出个 1080p 的」连个能指的东西都没有。记下来，整个请求就能
换个分辨率重新提交。

**但那不等于复现。** 2026-09-15 实测：同一条逐字节相同的请求、固定 seed，提交三次，
回来的是两条肉眼可见不同的片子加一次被拒。重渲是朝那一条再瞄一次，不是把那一条拿回来
—— 这几个 skill 会在用户付钱之前把这句话说清楚。

想看成品长什么样：ofox.ai 的
[Seedance 2.5 提示词与案例页](https://ofox.ai/zh/seedance-2-5-prompts?utm_source=github&utm_medium=case&utm_campaign=skills)
公开了一批成片，每条附提交的 prompt 与参数；其中用这几个 skill 生成的那些，
还带 job id 和实际账单。

## 安装

```
npx ofox-skills
```

**全部 skill，装进本机每一个 agent，用户级。** 这个组合是默认值，因为其它组合会静默出错：

- **每一个 agent** —— 因为 `skills add` 自己跑会交互式询问你要装到哪些 agent，
  而当**由 agent 代跑**时它会跳过提问、只装它检测到的那一个。两条路都会让你没选中的
  agent 什么也拿不到，而且不报错 —— 直到某个 agent 说看不见一个你明明装过的 skill。
- **每一个 skill** —— 因为每个场景 skill 都用相对路径去找它的执行层
  （`ofox-video-core`，`seedance-anime-drama` 还要 `ofox-image-core`），
  只有并排安装时这个路径才解析得出来。skills.sh 的清单格式没有依赖声明字段，
  所以单独装一个可能让你拿到：

  ```
  bash: ../ofox-video-core/references/ofox-video.sh: No such file or directory
  ```

  这意味着核心 skill 没装，不是这个 skill 坏了。

### 查你的 agent 到底能看到什么

```
npx ofox-skills doctor
```

列出本仓库每个 skill 当前链接进了哪些 agent，缺任何一个就非零退出。
当某个 agent 坚称某个 skill 不存在时值得跑一下 —— 通常它是对的，
而这条命令会告诉你是哪些、为什么。

它查的是**用户级（全局）**skill，也就是默认安装的落点，并会在输出里说明
自己查的是哪个作用域。如果你是用 `--project` 装的，就问同一个作用域：

```
npx ofox-skills doctor --project
```

如果全都列出来了但某个 agent 仍然看不到，重启那个 agent ——
多数 agent 只在启动时读一次 skill 列表。

### 更窄的安装

你传的任何 flag 都会覆盖对应的默认值：

```
npx ofox-skills --agent codex               # 只装一个 agent，仍然全部 skill
npx ofox-skills seedance-short-drama        # 只装一个 skill，仍然全部 agent
npx ofox-skills --project                   # 装到当前项目而非用户级
```

不想经过这个包的话，底层 CLI 也可以直接用 —— 但默认值就得你自己给：

```
npx skills add ofoxai/skills --skill '*' --agent '*' --global --yes
```

## Skills 一览

十三个 skill，分三组。下面的一句话说明是刻意精简的 ——
每个 `SKILL.md` 里有完整契约、全部参数和实测成本。

### 视频 —— Ofox 视频 API（Seedance 2.5），按秒计费

| Skill | 做什么 |
|-------|--------|
| [seedance-short-drama](skills/seedance-short-drama/SKILL.md) | 真人对白驱动的短剧镜头。会写分镜表、带引号的台词和表演提示；可以是一个长镜，也可以是单个 job 内的多次硬切。 |
| [seedance-ad-creative](skills/seedance-ad-creative/SKILL.md) | 电影感品牌/产品广告 —— 钩子、展示、慢动作高潮、英雄特写。可用产品图，也可纯文字描述。 |
| [seedance-product-video](skills/seedance-product-video/SKILL.md) | 朴素的目录/商品页素材 —— 白背景、简单环绕或转台、字面准确、不用情绪光。有产品图保真度最好；泛品类或虚构产品用纯文字描述也行。 |
| [seedance-anime-drama](skills/seedance-anime-drama/SKILL.md) | 动漫/漫画分镜。先生成角色图再让它动起来，所以同一个角色能跨镜保持一致。 |
| [keyframe-animation](skills/keyframe-animation/SKILL.md) | 你手上已有的两张图：A 当首帧、B 当尾帧，同一个 job 里由模型补中间。两端实测逐像素还原，动作前段走完、末尾是定格。 |
| [product-demo](skills/product-demo/SKILL.md) | 界面变更前后的两张截图，动画成一条片子。模型只交叉淡入淡出变了的那几个值，文字保持可读 —— 所以这一个刻意不带"禁止画面文字"那条规则。 |
| [ugc-ads](skills/ugc-ads/SKILL.md) | 手机实拍感的 UGC 短片 —— 开箱、初体验、真实测评。刻意反转其它场景默认的"精致"：只用一个现场光源、构图不完美、不调色、不磨皮。 |
| [shorts-reels](skills/shorts-reels/SKILL.md) | 一次批量出好几条便宜的竖屏 9:16 草稿，先报价，再用联系表挑一条，最后只把选中的那条重渲好。它管格式和成本账；prompt 交给对应的场景 skill 写。 |
| [ofox-video-core](skills/ofox-video-core/SKILL.md) | **库。** 上面八个调用的执行层：提交、轮询、下载、报出真实成本。装上但别直接调 —— 除非你要自己驱动 API。 |

### 图像

| Skill | 做什么 |
|-------|--------|
| [ofox-image-core](skills/ofox-image-core/SKILL.md) | **库。** Ofox 提供的每一个图像模型，`--model` 默认走一条最便宜优先的降级链、降级时会明说。先用 `--dry-run` 报价，再报出真实 token 用量和美元成本。 |

### 免费运行 —— 不碰 Ofox API，无按次费用

| Skill | 做什么 |
|-------|--------|
| [hal-vault](skills/hal-vault/SKILL.md) | SSH 密钥加密的本地密钥库。默认打码，所以 agent 能搜索并注入凭据而**从不打印它**。 |
| [hal-image](skills/hal-image/SKILL.md) | ImageMagick 配方 —— 缩放、裁切、合成、拼图、水印、格式转换 —— 外加发送前的无损压缩，让传输保持小体积。需要装 `magick`。 |
| [cloudflare-drop](skills/cloudflare-drop/SKILL.md) | 一个静态文件夹换一个可分享的在线链接。配了 `CLOUDFLARE_API_TOKEN` 是永久部署，没配是 60 分钟可认领预览 —— 而且它会明说你拿到的是哪一种、会自检返回的内容、绝不编造链接。 |

## 为什么用单仓库

一个仓库，一条质量线。每个 skill 自包含在 `skills/<name>/` 下（一个 `SKILL.md`
加可选的 `references/`），在 [`skills.sh.json`](skills.sh.json) 中声明。
从单个高标准仓库发布多个 skill，比一个 skill 一个仓库更容易治理、版本化和评审 ——
而使用者仍然可以用 `ofoxai/skills@<name>` 单独安装任意一个。

每个 skill 必须达到的标准见 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。

## 相关项目

- [ofoxai/awesome-seedance-2.5](https://github.com/ofoxai/awesome-seedance-2.5) ——
  Seedance 2.5 的 prompt 与成片合集：官方案例、社区案例，以及用这几个 skill 生成、
  带账单的案例，每条附 prompt 与参数。ofox.ai 上的 prompts 页就是它的站内镜像。
- [ofoxai/hal-vault](https://github.com/ofoxai/hal-vault) —— `hal-vault` skill
  驱动的那个 SSH 密钥加密密钥库（Go CLI，基于
  [age](https://github.com/FiloSottile/age)）。

## 许可

MIT © OFOX AI
