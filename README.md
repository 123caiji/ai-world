<div align="center">

# AI 大世界 · 实时 AI 情报站

**每 165 分钟自动采集一批** AI 新闻、arXiv 论文、新模型、GitHub 新仓库 / 涨星 / Release、DSH 插件生态（Actions 里的自愈链：每轮自己把下一轮排进队列，窗口到点自己开跑，cron 只是兜底，人工不参与）。<br />
**每条情报都带可核验证据**：抓取端点、抓取时间、HTTP 状态、在响应里的定位。

[![radar](https://github.com/123caiji/ai-world/actions/workflows/radar.yml/badge.svg)](https://github.com/123caiji/ai-world/actions/workflows/radar.yml)
[![pages](https://img.shields.io/badge/site-ai--world-60a5fa)](https://123caiji.github.io/ai-world/)
[![sources](https://img.shields.io/badge/%E6%95%B0%E6%8D%AE%E6%BA%90-61%20%E4%B8%AA-34d399)](#数据源)
[![license](https://img.shields.io/badge/license-MIT-8a9ab3)](LICENSE)

</div>

---

## 这是什么

一个**只用 GitHub Actions 就能跑**的 AI 情报雷达。没有服务器、没有第三方 API key、没有付费数据源，全部来自公开接口。

它每 165 分钟做四件事（采集窗口 + 自愈链机制，见下文「定时与部署」）：

1. **抓情报** —— 61 个数据源并发采集（中英新闻、官方博客、arXiv 多分区、Hugging Face 论文/模型/数据集/Space 趋势、GitHub 每日趋势、Hacker News / Show HN / Lobsters、YouTube 技术频道、AI 安全事件、中文技术社区、Anthropic 官方、Product Hunt、OpenRouter 模型目录、AI 垂直媒体（MarkTechPost / Synced / AI Business / IEEE Spectrum / Unite.AI），以及**社交媒体**：Bluesky、Mastodon、Reddit 的 AI 讨论）。
2. **扫 GitHub** —— 最近两周的 AI 新仓库、话题榜、涨星榜（自己存 stars 快照算 delta）、关注仓库的最新 Release。
3. **查插件** —— 扫 DSH 插件索引的 3000+ 插件，diff 出新增。
4. **发网页** —— 生成静态站推到 GitHub Pages，并把最热的 6 条写回本 README。

和别人的「AI 新闻聚合」不同，这里**每一条都能当场验证**：打开任意条目的「证据」，就能看到它是从哪个端点、什么时候、什么 HTTP 状态下抓来的。

## 五分钟看懂

| 你会看到 | 在哪 |
| --- | --- |
| 实时情报流（可搜索 / 按类型和来源筛选 / 热度排序） | [123caiji.github.io/ai-world](https://123caiji.github.io/ai-world/) |
| GitHub 雷达：新仓库 · 涨星榜 · 话题榜 · 新版本 | 网页右侧栏、`data/github.json` |
| DSH 插件生态：总量、分类分布、最近更新、新增 diff | 网页右侧栏、`data/dsh.json` |
| 数据源健康度：哪个源活着、抓了几条、多久 | 网页右下角、`data/sources.json` |
| 本轮快照（Markdown） | [`data/digest.md`](data/digest.md) |
| 全量机器可读数据 | [`data/feed.json`](data/feed.json)（每条 16 个字段，含 evidence） |
| 订阅（RSS 2.0，热度前 40 条） | [`feed.xml`](https://123caiji.github.io/ai-world/feed.xml) |

<!-- RADAR:START -->
**最近一次采集**：2026/10/31 17:03:18 · 库内 900 条 · 本轮新增 468 条 · 数据源 59/59 正常（另有 2 个待配置凭据）

| 热度 | 条目 | 来源 |
| ---: | --- | --- |
| 205 | [thedotmack/claude-mem · 今日 +1140 ⭐](https://github.com/thedotmack/claude-mem) | GitHub 每日趋势 |
| 196 | [deepseek-ai/deepseek-harness 涨 574 星](https://github.com/deepseek-ai/deepseek-harness) | GitHub 涨星榜 |
| 196 | [nightly-labs/openbot · 今日 +709 ⭐](https://github.com/nightly-labs/openbot) | GitHub 每日趋势 |
| 192 | [Donchitos/Claude-Code-Game-Studios · 今日 +353 ⭐](https://github.com/Donchitos/Claude-Code-Game-Studios) | GitHub 每日趋势 |
| 191 | [ollama/ollama 涨 128 星](https://github.com/ollama/ollama) | GitHub 涨星榜 |
| 185 | [6 AI Updates Worth Knowing & A Bubble-Bursting IPO](https://www.youtube.com/watch?v=eDiQNFa-zYg) | YouTube · Matt Wolfe |
<!-- RADAR:END -->

## 一条情报长什么样

```json
{
  "id": "43acd69fb9703f5092251fda281f8acae94bafdb",
  "kind": "news",
  "source": "qbitai",
  "sourceLabel": "量子位",
  "title": "文远知行001号员工带队，景烁科技首轮融资数千万美元",
  "url": "https://www.qbitai.com/2026/10/506281.html",
  "summary": "……",
  "publishedAt": "2026-10-29T03:27:50.000Z",
  "firstSeenAt": "2026-10-29T15:12:10.000Z",
  "tags": ["中文", "产品"],
  "heat": 148,
  "image": "https://example.com/cover.jpg",
  "imageSource": "原文 OG 封面",
  "evidence": {
    "url": "https://www.qbitai.com/feed",
    "fetchedAt": "2026-10-29T15:12:10.000Z",
    "httpStatus": 200,
    "pointer": "feed item: 文远知行001号员工带队…"
  }
}
```

`kind` 是类型（news / paper / repo / release / model / plugin / discussion / product），`evidence` 就是「凭什么说这条是真的」，`image` + `imageSource` 是这张缩略图来自哪里（来源站点自己给的图，不是生成的）。

## 数据源

全部是公开端点，无需授权。**如果某个源长期失败，网页会直接标红**——不会拿旧数据冒充新数据。

| 类别 | 数据源 | 端点 |
| --- | --- | --- |
| 论文 | arXiv（cs.AI / cs.CL / cs.LG） | `export.arxiv.org/api/query` |
| 论文 | Hugging Face 每日论文 | `huggingface.co/api/daily_papers` |
| 开源 | GitHub 搜索 / 话题 / Release | `api.github.com` |
| 模型 | Hugging Face 模型 / 数据集 / Space 趋势榜 | `huggingface.co/api/models?sort=trendingScore` |
| 模型 | OpenRouter 模型目录 | `openrouter.ai/api/v1/models` |
| 开源 | GitHub 每日趋势（HTML 解析） | `github.com/trending` |
| 视频 | YouTube 技术频道 Atom（Karpathy / AI Explained / 2 Minute Papers / Matt Wolfe / MLST） | `youtube.com/feeds/videos.xml` |
| 安全 | The Hacker News（AI 相关安全事件） | `feeds.feedburner.com/TheHackersNews` |
| 社区 | Lobsters · Show HN · V2EX · 掘金 · OSCHINA · InfoQ 中文 | 各自 RSS / Algolia |
| 官方 | Anthropic News（HTML 解析） | `anthropic.com/news` |
| 英文 | The Verge AI · Wired AI · Ars Technica · NVIDIA · BAIR · ScienceDaily | 各自 RSS |
| 中文 | 雷锋网 · 极客公园 · 爱范儿 · 钛媒体 | 各自 RSS |
| 热帖 | Hacker News（Algolia，按分值过滤） | `hn.algolia.com/api/v1/search` |
| 插件 | DSH 插件索引（3900+ 插件） | `awesome-dsh-plugin.com/index.json` |
| 中文 | 量子位 · 36氪 · IT之家 | 各自 RSS |
| 官方 | OpenAI · Google DeepMind · Hugging Face · GitHub · Cloudflare | 各自 RSS |
| 英文 | The Decoder · TechCrunch AI · MIT 科技评论 · Latent Space · Simon Willison | 各自 RSS |
| 产品 | Product Hunt | `producthunt.com/feed` |
| 社交 | Bluesky（AI 话题搜索，按点赞排序；**需凭据**） | `app.bsky.feed.searchPosts`（认证后） |
| 社交 | Mastodon（#ai / #LLM / #MachineLearning 话题时间线；mastodon.social / sigmoid.social / hachyderm.io 多实例） | `<实例>/api/v1/timelines/tag/*` |
| 社交 | Reddit · r/MachineLearning · r/LocalLLaMA · r/artificial · r/OpenAI（**需凭据**） | `oauth.reddit.com/r/*/hot` |
| 官方 | Google AI · Qwen · 微软研究院 · Apple 机器学习 · AWS 机器学习 | 各自 RSS |
| 分析 | AI News (smol.ai) · Interconnects · One Useful Thing · Ahead of AI · The Gradient · Techmeme | 各自 RSS |
| 社区 | LessWrong · Alignment Forum | 各自 RSS |
| 媒体 | MarkTechPost · Synced Review · AI Business · IEEE Spectrum AI · Unite.AI | 各自 RSS |
| 官方 | Together AI 博客 | `together.ai/blog/rss.xml` |

> **关于「推特」**：X / Twitter 没有免费公开 API（要付费），所以这里用 **Bluesky** 补上「推特类」的实时讨论，再加 Mastodon 和 Reddit。Mastodon 是公开接口、开箱即用；你自己的 Bluesky 关注列表可以写进 `config/watchlist.json` 的 `social.bluesky.accounts`，下一轮采集自动生效。
>
> **Bluesky / Reddit 需要凭据才启用**（实测：Bluesky 的 `searchPosts` 已要求登录、Reddit 会挡数据中心 IP，Actions 里不配凭据一律 403）。不想配也没关系——它们会在面板上显示为「未启用」（灰点，不计入异常），其余数据源照常。
>
> 配法（仓库 Settings → Secrets and variables → Actions → New repository secret）：
>
> | Secret | 取值 |
> | --- | --- |
> | `BLUESKY_HANDLE` | 你的 Bluesky 账号，如 `xxx.bsky.social` |
> | `BLUESKY_APP_PASSWORD` | Bluesky 设置里的 App Password（**不是**主密码） |
> | `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` | reddit.com/prefs/apps 建一个 `script` 类型 app 得到的两个值 |
>
> 配好后下一轮采集自动生效，不需要改代码。

## 本地跑

```bash
node scripts/collect.mjs     # 采集，写 data/
node scripts/render.mjs      # 生成 digest.md / README 热榜 / dist 静态站
node scripts/serve.mjs       # 本地预览 dist（默认 4173 端口）
```

GitHub 相关能力需要 token（否则会被限流到 403）：

```bash
# Windows PowerShell
$env:GH_TOKEN = (gh auth token).Trim(); node scripts/collect.mjs
```

## 想让它盯别的东西

改 [`config/watchlist.json`](config/watchlist.json) 就行，下次采集自动生效：

```json
{
  "minStars": 20,          // 新仓库的 star 门槛
  "newRepoDays": 14,       // 新仓库的回看天数
  "riserDelta": 120,       // 涨星榜门槛（对比 20 小时前的快照）
  "topics": ["llm", "ai-agents", "rag", "mcp"],
  "keywords": { "boost": 18, "list": ["agent", "推理", "开源", "deepseek"] },
  "repos": ["vllm-project/vllm", "huggingface/transformers"],   // 监听 Release
  "ownRepos": ["123caiji/ai-world"]                              // 自己的仓库，只看不报 release
}
```

## 为什么不用现成方案

做过对比，取舍如下：

| 方案 | 为什么不直接用 |
| --- | --- |
| RSSHub / 各类聚合站 | 只给标题和链接，没有证据字段，也没有 GitHub 涨星和插件 diff |
| Hugging Face Papers / arXiv 单源 | 只有论文，看不到新闻和开源动态 |
| 商业情报 API | 要钱、要 key，本仓库零依赖零成本 |
| 别人做的 AI news 仓库 | 大多只跑 RSS，缺「抓取失败要被看见」的健康度设计 |

参考过 [AI-LLM-Agent-Learning](https://github.com/123caiji/AI-LLM-Agent-Learning) 里「每条结论都要有出处」的写法，所以把 `evidence` 做成了硬字段。

## 目录结构

```
ai-world/
├─ config/watchlist.json      # 关注什么（改这里最省事）
├─ scripts/
│  ├─ collect.mjs             # 采集主入口：并发抓取 → 去重 → 算热度 → 落盘
│  ├─ render.mjs              # 生成 digest / README 热榜 / dist 静态站
│  ├─ serve.mjs               # 本地预览
│  ├─ lib/{http,feed,util,store,rssSource}.mjs
│  └─ sources/                # 61 个适配器，一个文件管一个源
├─ data/
│  ├─ feed.json               # 主数据（近 600 条，带 evidence）
│  ├─ github.json             # 新仓库 / 涨星 / Release / 话题
│  ├─ dsh.json                # 插件生态
│  ├─ sources.json            # 数据源健康度
│  ├─ digest.md               # 本轮快照
│  ├─ archive/YYYY-MM.jsonl   # 历史归档
│  └─ snapshots/              # stars / releases / models / plugins 快照（算 delta 用）
├─ web/                       # 无构建单页（构建时整目录拷到 dist/）
└─ .github/workflows/
   ├─ radar.yml               # 定时器每小时探窗口，满 165 分钟才采集 → 渲染 → 提交
   └─ pages.yml               # dist/ 有变化就部署 GitHub Pages
```

## 定时与部署

- `radar.yml`：**采集节奏由脚本自己维持（自愈链）**，cron 只当兜底。每轮 run 一开始先用 `GITHUB_TOKEN` 把下一轮 `workflow_dispatch` 排进队列（`scripts/lib/keeper.mjs`），然后本轮守候到采集窗口打开再干活。窗口条件是「距上次采集 ≥ 165 分钟」，没到就在 job 里睡，最多睡 180 分钟。链条健康状态写在 `data/keeper.json`（`chainRuns` / `lastDispatch` / `updatedAt`）。
- 为什么不再依赖 cron：`schedule` 是「尽力而为」的——高峰期延迟几十分钟是常态，恶劣时会静默丢拍（本仓库实测出现过 4 小时一次都没触发，线上数据停在 4 小时前）。`workflow_dispatch` 则是 `GITHUB_TOKEN` 能触发新 run 的例外（只有 `push` 会被抑制），所以自愈链既不需要 PAT，也不需要 workflow 权限。
- 开关：`config/keeper.json` 的 `enabled`（关掉后退回纯 cron 模式，不推荐）、`maxWaitMinutes`（默认 180）。
- 想立刻采一轮：`FORCE_COLLECT=1 node scripts/collect.mjs && node scripts/render.mjs`；`COLLECT_INTERVAL_MIN` 可临时改窗口。本地想试链条而不真采集：`RADAR_KEEPER=1 COLLECT_INTERVAL_MIN=10000 RADAR_KEEPER_MAX_WAIT_MIN=0.05 node scripts/collect.mjs`。
- `pages.yml`：`dist/` 有变化就部署 Pages（与采集解耦，采集失败时线上仍是上一版）。
- 线上站点：<https://123caiji.github.io/ai-world/>
- 提交身份是 `123caiji <166346449+123caiji@users.noreply.github.com>`，所以自动提交也计入贡献图。

## 素材（每张图都能溯源）

- 缩略图**只来自来源站点自己的图片**：RSS 的 `media:thumbnail` / `media:content` / `enclosure`、原文页 `og:image` / `twitter:image`、Hugging Face 官方卡片图、YouTube 视频封面、GitHub 仓库头像。
- 每条都带 `imageSource` 字段，卡片右下角标注出处，鼠标悬停能看到图片真实地址。
- 取不到图的条目显示「无素材」，**不拿占位图或 AI 生成图充数**。
- 已知死链（例如 `opengraph.githubassets.com` 实测恒返回 429）在入库前就过滤，封面缓存 `data/snapshots/covers.json` 里也会一并清掉。
- 右栏「素材来源」面板实时统计真实图覆盖率、按来源分布、图片来源域名。

**缓存策略**：`data/*.json` 前端一律 `cache: no-store`；`style.css` / `app.js` 在构建时写入内容指纹（`?v=<内容 sha256 前十位>`），内容变了 URL 才变，更新后浏览器不会继续用旧的 CSS/JS。

## 站上的小组件

- **采集流水线**（首屏 KPI 下方）：上次采集时间、下一批窗口倒计时、本轮新入库条数、数据源健康度，进度条按 165 分钟窗口推进。三种状态都写在脸上：窗口未到（还差多久）、已开窗（这一轮正在补跑）、已超窗（链条还活着但没跑起来）；文案会读 `data/keeper.json`，自愈链正常时说「自愈链已排队，到点自己跑，不依赖 cron」，心跳超过 4 小时就退回 cron 口径。
- **情报详情抽屉**：点任意卡片从右侧滑出，把这条情报的抓取证据摊开——抓取端点、抓取时间、HTTP 状态、响应定位、首次发现、最后确认（含扫到次数）、热度、分值、语言、图片原址、条目 ID。底部可以「上一条 / 下一条」连续看、一键复制 JSON、打开原文；键盘 ←→ 切换、Esc 关闭。
- **命令面板**：`⌘K` / `Ctrl+K` 打开，输入关键词直接搜全量情报（按热度取前 8 条），输入 `>` 前缀执行命令（切换主题、加载更多、跳到 GitHub 雷达、打开 RSS、打开数据文件）。
- **安全快报 / 论文速览**（右栏）：近 24 小时安全条数与热门前 3、最新 3 篇论文，点条目同样能开抽屉。
- **情报流动热力图**（右栏）：来源 × 最近 24 小时，格子深浅表示该来源那一小时发布了多少条；按条目发布时间（不是我们发现的时间）分桶，能看出这波热点是集中在某个时段还是匀速来。
- **抽屉里的同类近邻**：抽屉底部自动列出 3 条同话题/同来源的情报（同 kind +2 分、同 source +1 分，再按时间排序），点一下直接跳过去，不用退回列表翻。
- 另有顶部滚动进度条、卡片指针光效、首屏骨架屏。所有小组件读的都是同一份 `data/site.json` / `data/feed.json`，不额外发请求、不新增依赖。

## 诚实说明

- 新闻标题与摘要是原站点给的，本仓库只做聚合，版权归原站。
- 热度分数是本地算的排序启发式（时效 + 平台分 + 关键词），不是绝对质量。
- GitHub star 数会被缓存，涨星榜比较的是我们自己存的快照，不是官方曲线。
- 源失败时保留上次成功的记录并标红，绝不静默吞掉。

## License

MIT
