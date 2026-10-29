import { makeFeedSource } from '../lib/rssSource.mjs';
import { source as arxiv } from './arxiv.mjs';
import { source as arxivMore } from './arxiv-more.mjs';
import { source as hfPapers } from './hf-papers.mjs';
import { source as hfTrending } from './hf-trending.mjs';
import { source as hn } from './hn.mjs';
import { source as hnShow } from './hn-show.mjs';
import { source as lobsters } from './lobsters.mjs';
import { source as openrouter } from './openrouter.mjs';
import { source as github } from './github.mjs';
import { source as githubTrending } from './github-trending.mjs';
import { source as dshPlugins } from './dsh-plugins.mjs';
import { source as youtube } from './youtube.mjs';
import { source as security } from './security.mjs';
import { source as community } from './community.mjs';
import { source as anthropic } from './anthropic.mjs';

const AI_MATCH = 'AI|A\\.I\\.|人工智能|大模型|模型|智能体|Agent|LLM|GPT|Claude|Gemini|OpenAI|Anthropic|英伟达|NVIDIA|算力|推理|多模态|机器人|芯片|DeepSeek|Qwen|Kimi|豆包|通义';

export const sources = [
  // —— 结构化源（自有解析器）——
  arxiv,
  arxivMore,
  hfPapers,
  hfTrending,
  github,
  githubTrending,
  dshPlugins,
  openrouter,
  hn,
  hnShow,
  lobsters,
  youtube,
  security,
  community,
  anthropic,

  // —— 中文资讯 ——
  makeFeedSource({ id: 'qbitai', label: '量子位', url: 'https://www.qbitai.com/feed', kind: 'news', tags: ['中文'], limit: 20 }),
  makeFeedSource({ id: '36kr', label: '36氪', url: 'https://36kr.com/feed', kind: 'news', tags: ['中文'], limit: 16, match: AI_MATCH }),
  makeFeedSource({ id: 'ithome', label: 'IT之家', url: 'https://www.ithome.com/rss/', kind: 'news', tags: ['中文'], limit: 12, match: AI_MATCH }),
  makeFeedSource({ id: 'leiphone', label: '雷峰网', url: 'https://www.leiphone.com/feed', kind: 'news', tags: ['中文'], limit: 12, match: AI_MATCH }),
  makeFeedSource({ id: 'geekpark', label: '极客公园', url: 'https://www.geekpark.net/rss', kind: 'news', tags: ['中文'], limit: 10, match: AI_MATCH }),
  makeFeedSource({ id: 'ifanr', label: '爱范儿', url: 'https://www.ifanr.com/feed', kind: 'news', tags: ['中文'], limit: 10, match: AI_MATCH }),
  makeFeedSource({ id: 'tmtpost', label: '钛媒体', url: 'https://www.tmtpost.com/rss', kind: 'news', tags: ['中文'], limit: 10, match: AI_MATCH }),

  // —— 官方博客 / 大厂 ——
  makeFeedSource({ id: 'openai', label: 'OpenAI 官方博客', url: 'https://openai.com/news/rss.xml', kind: 'news', tags: ['官方'], limit: 12 }),
  makeFeedSource({ id: 'deepmind', label: 'Google DeepMind', url: 'https://blog.google/technology/google-deepmind/rss/', kind: 'news', tags: ['官方'], limit: 10 }),
  makeFeedSource({ id: 'hf-blog', label: 'Hugging Face 博客', url: 'https://huggingface.co/blog/feed.xml', kind: 'news', tags: ['官方'], limit: 10 }),
  makeFeedSource({ id: 'nvidia', label: 'NVIDIA 博客', url: 'https://blogs.nvidia.com/feed/', kind: 'news', tags: ['芯片'], limit: 10, match: AI_MATCH }),
  makeFeedSource({ id: 'github-blog', label: 'GitHub 博客', url: 'https://github.blog/feed/', kind: 'news', tags: ['工程'], limit: 8 }),
  makeFeedSource({ id: 'cloudflare', label: 'Cloudflare 博客', url: 'https://blog.cloudflare.com/rss/', kind: 'news', tags: ['工程'], limit: 8, match: AI_MATCH }),

  // —— 英文科技媒体 ——
  makeFeedSource({ id: 'the-decoder', label: 'The Decoder', url: 'https://the-decoder.com/feed/', kind: 'news', tags: ['英文'], limit: 12 }),
  makeFeedSource({ id: 'techcrunch-ai', label: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', kind: 'news', tags: ['英文'], limit: 10 }),
  makeFeedSource({ id: 'verge-ai', label: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', kind: 'news', tags: ['英文'], limit: 10 }),
  makeFeedSource({ id: 'wired-ai', label: 'WIRED AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', kind: 'news', tags: ['英文'], limit: 8 }),
  makeFeedSource({ id: 'arstechnica', label: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', kind: 'news', tags: ['英文'], limit: 8, match: AI_MATCH }),
  makeFeedSource({ id: 'mit-tr', label: 'MIT 科技评论', url: 'https://www.technologyreview.com/feed/', kind: 'news', tags: ['英文'], limit: 8, match: AI_MATCH }),
  makeFeedSource({ id: 'latent-space', label: 'Latent Space', url: 'https://www.latent.space/feed', kind: 'news', tags: ['英文'], limit: 8 }),
  makeFeedSource({ id: 'simonw', label: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', kind: 'news', tags: ['个人'], limit: 8 }),
  makeFeedSource({ id: 'bair', label: 'BAIR 伯克利', url: 'https://bair.berkeley.edu/blog/feed.xml', kind: 'paper', tags: ['研究'], limit: 6 }),
  makeFeedSource({ id: 'sciencedaily', label: 'ScienceDaily AI', url: 'https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml', kind: 'paper', tags: ['研究'], limit: 8 }),

  // —— 产品 ——
  makeFeedSource({ id: 'producthunt', label: 'Product Hunt', url: 'https://www.producthunt.com/feed', kind: 'product', tags: ['产品'], limit: 10, match: 'AI|Agent|GPT|LLM|模型|智能' }),
];

export function sourceById(id) {
  return sources.find((s) => s.id === id) || null;
}
