<div align="center">

# AI 大世界 · 实时 AI 情报站

**每小时自动采集** AI 新闻、arXiv 论文、新模型、GitHub 新仓库 / 涨星 / Release、DSH 插件生态。<br />
**每条情报都带可核验证据**：抓取端点、抓取时间、HTTP 状态、在响应里的定位。

[![radar](https://github.com/123caiji/ai-world/actions/workflows/radar.yml/badge.svg)](https://github.com/123caiji/ai-world/actions/workflows/radar.yml)
[![pages](https://img.shields.io/badge/site-ai--world-60a5fa)](https://123caiji.github.io/ai-world/)
[![sources](https://img.shields.io/badge/%E6%95%B0%E6%8D%AE%E6%BA%90-39%20%E4%B8%AA-34d399)](#数据源)
[![license](https://img.shields.io/badge/license-MIT-8a9ab3)](LICENSE)

</div>

---

## 这是什么

一个**只用 GitHub Actions 就能跑**的 AI 情报雷达。没有服务器、没有第三方 API key、没有付费数据源，全部来自公开接口。

它每小时做四件事：

1. **抓情报** —— 39 个数据源并发采集（中英新闻、官方博客、arXiv 多分区、Hugging Face 论文/模型/数据集/Space 趋势、GitHub 每日趋势、Hacker News / Show HN / Lobsters、YouTube 技术频道、AI 安全事件、中文技术社区、Anthropic 官方、Product Hunt、OpenRouter 模型目录）。
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
**最近一次采集**：2026/10/30 00:45:54 · 库内 639 条 · 本轮新增 2 条 · 数据源 39/39 正常

| 热度 | 条目 | 来源 |
| ---: | --- | --- |
| 204 | [thedotmack/claude-mem · 今日 +459 ⭐](https://github.com/thedotmack/claude-mem) | GitHub 每日趋势 |
| 196 | [nightly-labs/openbot · 今日 +705 ⭐](https://github.com/nightly-labs/openbot) | GitHub 每日趋势 |
| 196 | [Donchitos/Claude-Code-Game-Studios · 今日 +538 ⭐](https://github.com/Donchitos/Claude-Code-Game-Studios) | GitHub 每日趋势 |
| 178 | [pbakaus/impeccable · 今日 +2881 ⭐](https://github.com/pbakaus/impeccable) | GitHub 每日趋势 |
| 170 | [CopilotKit/OpenBot · 今日 +240 ⭐](https://github.com/CopilotKit/OpenBot) | GitHub 每日趋势 |
| 160 | [elayadesign/ai-design-skills · 今日 +1178 ⭐](https://github.com/elayadesign/ai-design-skills) | GitHub 每日趋势 |
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
  "evidence": {
    "url": "https://www.qbitai.com/feed",
    "fetchedAt": "2026-10-29T15:12:10.000Z",
    "httpStatus": 200,
    "pointer": "feed item: 文远知行001号员工带队…"
  }
}
```

`kind` 是类型（news / paper / repo / release / model / plugin / discussion / product），`evidence` 就是「凭什么说这条是真的」。

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
│  └─ sources/                # 39 个适配器，一个文件管一个源
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
   ├─ radar.yml               # 每小时采集 → 渲染 → 提交
   └─ pages.yml               # dist/ 有变化就部署 GitHub Pages
```

## 定时与部署

- `radar.yml`：每小时第 7 分钟（`7 * * * *`）采集一次，也支持手动 `workflow_dispatch`；采集 → 渲染 → 提交 `data/` 与 README 热榜。
- `pages.yml`：`dist/` 有变化就部署 Pages（与采集解耦，采集失败时线上仍是上一版）。
- 线上站点：<https://123caiji.github.io/ai-world/>
- 提交身份是 `123caiji <166346449+123caiji@users.noreply.github.com>`，所以自动提交也计入贡献图。
- Actions 的 `schedule` 在高峰期会有 5–30 分钟延迟，这是 GitHub 的行为，不是脚本问题。

## 诚实说明

- 新闻标题与摘要是原站点给的，本仓库只做聚合，版权归原站。
- 热度分数是本地算的排序启发式（时效 + 平台分 + 关键词），不是绝对质量。
- GitHub star 数会被缓存，涨星榜比较的是我们自己存的快照，不是官方曲线。
- 源失败时保留上次成功的记录并标红，绝不静默吞掉。

## License

MIT
